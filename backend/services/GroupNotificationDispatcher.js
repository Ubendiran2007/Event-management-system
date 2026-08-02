'use strict';

/**
 * TTL Cleanup Policy
 *
 * Firestore TTL delete policies should be enabled (via Firebase Console →
 * Firestore Data → Time-to-live) on these collections/fields:
 *
 *   ┌──────────────────────────────┬─────────────────────────┬──────────────────────┐
 *   │ Collection                   │ TTL Field               │ Recommended TTL Days │
 *   ├──────────────────────────────┼─────────────────────────┼──────────────────────┤
 *   │ notificationIdempotency      │ updatedAt               │ 30                   │
 *   │ schedulerLocks               │ expiresAt               │ 1                    │
 *   │ notificationBatches          │ updatedAt (or expiresAt)│ 60                   │
 *   │ eventNotifications (history) │ updatedAt               │ 90                   │
 *   └──────────────────────────────┴─────────────────────────┴──────────────────────┘
 *
 * Idempotency records use a 30-day window so a late retry of the *same* batch
 * id is still safely deduped but the collection doesn't grow unbounded.
 * Scheduler locks are ephemeral and can be reaped after 24h (or via expiresAt).
 * Batch documents are kept for 60 days for debug re-runs; the parent notification
 * history for 90 days satisfies audit retention. Individual records below all
 * write updatedAt so the TTL policy has a monotonic timestamp to rely on.
 */

const crypto = require('crypto');
const {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  db,
  runTransaction,
  writeBatch,
  arrayUnion
} = require('../firebaseClientWrapper');

const SystemConfig = require('../config/systemConfig');
const emailService = require('./emailService');
const emailTemplates = require('./emailTemplates');
const { logAudit, logActivity, logEmail } = require('../utils/logger');

const NOTIFICATION_TYPES = Object.freeze({
  APPROVED: 'REGISTRATION_APPROVED_FINALIZED',
  REJECTED: 'REGISTRATION_REJECTED_FINALIZED',
  WAITLISTED: 'REGISTRATION_WAITLISTED_FINALIZED'
});

const RECIPIENT_GROUPS = Object.freeze({
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WAITLISTED: 'WAITLISTED'
});

const DELIVERY_MODES = Object.freeze({
  BCC_ORGANIZER: 'BCC_ORGANIZER',
  VISIBLE_TO_RECIPIENTS: 'VISIBLE_TO_RECIPIENTS'
});

const DEFAULT_CONFIG = Object.freeze({
  maxRecipientsPerEmailBatch: 100,
  notificationBatchMaxRetries: 3,
  notificationDeliveryMode: DELIVERY_MODES.BCC_ORGANIZER,
  notificationNoReplyEmail: 'no-reply@eventmgmt.local',
  notificationFromEmail: 'notifications@eventmgmt.local'
});

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function makeIdempotencyKey(eventId, finalizedAt, groupType, batchIndex) {
  const raw = `regfinalize|v1|${eventId}|${String(finalizedAt)}|${groupType}|b${batchIndex}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function getOrganizerFallbackEmail(eventData, noReplyDefault) {
  const candidates = [
    eventData.organizerEmail,
    eventData.createdByEmail,
    eventData.contactEmail,
    eventData.requisition && eventData.requisition.step1 && eventData.requisition.step1.contactEmail,
    noReplyDefault
  ];
  for (const c of candidates) {
    if (isValidEmail(c)) return c.trim();
  }
  return null;
}

function buildSubject(groupType, eventData) {
  const title = eventData.title || eventData.eventName || 'the Event';
  if (groupType === RECIPIENT_GROUPS.APPROVED) return `Registration Confirmed – ${title}`;
  if (groupType === RECIPIENT_GROUPS.REJECTED) return `Registration Status – ${title}`;
  if (groupType === RECIPIENT_GROUPS.WAITLISTED) return `Registration Waitlist – ${title}`;
  return `Registration Update – ${title}`;
}

function buildTemplate(groupType, registrations, eventData) {
  // Return (registration, index) -> html renderer
  if (groupType === RECIPIENT_GROUPS.APPROVED) {
    return (reg) => emailTemplates.registrationApprovedFinalizedTemplate
      ? emailTemplates.registrationApprovedFinalizedTemplate(reg, eventData)
      : `<p>Your registration for ${eventData.title || 'the event'} has been confirmed.</p>`;
  }
  if (groupType === RECIPIENT_GROUPS.REJECTED) {
    return (reg) => emailTemplates.registrationRejectedFinalizedTemplate
      ? emailTemplates.registrationRejectedFinalizedTemplate(reg, eventData, reg.rejectionReason || null)
      : `<p>Thank you for registering for ${eventData.title || 'the event'}. Unfortunately, your registration was not selected this time. We encourage you to participate in future events.</p>`;
  }
  if (groupType === RECIPIENT_GROUPS.WAITLISTED) {
    return (reg, idx) => emailTemplates.registrationWaitlistedFinalizedTemplate
      ? emailTemplates.registrationWaitlistedFinalizedTemplate(reg, eventData, idx + 1)
      : `<p>You are on the waitlist for ${eventData.title || 'the event'}.</p>`;
  }
  return () => '';
}

function buildDeliveryEnvelope(deliveryMode, groupEmails, organizerEmail, noReplyEmail) {
  const mode = Object.values(DELIVERY_MODES).includes(deliveryMode) ? deliveryMode : DELIVERY_MODES.BCC_ORGANIZER;
  if (mode === DELIVERY_MODES.VISIBLE_TO_RECIPIENTS) {
    return {
      to: groupEmails,
      bcc: null,
      mode
    };
  }
  // Default BCC_ORGANIZER: preserve recipient privacy
  const to = organizerEmail || noReplyEmail || 'no-reply@events.local';
  return {
    to: [to],
    bcc: groupEmails,
    mode
  };
}

/**
 * GroupNotificationDispatcher
 *
 * Enterprise-grade dispatcher that:
 *  - Only sends AFTER the organizer clicks Finalize & Notify.
 *  - Groups APPROVED / REJECTED / WAITLISTED students into consolidated
 *    batch notifications (one per group, split automatically into chunks
 *    of maxRecipientsPerEmailBatch).
 *  - Supports configurable delivery modes (BCC default, visible TO opt-in).
 *  - Uses deterministic idempotency keys to prevent duplicate deliveries
 *    across retries or crash-restarts.
 *  - Continues processing remaining batches even if one batch fails.
 *  - Records per-batch delivery status and aggregate retry counts.
 *  - Writes GROUP_NOTIFICATION_STARTED / *_NOTIFICATION_SENT /
 *    GROUP_NOTIFICATION_COMPLETED audit entries + a durable notification
 *    history document under the eventNotifications collection.
 */
class GroupNotificationDispatcher {
  static DELIVERY_MODES = DELIVERY_MODES;
  static RECIPIENT_GROUPS = RECIPIENT_GROUPS;

  /**
   * Primary entry point — call once the event has been atomically transitioned
   * to FINALIZED. Runs entirely in the background via executeBackgroundNotification
   * wrapper, so it never blocks the HTTP response.
   *
   * @param {Object}   eventData        Full event document + .id
   * @param {Object}   lists            { approvedList, rejectedList, waitlistedList }
   * @param {Object}   actor            { uid, name, role, department }
   * @param {String}   finalizedAt      ISO timestamp locked in the finalize txn
   * @returns {Promise<Object>}         Delivery summary { notificationId, groups, overallStatus }
   */
  static async dispatchFinalizeNotifications(eventData, lists, actor, finalizedAt) {
    const eventId = eventData.id || eventData.eventId;
    if (!eventId) throw new Error('dispatchFinalizeNotifications: eventId is required');

    const cfg = await SystemConfig.loadAll().catch(() => ({}));
    const batchSizeRaw = parseInt(
      (cfg && cfg.maxRecipientsPerEmailBatch != null) ? cfg.maxRecipientsPerEmailBatch : DEFAULT_CONFIG.maxRecipientsPerEmailBatch,
      10
    );
    const batchSize = Number.isFinite(batchSizeRaw) ? Math.max(1, Math.min(1000, batchSizeRaw)) : DEFAULT_CONFIG.maxRecipientsPerEmailBatch;

    const retriesRaw = parseInt(
      (cfg && cfg.notificationBatchMaxRetries != null) ? cfg.notificationBatchMaxRetries : DEFAULT_CONFIG.notificationBatchMaxRetries,
      10
    );
    const batchMaxRetries = Number.isFinite(retriesRaw) ? Math.max(0, Math.min(10, retriesRaw)) : DEFAULT_CONFIG.notificationBatchMaxRetries;

    const deliveryModeRaw = String((cfg && cfg.notificationDeliveryMode) || '').trim().toUpperCase();
    const deliveryMode = Object.values(DELIVERY_MODES).includes(deliveryModeRaw)
      ? deliveryModeRaw
      : DEFAULT_CONFIG.notificationDeliveryMode;

    const fromEmail = String((cfg && cfg.notificationFromEmail) || DEFAULT_CONFIG.notificationFromEmail).trim();
    const noReplyRaw = String((cfg && cfg.notificationNoReplyEmail) || fromEmail || DEFAULT_CONFIG.notificationNoReplyEmail).trim();
    const noReplyEmail = isValidEmail(noReplyRaw) ? noReplyRaw : DEFAULT_CONFIG.notificationNoReplyEmail;
    const organizerEmail = getOrganizerFallbackEmail(eventData, noReplyEmail);

    const notificationId = `notif_${eventId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const notificationDocRef = doc(db, 'eventNotifications', notificationId);

    // ── GROUP_NOTIFICATION_STARTED audit ────────────────────────────────
    const nowIso = new Date().toISOString();
    const groups = {
      [RECIPIENT_GROUPS.APPROVED]:   lists.approvedList   || [],
      [RECIPIENT_GROUPS.REJECTED]:   lists.rejectedList   || [],
      [RECIPIENT_GROUPS.WAITLISTED]: lists.waitlistedList || []
    };

    try {
      await logAudit({
        category: 'REGISTRATION',
        action: 'GROUP_NOTIFICATION_STARTED',
        status: 'SUCCESS',
        severity: 'INFO',
        source: 'GroupNotificationDispatcher',
        correlationId: eventId,
        requestId: crypto.randomUUID(),
        actor: actor ? { userId: actor.uid || 'SYSTEM', name: actor.name || 'System', role: actor.role || 'SYSTEM', department: actor.department || null } : { userId: 'SYSTEM', name: 'System', role: 'SYSTEM' },
        target: { entityType: 'EVENT', entityId: eventId },
        details: {
          notificationId,
          finalizedAt,
          deliveryMode,
          batchSize,
          approvedCount:   groups[RECIPIENT_GROUPS.APPROVED].length,
          rejectedCount:   groups[RECIPIENT_GROUPS.REJECTED].length,
          waitlistedCount: groups[RECIPIENT_GROUPS.WAITLISTED].length,
          totalRecipients: Object.values(groups).reduce((s, g) => s + g.length, 0)
        }
      });
    } catch (e) { /* swallow audit failures so they don't prevent send */ }

    // ── Idempotency guard: create sentinel doc if not already present ──
    try {
      await setDoc(notificationDocRef, {
        eventId,
        notificationType: 'REGISTRATION_FINALIZE_BATCH',
        trigger: 'ORGANIZER_FINALIZE',
        triggeredBy: actor || { userId: 'SYSTEM', name: 'System', role: 'SYSTEM' },
        finalizedAt: finalizedAt || nowIso,
        createdAt: nowIso,
        deliveryMode,
        batchSize,
        organizerEmail,
        status: 'PROCESSING',
        groups: Object.fromEntries(
          Object.entries(groups).map(([k, v]) => [k, {
            recipientCount: v.length,
            batchCount: 0,
            batches: [],
            sentCount: 0,
            failedCount: 0,
            retryCount: 0,
            deliveryStatus: 'PENDING',
            completedAt: null
          }])
        ),
        aggregate: {
          totalRecipients: Object.values(groups).reduce((s, g) => s + g.length, 0),
          totalBatches: 0,
          batchesProcessed: 0,
          batchesFailed: 0,
          retryCount: 0
        }
      }, { merge: true });
    } catch (e) {
      console.error(`[GroupDispatcher/${eventId}] Failed to seed notification history doc:`, e.message);
    }

    const groupSummaries = {};
    let anySent = false;

    for (const groupType of Object.values(RECIPIENT_GROUPS)) {
      const rawList = groups[groupType];
      const groupResult = await this._processGroup({
        groupType,
        registrations: rawList,
        eventData,
        eventId,
        notificationId,
        actor,
        finalizedAt,
        deliveryMode,
        organizerEmail,
        noReplyEmail,
        batchSize,
        batchMaxRetries
      });

      groupSummaries[groupType] = groupResult;
      if (groupResult.deliveryStatus === 'SENT' || groupResult.deliveryStatus === 'PARTIAL') anySent = true;

      const auditAction = {
        [RECIPIENT_GROUPS.APPROVED]:   'APPROVED_NOTIFICATION_SENT',
        [RECIPIENT_GROUPS.REJECTED]:   'REJECTED_NOTIFICATION_SENT',
        [RECIPIENT_GROUPS.WAITLISTED]: 'WAITLIST_NOTIFICATION_SENT'
      }[groupType];

      try {
        await logAudit({
          category: 'REGISTRATION',
          action: auditAction,
          status: groupResult.totalBatches === 0
            ? 'SKIPPED'
            : (groupResult.deliveryStatus === 'FAILED' ? 'FAILED' : (groupResult.deliveryStatus === 'PARTIAL' ? 'WARNING' : 'SUCCESS')),
          severity: groupResult.deliveryStatus === 'FAILED' ? 'ERROR' : (groupResult.deliveryStatus === 'PARTIAL' ? 'WARNING' : 'INFO'),
          source: 'GroupNotificationDispatcher',
          correlationId: eventId,
          requestId: crypto.randomUUID(),
          actor: actor ? { userId: actor.uid || 'SYSTEM', name: actor.name || 'System', role: actor.role || 'SYSTEM', department: actor.department || null } : { userId: 'SYSTEM', name: 'System', role: 'SYSTEM' },
          target: { entityType: 'EVENT', entityId: eventId },
          details: {
            notificationId,
            recipientGroup: groupType,
            recipientCount: groupResult.recipientCount,
            batchCount: groupResult.totalBatches,
            sentBatchCount: groupResult.batchResults.filter(b => b.status === 'ENQUEUED' || b.status === 'SENT').length,
            failedBatchCount: groupResult.batchResults.filter(b => b.status === 'FAILED').length,
            retryCount: groupResult.retryCount,
            deliveryStatus: groupResult.deliveryStatus,
            idempotencyKeys: groupResult.batchResults.map(b => ({ index: b.batchIndex, key: b.idempotencyKey, status: b.status }))
          }
        });
      } catch (e) { /* swallow */ }
    }

    // ── Compute overall status + write GROUP_NOTIFICATION_COMPLETED ───
    const allBatchResults = Object.values(groupSummaries).flatMap(g => g.batchResults);
    const totalBatches = allBatchResults.length;
    const totalFailed = allBatchResults.filter(b => b.status === 'FAILED').length;
    const totalEnqueued = allBatchResults.filter(b => b.status === 'ENQUEUED' || b.status === 'SENT').length;
    const totalRetries = Object.values(groupSummaries).reduce((s, g) => s + g.retryCount, 0);
    const totalRecipients = Object.values(groupSummaries).reduce((s, g) => s + g.recipientCount, 0);

    let overallStatus = 'NOT_SENT';
    if (totalBatches === 0) overallStatus = 'NOT_SENT';
    else if (totalFailed === 0) overallStatus = 'SENT';
    else if (totalEnqueued === 0) overallStatus = 'FAILED';
    else overallStatus = 'PARTIAL';

    try {
      await logAudit({
        category: 'REGISTRATION',
        action: 'GROUP_NOTIFICATION_COMPLETED',
        status: overallStatus === 'FAILED' ? 'FAILED' : (overallStatus === 'PARTIAL' ? 'WARNING' : 'SUCCESS'),
        severity: overallStatus === 'FAILED' ? 'ERROR' : (overallStatus === 'PARTIAL' ? 'WARNING' : 'INFO'),
        source: 'GroupNotificationDispatcher',
        correlationId: eventId,
        requestId: crypto.randomUUID(),
        actor: actor ? { userId: actor.uid || 'SYSTEM', name: actor.name || 'System', role: actor.role || 'SYSTEM', department: actor.department || null } : { userId: 'SYSTEM', name: 'System', role: 'SYSTEM' },
        target: { entityType: 'EVENT', entityId: eventId },
        details: {
          notificationId,
          deliveryMode,
          totalRecipients,
          totalBatches,
          totalFailed,
          totalEnqueued,
          retryCount: totalRetries,
          overallStatus,
          groupSummaries: Object.fromEntries(
            Object.entries(groupSummaries).map(([k, g]) => [k, {
              recipientCount: g.recipientCount,
              batchCount: g.totalBatches,
              deliveryStatus: g.deliveryStatus,
              retryCount: g.retryCount
            }])
          )
        }
      });
    } catch (e) { /* swallow */ }

    // ── Persist final status into eventNotifications ────────────────────
    try {
      const finalGroups = {};
      for (const [k, v] of Object.entries(groupSummaries)) {
        finalGroups[k] = {
          recipientCount: v.recipientCount,
          batchCount: v.totalBatches,
          batches: v.batchResults,
          sentCount: v.batchResults.filter(b => b.status === 'ENQUEUED' || b.status === 'SENT').reduce((s, b) => s + (b.recipientCount || 0), 0),
          failedCount: v.batchResults.filter(b => b.status === 'FAILED').reduce((s, b) => s + (b.recipientCount || 0), 0),
          retryCount: v.retryCount,
          deliveryStatus: v.deliveryStatus,
          completedAt: new Date().toISOString()
        };
      }
      await updateDoc(notificationDocRef, {
        status: overallStatus,
        completedAt: new Date().toISOString(),
        groups: finalGroups,
        aggregate: {
          totalRecipients,
          totalBatches,
          batchesProcessed: totalBatches,
          batchesFailed: totalFailed,
          retryCount: totalRetries,
          batchesEnqueued: totalEnqueued
        }
      });
    } catch (e) {
      console.error(`[GroupDispatcher/${eventId}] Failed to finalize notification history:`, e.message);
    }

    // ── Flip event.registration.notificationSent flag if at least 1 batch queued ─
    try {
      if (anySent || totalEnqueued > 0) {
        const eventRef = doc(db, 'events', eventId);
        await updateDoc(eventRef, {
          'registration.notificationSent': true,
          'registration.notificationSentAt': new Date().toISOString(),
          'registration.notificationId': notificationId,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error(`[GroupDispatcher/${eventId}] Failed to mark notificationSent flag:`, e.message);
    }

    try {
      logActivity({
        category: 'REGISTRATION',
        action: 'REGISTRATION_NOTIFICATION_BATCH_COMPLETED',
        status: overallStatus === 'FAILED' ? 'FAILED' : 'SUCCESS',
        correlationId: eventId,
        requestId: crypto.randomUUID(),
        actor: actor ? { userId: actor.uid || 'SYSTEM', name: actor.name || 'System', role: actor.role || 'SYSTEM' } : { userId: 'SYSTEM', name: 'System', role: 'SYSTEM' },
        target: { entityType: 'EVENT', entityId: eventId },
        details: {
          notificationId,
          deliveryMode,
          totalRecipients,
          totalBatches,
          totalFailed,
          retryCount: totalRetries,
          overallStatus
        }
      });
    } catch (e) { /* swallow */ }

    return {
      notificationId,
      eventId,
      deliveryMode,
      finalizedAt: finalizedAt || nowIso,
      completedAt: new Date().toISOString(),
      overallStatus,
      totalRecipients,
      totalBatches,
      totalFailed,
      totalEnqueued,
      retryCount: totalRetries,
      groups: groupSummaries
    };
  }

  /**
   * Resume/retry a previously dispatched notification run if it crashed midway.
   * Caller can discover notificationId from the event.registration.notificationId
   * field and re-invoke this method; each batch uses the same deterministic
   * idempotency key so already-processed batches are skipped.
   */
  static async resumeNotification(notificationId) {
    if (!notificationId) throw new Error('notificationId required');
    const snap = await getDoc(doc(db, 'eventNotifications', notificationId));
    if (!snap.exists) throw new Error('Notification run not found: ' + notificationId);
    const data = snap.data();
    const eventId = data.eventId;
    const eventSnap = await getDoc(doc(db, 'events', eventId));
    if (!eventSnap.exists) throw new Error('Event not found: ' + eventId);
    const eventData = { id: eventId, ...eventSnap.data() };

    const regSnap = await getDocs(query(collection(db, 'eventRegistrations'), where('eventId', '==', eventId)));
    const approvedList = []; const rejectedList = []; const waitlistedList = [];
    regSnap.forEach(d => {
      const r = d.data();
      const st = r.status === 'PENDING_APPROVAL' ? 'PENDING' : (r.status || 'PENDING');
      if (st === 'APPROVED') approvedList.push(r);
      else if (st === 'REJECTED') rejectedList.push(r);
      else if (st === 'WAITLISTED') waitlistedList.push(r);
    });

    const actor = data.triggeredBy || { userId: 'SYSTEM', name: 'System', role: 'SYSTEM' };
    return this.dispatchFinalizeNotifications(
      eventData,
      { approvedList, rejectedList, waitlistedList },
      actor,
      data.finalizedAt || new Date().toISOString()
    );
  }

  // ── Private: process one group (APPROVED / REJECTED / WAITLISTED) ───
  static async _processGroup(args) {
    const {
      groupType, registrations, eventData, eventId, notificationId,
      actor, finalizedAt, deliveryMode, organizerEmail, noReplyEmail,
      batchSize, batchMaxRetries
    } = args;

    const batchResults = [];
    let retryCount = 0;

    if (!registrations || registrations.length === 0) {
      return {
        groupType,
        recipientCount: 0,
        totalBatches: 0,
        deliveryStatus: 'SKIPPED',
        retryCount: 0,
        batchResults: []
      };
    }

    // Dedupe + validate emails
    const seenEmails = new Set();
    const recipients = [];
    for (const reg of registrations) {
      const email = (reg.userEmail || reg.email || '').toString().trim().toLowerCase();
      if (!isValidEmail(email)) continue;
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      recipients.push({
        email,
        registration: reg,
        student: {
          name: reg.userName || reg.name || email.split('@')[0],
          rollNo: reg.rollNo || null,
          department: reg.userDepartment || reg.department || null,
          email
        }
      });
    }

    const recipientCount = recipients.length;
    if (recipientCount === 0) {
      return {
        groupType,
        recipientCount: 0,
        totalBatches: 0,
        deliveryStatus: 'NO_VALID_RECIPIENTS',
        retryCount: 0,
        batchResults: []
      };
    }

    const chunks = chunkArray(recipients, batchSize);
    const totalBatches = chunks.length;
    const templateFn = buildTemplate(groupType, registrations, eventData);
    const subject = buildSubject(groupType, eventData);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const batchIndex = i;
      const idempotencyKey = makeIdempotencyKey(eventId, finalizedAt, groupType, batchIndex);

      // ── Idempotency: skip batch if already completed for this key ────
      const already = await this._getIdempotentStatus(idempotencyKey, notificationId);
      if (already && (already.status === 'ENQUEUED' || already.status === 'SENT')) {
        batchResults.push({
          batchIndex,
          recipientCount: chunk.length,
          idempotencyKey,
          status: already.status,
          skipped: true,
          priorMessageId: already.messageId || null,
          attempts: 1
        });
        continue;
      }

      const emails = chunk.map(r => r.email);
      const envelope = buildDeliveryEnvelope(deliveryMode, emails, organizerEmail, noReplyEmail);

      // Batch delivery uses a single shared HTML body for all recipients in
      // the chunk (BCC or visible TO). Never leak the first student's identity
      // to the rest of the batch. Use a generic greeting while keeping
      // batch-scoped values like waitlist position and default rejection reason.
      const firstReg = chunk[0].registration;
      const batchStudent = {
        name: 'Student',
        rollNo: null,
        department: null,
        email: null,
        _isBatchGreeting: true
      };
      const waitlistPosition = groupType === RECIPIENT_GROUPS.WAITLISTED
        ? recipients.indexOf(chunk[0]) + 1
        : null;

      let html = '';
      try {
        if (groupType === RECIPIENT_GROUPS.WAITLISTED) {
          html = emailTemplates.registrationWaitlistedFinalizedTemplate
            ? emailTemplates.registrationWaitlistedFinalizedTemplate(batchStudent, eventData, waitlistPosition)
            : '';
        } else if (groupType === RECIPIENT_GROUPS.REJECTED) {
          html = emailTemplates.registrationRejectedFinalizedTemplate
            ? emailTemplates.registrationRejectedFinalizedTemplate(batchStudent, eventData, firstReg.rejectionReason || null)
            : '';
        } else {
          html = emailTemplates.registrationApprovedFinalizedTemplate
            ? emailTemplates.registrationApprovedFinalizedTemplate(batchStudent, eventData)
            : '';
        }
      } catch (e) {
        console.warn(`[GroupDispatcher/${eventId}] Template fallback used for ${groupType}: ${e.message}`);
      }

      let status = 'FAILED';
      let messageId = null;
      let attempts = 0;
      let lastError = null;

      for (let attempt = 1; attempt <= batchMaxRetries; attempt++) {
        attempts = attempt;
        try {
          const result = await emailService.sendEmail({
            to: envelope.to,
            bcc: envelope.bcc,
            cc: undefined,
            subject,
            html,
            text: subject,
            eventId,
            eventTitle: eventData.title || eventData.eventName || null,
            emailType: NOTIFICATION_TYPES[groupType] || 'REGISTRATION_FINALIZE',
            batchId: `${notificationId}_${groupType}_${batchIndex}`,
            batchIndex,
            recipientGroup: groupType,
            idempotencyKey,
            notificationId
          });
          if (result && result.success) {
            status = 'ENQUEUED';
            messageId = result.messageId || null;
            lastError = null;
            break;
          } else {
            lastError = (result && result.error) || 'sendEmail returned unsuccessful';
          }
        } catch (e) {
          lastError = e.message;
          if (attempt < batchMaxRetries) {
            const delayMs = Math.pow(2, attempt) * 1000;
            retryCount += 1;
            await sleep(delayMs);
          }
          continue;
        }
      }

      // Persist idempotency marker regardless of outcome
      try {
        await this._putIdempotentStatus(idempotencyKey, {
          status,
          messageId,
          notificationId,
          eventId,
          groupType,
          batchIndex,
          recipientCount: emails.length,
          attempts,
          lastError: lastError || null,
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.warn(`[GroupDispatcher/${eventId}] Failed to persist idempotency marker ${batchIndex}/${groupType}:`, e.message);
      }

      batchResults.push({
        batchIndex,
        recipientCount: emails.length,
        deliveryMode: envelope.mode,
        toCount: Array.isArray(envelope.to) ? envelope.to.length : (envelope.to ? 1 : 0),
        bccCount: Array.isArray(envelope.bcc) ? envelope.bcc.length : (envelope.bcc ? 1 : 0),
        idempotencyKey,
        status,
        messageId,
        attempts,
        lastError
      });
    }

    const failedCount = batchResults.filter(b => b.status === 'FAILED').length;
    const enqueuedCount = batchResults.filter(b => b.status === 'ENQUEUED' || b.status === 'SENT').length;
    let deliveryStatus = 'SENT';
    if (failedCount === totalBatches) deliveryStatus = 'FAILED';
    else if (failedCount > 0) deliveryStatus = 'PARTIAL';
    else if (enqueuedCount === 0 && totalBatches > 0) deliveryStatus = 'FAILED';

    return {
      groupType,
      recipientCount,
      totalBatches,
      deliveryStatus,
      retryCount,
      batchResults
    };
  }

  static async _getIdempotentStatus(idempotencyKey, notificationId) {
    try {
      const snap = await getDoc(doc(db, 'notificationIdempotency', idempotencyKey));
      if (!snap.exists) return null;
      return snap.data();
    } catch (e) {
      console.warn('[GroupDispatcher] Idempotency lookup failed:', e.message);
      return null;
    }
  }

  static async _putIdempotencyStatus(idempotencyKey, payload) {
    const ref = doc(db, 'notificationIdempotency', idempotencyKey);
    await setDoc(ref, {
      ...payload,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  }
}

module.exports = GroupNotificationDispatcher;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.RECIPIENT_GROUPS = RECIPIENT_GROUPS;
module.exports.DELIVERY_MODES = DELIVERY_MODES;
module.exports.makeIdempotencyKey = makeIdempotencyKey;
