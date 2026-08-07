/**
 * emailHandler.js
 * ──────────────────────────────────────────────────────────────────
 * CENTRALIZED EMAIL HANDLER for the Event Management System.
 *
 * RULES:
 *  - Organizer ALWAYS gets notified on every status change.
 *  - Next approver(s) ALWAYS get notified.
 *  - Every send is individually try/caught and logged.
 *  - No silent failures — every success and error is logged.
 *  - Recipient email is validated before sending.
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

const normalizeRollNo = (value) =>
  String(value || '')
    .trim()
    .replace(/^student_/i, '')
    .toUpperCase();

const { collection, getDocs, query, where, db, collectionGroup, setDoc, doc } = require('../firebaseClientWrapper');
const { getAllStaffDocs } = require('../utils/staffHelper');
const { NOTIFICATION_STATUS } = require('../utils/notificationConstants');

const {
  sendEventNotificationToFaculty,
  sendEventStatusNotification,
  sendEventCreationNotification,
  sendApprovalRequestToRole,
  sendPosterRequestEmail,
  sendStudentRegistrationStatusEmail,
  sendPostEventFeedbackEmail,
  sendIQACSubmissionRequestEmail,
  sendIQACExtensionRequestEmail,
  sendIQACExtensionStatusEmail,
  sendManagerAssignmentEmail,
  sendBulkManagerAssignmentEmail,
  sendPostponementApprovalRequestEmail,
  sendPostponementRequestToIQACEmail,
  sendPostponementApprovedEmail,
  sendPostponementRejectedEmail,
  sendCancellationApprovalRequestEmail,
  sendCancellationRequestToIQACEmail,
  sendCancellationApprovedEmail,
  sendCancellationRejectedEmail,
} = require('./emailService');

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an email address before sending.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Safely send one email. Logs success/failure. Never throws.
 * @param {string} label       – human-readable description for logging
 * @param {string} recipient   – email address
 * @param {Function} sendFn    – async function that sends the email
 */
async function safeSend(label, recipient, sendFn, maxRetries = 2) {
  if (!isValidEmail(recipient)) {
    console.warn('[EMAIL_SKIP] ' + label + ' — invalid/missing recipient: ' + recipient);
    return;
  }
  
  const timeoutMs = parseInt(process.env.EMAIL_TIMEOUT_MS, 10) || 10000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('ETIMEDOUT')), timeoutMs)
      );
      
      await Promise.race([sendFn(), timeoutPromise]);
      console.log(`[EMAIL_SENT] ${label} → ${recipient} (Attempt ${attempt})`);
      return; // Success
    } catch (err) {
      const isRetryable = err.message === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'EAI_AGAIN';
      
      if (isRetryable && attempt < maxRetries) {
        console.warn(`[EMAIL_RETRY] ${label} → ${recipient} (Attempt ${attempt} failed: ${err.message}). Retrying...`);
        // Exponential backoff: 1s, 2s, 4s...
        await new Promise(res => setTimeout(res, Math.pow(2, attempt - 1) * 1000));
      } else {
        console.error(`[EMAIL_FAIL] ${label} → ${recipient} | Error: ${err.message} (Permanent failure or max retries reached)`);
        break; // Stop retrying
      }
    }
  }
}

/**
 * Centralized helper to execute any notification function in the background
 * without blocking the HTTP response, while trapping both synchronous and
 * asynchronous exceptions.
 *
 * @param {string} label - A human-readable identifier for logging
 * @param {Function} notifyFn - A function that returns a Promise
 */
function executeBackgroundNotification(label, notifyFn) {
  Promise.resolve()
    .then(() => notifyFn())
    .catch(err => {
      console.error(`[BACKGROUND_EMAIL_FAIL] ${label}`, err);
    });
}

/**
 * Fetch all emails for a given Firestore role.
 * @param {string} role
 * @returns {Promise<string[]>}
 */
async function getEmailsByRole(role, dept = null) {
  if (!role) return [];
  try {
    const staffDocs = await getAllStaffDocs();
    const emails = [];
    
    staffDocs.forEach(sDoc => {
      const arr = sDoc.data.staffs || [];
      arr.forEach(s => {
        if (s.role === role) {
          if (!dept || s.department === dept) {
            if (isValidEmail(s.email)) {
              emails.push(s.email);
            }
          }
        }
      });
    });
    
    return emails;
  } catch (err) {
    console.warn('[EMAIL_HANDLER] Failed to fetch emails for role ' + role + (dept ? ' and dept ' + dept : '') + ': ' + err.message);
    return [];
  }
}

/**
 * Send to all members of a role in parallel.
 */
async function notifyRole(role, eventData, dept = null) {
  const emails = await getEmailsByRole(role, dept);
  if (emails.length === 0) {
    console.warn('[EMAIL_HANDLER] No emails found for role: ' + role + (dept ? ' in dept: ' + dept : ''));
    return;
  }
  await Promise.allSettled(
    emails.map(email =>
      safeSend('Approval request [' + role + ']', email, () =>
        sendApprovalRequestToRole(eventData, email, role)
      )
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: handleEventStatusChange
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Central email dispatcher — call this every time an event status changes.
 *
 * @param {Object} eventData      – Full event document (must include id, title, organizerEmail, etc.)
 * @param {string} previousStatus – Status BEFORE the change (e.g. 'PENDING_HOD')
 * @param {string} newStatus      – Status AFTER the change  (e.g. 'PENDING_DEPARTMENTS')
 */
async function handleEventStatusChange(eventData, previousStatus, newStatus) {
  const eventId = eventData.id || '(unknown)';

  console.log(
    '\n[EMAIL_TRIGGER] ─────────────────────────────────────────\n' +
    '  Event   : ' + eventId + ' — ' + (eventData.title || '(no title)') + '\n' +
    '  Organizer: ' + (eventData.organizerEmail || '(none)') + '\n' +
    '  Transition: ' + previousStatus + ' → ' + newStatus + '\n' +
    '──────────────────────────────────────────────────────────'
  );

  // ── Always notify organizer on any status change ─────────
  if (isValidEmail(eventData.organizerEmail)) {
    if (previousStatus === null) {
      // It's a new event creation
      await safeSend(
        'Event creation confirmation to organizer',
        eventData.organizerEmail,
        () => sendEventCreationNotification(eventData.organizerEmail, eventData)
      );
    } else if (['POSTED', 'PUBLISHED', 'IQAC_APPROVED', 'REJECTED'].includes(newStatus)) {
      await safeSend(
        'Status update to organizer [' + newStatus + ']',
        eventData.organizerEmail,
        () => sendEventStatusNotification(eventData.organizerEmail, eventData, newStatus)
      );
    } else {
      console.log(`[LEGACY_DISABLED] Intermediate status update email to organizer disabled per 23-template whitelist (Status: ${newStatus}).`);
    }
  }

  // ── Per-transition logic ───────────────────────────────────────────────────

  // EVENT CREATED → notify Faculty
  if (newStatus === 'PENDING_FACULTY') {
    let facultyEmail = eventData.coordinator?.facultyEmail ||
                         eventData.coordinator?.faculty_email ||
                         eventData.facultyEmail || null;
    
    const eventDept = eventData.department || eventData.organizerDept || null;

    if (!isValidEmail(facultyEmail) && eventDept) {
      const deptFaculty = await getEmailsByRole('FACULTY', eventDept);
      if (deptFaculty.length > 0) facultyEmail = deptFaculty[0]; // Take first as primary
    }

    console.log(`[LEGACY_DISABLED] Faculty event notification email disabled per 23-template whitelist (Event: ${eventData.title}, Faculty: ${facultyEmail}).`);
    return;
  }

  // EVENT CREATED (student-created, goes direct to PENDING_HOD) or FACULTY APPROVED → notify HOD
  if (newStatus === 'PENDING_HOD') {
    const eventDept = eventData.department || eventData.organizerDept || null;
    await notifyRole('HOD', eventData, eventDept);

    // Poster: if HOD is the first approver and poster was requested, notify media now
    if (previousStatus === 'PENDING_FACULTY' && eventData.posterWorkflow?.requested && eventData.posterStatus !== 'UPLOADED') {
      await _notifyMediaForPoster(eventData);
    }
    return;
  }

  // HOD APPROVED → PENDING_DEPARTMENTS or PENDING_IQAC
  if (previousStatus === 'PENDING_HOD' &&
      (newStatus === 'PENDING_DEPARTMENTS' || newStatus === 'PENDING_IQAC')) {

    // Notify media team for poster if requested and not already uploaded
    if (eventData.posterWorkflow?.requested && eventData.posterStatus !== 'UPLOADED') {
      await _notifyMediaForPoster(eventData);
    }

    if (newStatus === 'PENDING_DEPARTMENTS') {
      await _notifyRequiredDepartments(eventData);
    } else {
      // Auto-advanced past departments → go straight to IQAC
      await notifyRole('IQAC_TEAM', eventData);
    }
    return;
  }

  // DEPARTMENT APPROVED (Intermediate)
  if (newStatus === 'DEPARTMENT_APPROVED') {
    // Organizer is already notified by the top block.
    return;
  }

  // ALL DEPARTMENTS APPROVED → notify IQAC
  if (newStatus === 'PENDING_IQAC' && (previousStatus === 'PENDING_DEPARTMENTS' || previousStatus === 'DEPARTMENT_APPROVED')) {
    await notifyRole('IQAC_TEAM', eventData);
    return;
  }

  // IQAC APPROVED → POSTED
  if (newStatus === 'POSTED') {
    // Organizer already notified above — nothing extra needed here
    return;
  }

  // EVENT COMPLETED → notify organizer for IQAC report + students for feedback
  if (newStatus === 'COMPLETED') {
    await safeSend(
      'IQAC submission request to organizer',
      eventData.organizerEmail,
      () => sendIQACSubmissionRequestEmail(eventData.organizerEmail, eventData)
    );
    await _sendFeedbackToStudents(eventData);
    return;
  }

  // REJECTED at any stage
  if (newStatus === 'REJECTED') {
    // Organizer already notified via the generic notifier at the top
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private sub-handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify the Media team to create a poster for this event.
 */
async function _notifyMediaForPoster(eventData) {
  const mediaEmails = await getEmailsByRole('MEDIA');
  if (mediaEmails.length === 0) {
    console.warn('[EMAIL_HANDLER] No MEDIA emails found for poster request.');
    return;
  }
  console.log(`[LEGACY_DISABLED] Poster request email to Media disabled per 23-template whitelist (In-App only).`);
}

/**
 * Notify all required department teams based on event logistics.
 */
async function _notifyRequiredDepartments(eventData) {
  const reqs = eventData.requisition?.step1?.requirements || {};
  const isRequired = (k) => reqs[k] ?? eventData[k] ?? false;

  const rolesToNotify = [];
  if (isRequired('venueRequired'))     rolesToNotify.push('HR_TEAM');        // venue via HR
  if (isRequired('audioRequired'))     rolesToNotify.push('AUDIO_TEAM');
  if (isRequired('ictsRequired'))      rolesToNotify.push('SYSTEM_ADMIN');
  if (isRequired('transportRequired')) rolesToNotify.push('TRANSPORT_TEAM');
  if (isRequired('mediaRequired'))     rolesToNotify.push('MEDIA');

  // Accommodation → warden(s)
  if (isRequired('accommodationDiningRequired') || isRequired('accommodationRequired')) {
    const accom = eventData.requisition?.annexureV_accommodation || {};
    const males   = Number(accom.maleGuests   || 0);
    const females = Number(accom.femaleGuests  || 0);
    if (males   > 0) rolesToNotify.push('BOYS_WARDEN');
    if (females > 0) rolesToNotify.push('GIRLS_WARDEN');
    if (males === 0 && females === 0) rolesToNotify.push('BOYS_WARDEN'); // fallback
  }

  if (rolesToNotify.length === 0) {
    console.log('[EMAIL_HANDLER] No department teams required for event ' + (eventData.id || ''));
    return;
  }

  console.log('[EMAIL_HANDLER] Notifying departments: ' + rolesToNotify.join(', '));
  for (const role of rolesToNotify) {
    await notifyRole(role, eventData);
  }
}

/**
 * Send post-event feedback emails to all approved students.
 */
async function _sendFeedbackToStudents(eventData) {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, 'odRequests'));
    const approved = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.eventId === eventData.id && r.status === 'APPROVED' && isValidEmail(r.email));

    if (approved.length === 0) {
      console.log('[EMAIL_HANDLER] No approved students found for feedback: ' + (eventData.id || ''));
      return;
    }

    console.log(`[LEGACY_DISABLED] Feedback request emails to ${approved.length} students disabled per 23-template whitelist (In-App only).`);
  } catch (err) {
    console.error('[EMAIL_HANDLER] Failed to send feedback emails: ' + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OD / Registration email handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle student OD registration status change.
 *
 * @param {Object} odRequest   – OD request document data
 * @param {string} newStatus   – 'APPROVED' | 'REJECTED'
 * @param {string|null} odLetterBase64 – Base64 PDF data if approved
 */
async function handleODStatusChange(odRequest, newStatus, odLetterBase64 = null) {
  const studentEmail = odRequest.email;
  const studentInfo  = {
    name: odRequest.studentName || 'Student',
    rollNo: normalizeRollNo(odRequest.rollNo || odRequest.studentId),
    department: odRequest.department || odRequest.class || 'N/A'
  };
  const eventData    = {
    id:    odRequest.eventId,
    title: odRequest.eventTitle || 'Event',
  };

  console.log(
    '\n[EMAIL_TRIGGER] OD Status ─────────────────────────────────\n' +
    '  OD ID   : ' + (odRequest.id || '(unknown)') + '\n' +
    '  Student : ' + studentInfo.name + ' <' + studentEmail + '>\n' +
    '  Event   : ' + eventData.title + '\n' +
    '  Status  : → ' + newStatus + '\n' +
    '  OD PDF  : ' + (odLetterBase64 ? 'YES (attached)' : 'NO') + '\n' +
    '──────────────────────────────────────────────────────────'
  );

  console.log(`[LEGACY_DISABLED] Student registration status email disabled per 23-template whitelist (WhatsApp + In-App only. Status: ${newStatus}).`);
}

// ─────────────────────────────────────────────────────────────────────────────
// IQAC extension handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify all HODs that an organizer has requested an IQAC extension.
 */
async function handleIQACExtensionRequest(eventData, reason) {
  console.log('[EMAIL_TRIGGER] IQAC extension requested — Event: ' + (eventData.id || ''));
  const iqacEmails = await getEmailsByRole('IQAC_TEAM');
  await Promise.allSettled(
    iqacEmails.map(email =>
      safeSend('IQAC extension request to IQAC', email, () =>
        sendIQACExtensionRequestEmail(email, eventData, reason)
      )
    )
  );
}

/**
 * Notify organizer of HOD's decision on IQAC extension.
 */
async function handleIQACExtensionDecision(eventData, isApproved) {
  const label = isApproved ? 'APPROVED' : 'REJECTED';
  console.log('[EMAIL_TRIGGER] IQAC extension ' + label + ' — Event: ' + (eventData.id || ''));
  await safeSend(
    'IQAC extension ' + label + ' to organizer',
    eventData.organizerEmail,
    () => sendIQACExtensionStatusEmail(eventData.organizerEmail, eventData, isApproved)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Emergency Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleEventCancelled(eventData) {
  const eventId = eventData.id || '(unknown)';
  console.log('[EMAIL_TRIGGER] Event CANCELLED: ' + eventId);

  // 1. Fetch only APPROVED students
  const studentEmails = new Set();
  try {
    const snap = await getDocs(query(collection(db, 'odRequests'), where('eventId', '==', eventId), where('status', '==', 'APPROVED')));
    snap.docs.forEach(d => {
      const student = d.data();
      if (isValidEmail(student.email)) {
        studentEmails.add(student.email.toLowerCase());
      }
    });
  } catch (err) {
    console.warn('[EMAIL_HANDLER] Could not fetch OD requests for cancellation emails', err.message);
  }

  // Send Template #14 to students
  await Promise.allSettled(Array.from(studentEmails).map(email =>
    safeSend('Cancellation Notice to student ' + email, email, () =>
      sendCancellationApprovedEmail(email, eventData, 'Student')
    )
  ));

  // 2. Notify Staff (Organizer, HOD, IQAC, etc.)
  const staffEmails = new Set();
  if (isValidEmail(eventData.organizerEmail)) staffEmails.add(eventData.organizerEmail.toLowerCase());
  const facultyEmail = eventData.coordinator?.facultyEmail || eventData.facultyEmail;
  if (isValidEmail(facultyEmail)) staffEmails.add(facultyEmail.toLowerCase());

  const rolesToNotify = ['HOD', 'IQAC_TEAM'];
  const reqs = eventData.requisition?.step1?.requirements || {};
  const isRequired = (k) => reqs[k] ?? eventData[k] ?? false;
  
  if (isRequired('venueRequired'))     rolesToNotify.push('HR_TEAM');
  if (isRequired('audioRequired'))     rolesToNotify.push('AUDIO_TEAM');
  if (isRequired('ictsRequired'))      rolesToNotify.push('SYSTEM_ADMIN');
  if (isRequired('transportRequired')) rolesToNotify.push('TRANSPORT_TEAM');
  if (isRequired('accommodationDiningRequired') || isRequired('accommodationRequired')) {
    const accom = eventData.requisition?.annexureV_accommodation || {};
    const males   = Number(accom.maleGuests   || 0);
    const females = Number(accom.femaleGuests  || 0);
    if (males > 0 || (males === 0 && females === 0)) rolesToNotify.push('BOYS_WARDEN');
    if (females > 0) rolesToNotify.push('GIRLS_WARDEN');
  }

  for (const role of rolesToNotify) {
    const roleEmails = await getEmailsByRole(role);
    roleEmails.forEach(e => staffEmails.add(e.toLowerCase()));
  }

  await Promise.allSettled(Array.from(staffEmails).map(email => 
    safeSend('Cancellation Notice to staff ' + email, email, () => sendCancellationApprovedEmail(email, eventData, 'Staff / Approver'))
  ));
}

async function handleEventPostponed(eventData) {
  const eventId = eventData.id || '(unknown)';
  console.log('[EMAIL_TRIGGER] Event POSTPONED: ' + eventId);

  // 1. Fetch only APPROVED students
  const studentEmails = new Set();
  try {
    const snap = await getDocs(query(collection(db, 'odRequests'), where('eventId', '==', eventId), where('status', '==', 'APPROVED')));
    snap.docs.forEach(d => {
      const student = d.data();
      if (isValidEmail(student.email)) {
        studentEmails.add(student.email.toLowerCase());
      }
    });
  } catch (err) {
    console.warn('[EMAIL_HANDLER] Could not fetch OD requests for postponement emails', err.message);
  }

  // Send Template #10 to students
  await Promise.allSettled(Array.from(studentEmails).map(email =>
    safeSend('Postponement Notice to student ' + email, email, () =>
      sendPostponementApprovedEmail(email, eventData, 'Student')
    )
  ));

  // 2. Notify Staff (Organizer, HOD, IQAC, etc.)
  const staffEmails = new Set();
  if (isValidEmail(eventData.organizerEmail)) staffEmails.add(eventData.organizerEmail.toLowerCase());
  const facultyEmail = eventData.coordinator?.facultyEmail || eventData.facultyEmail;
  if (isValidEmail(facultyEmail)) staffEmails.add(facultyEmail.toLowerCase());

  const rolesToNotify = ['HOD', 'IQAC_TEAM'];
  const reqs = eventData.requisition?.step1?.requirements || {};
  const isRequired = (k) => reqs[k] ?? eventData[k] ?? false;
  
  if (isRequired('venueRequired'))     rolesToNotify.push('HR_TEAM');
  if (isRequired('audioRequired'))     rolesToNotify.push('AUDIO_TEAM');
  if (isRequired('ictsRequired'))      rolesToNotify.push('SYSTEM_ADMIN');
  if (isRequired('transportRequired')) rolesToNotify.push('TRANSPORT_TEAM');
  if (isRequired('accommodationDiningRequired') || isRequired('accommodationRequired')) {
    const accom = eventData.requisition?.annexureV_accommodation || {};
    const males   = Number(accom.maleGuests   || 0);
    const females = Number(accom.femaleGuests  || 0);
    if (males > 0 || (males === 0 && females === 0)) rolesToNotify.push('BOYS_WARDEN');
    if (females > 0) rolesToNotify.push('GIRLS_WARDEN');
  }

  for (const role of rolesToNotify) {
    const roleEmails = await getEmailsByRole(role);
    roleEmails.forEach(e => staffEmails.add(e.toLowerCase()));
  }

  await Promise.allSettled(Array.from(staffEmails).map(email => 
    safeSend('Postponement Notice to staff ' + email, email, () => sendPostponementApprovedEmail(email, eventData, 'Staff / Approver'))
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW WHITELISTED HANDLERS (#2–#4, #8–#15)
// ─────────────────────────────────────────────────────────────────────────────

// TTL-based dedup: key → expiry timestamp (ms). Prevents same notification within 30 min.
const _notifiedManagersMap = new Map();
const _MANAGER_DEDUP_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Look up a userId by email across students (collectionGroup) and staffs.
 * Returns null if not found.
 */
async function _getUserIdByEmail(email) {
  try {
    // Try students members collectionGroup first
    const studentSnap = await getDocs(
      query(collectionGroup(db, 'members'), where('email', '==', email))
    );
    if (!studentSnap.empty) return studentSnap.docs[0].id;
  } catch (_) {}

  try {
    // Try staff docs — structure: { staffs: [{id, email, ...}] }
    const staffDocs = await getAllStaffDocs();
    for (const sDoc of staffDocs) {
      const list = Array.isArray(sDoc.data?.staffs) ? sDoc.data.staffs : [];
      const match = list.find(m => m && (m.email || '').toLowerCase() === email);
      if (match && match.id) return match.id;
    }
  } catch (_) {}

  return null;
}

async function notifyManagersAssigned(eventData, newManagers = [], oldManagers = []) {
  if (!Array.isArray(newManagers) || newManagers.length === 0) return;
  const oldEmails = new Set((oldManagers || []).map(m => typeof m === 'string' ? m.toLowerCase() : (m.email || '').toLowerCase()));
  
  const emailsToSend = [];
  const validManagers = [];

  for (const mgr of newManagers) {
    const email = typeof mgr === 'string' ? mgr : mgr.email;
    if (!isValidEmail(email)) continue;
    const cleanEmail = email.toLowerCase();
    
    // Do NOT resend if manager assignment remains unchanged during a normal event update
    if (oldEmails.has(cleanEmail)) continue;

    const dedupKey = `mgr_assign_${eventData.id || eventData.title}_${cleanEmail}`;
    const expiry = _notifiedManagersMap.get(dedupKey);
    if (expiry && Date.now() < expiry) continue;
    _notifiedManagersMap.set(dedupKey, Date.now() + _MANAGER_DEDUP_TTL_MS);

    emailsToSend.push(cleanEmail);
    validManagers.push({ mgr, cleanEmail });
  }

  if (emailsToSend.length > 0) {
    await safeSend('Bulk manager assignment', emailsToSend.join(', '), () =>
      sendBulkManagerAssignmentEmail(emailsToSend, eventData)
    );
  }

  for (const { mgr, cleanEmail } of validManagers) {
    // Also write an in-app notification so it appears in the Notification Center
    try {
      const recipientId = (typeof mgr === 'object' && (mgr.userId || mgr.id))
        || await _getUserIdByEmail(cleanEmail);
      if (recipientId) {
        const notifId = `mgr_invite_${eventData.id || eventData.title}_${recipientId}_${Date.now()}`;
        await setDoc(doc(db, 'notifications', notifId), {
          recipientId: String(recipientId),
          type: 'MANAGER_INVITATION',
          category: 'EVENT',
          priority: 'HIGH',
          title: 'Event Manager Assignment',
          message: `You have been assigned as Event Manager for "${eventData.title || eventData.requisition?.step1?.eventTitle || 'an event'}". Please log in to accept or decline.`,
          eventId: eventData.id || null,
          eventTitle: eventData.title || eventData.requisition?.step1?.eventTitle || '',
          status: NOTIFICATION_STATUS.DELIVERED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch (notifErr) {
      console.error('[emailHandler] Failed to write in-app manager notification:', notifErr.message);
    }
  }
}

async function handleModificationRequestSubmitted(eventData, type, status, reason, newDate = null) {
  if (type === 'POSTPONE') {
    if (status === 'PENDING_HOD') {
      const hodEmails = await getEmailsByRole('HOD');
      await Promise.allSettled(hodEmails.map(email =>
        safeSend('Postponement approval request to HOD', email, () => sendPostponementApprovalRequestEmail(email, eventData, reason, newDate))
      ));
    } else if (status === 'PENDING_IQAC') {
      const iqacEmails = await getEmailsByRole('IQAC_TEAM');
      await Promise.allSettled(iqacEmails.map(email =>
        safeSend('Postponement approval request to IQAC', email, () => sendPostponementRequestToIQACEmail(email, eventData, reason, newDate))
      ));
    }
  } else if (type === 'CANCEL') {
    if (status === 'PENDING_HOD') {
      const hodEmails = await getEmailsByRole('HOD');
      await Promise.allSettled(hodEmails.map(email =>
        safeSend('Cancellation approval request to HOD', email, () => sendCancellationApprovalRequestEmail(email, eventData, reason))
      ));
    } else if (status === 'PENDING_IQAC') {
      const iqacEmails = await getEmailsByRole('IQAC_TEAM');
      await Promise.allSettled(iqacEmails.map(email =>
        safeSend('Cancellation approval request to IQAC', email, () => sendCancellationRequestToIQACEmail(email, eventData, reason))
      ));
    }
  }
}

async function handleModificationRequestDecision(eventData, type, isApproved, reason) {
  if (!isApproved && isValidEmail(eventData.organizerEmail)) {
    if (type === 'POSTPONE') {
      await safeSend('Postponement rejected to organizer', eventData.organizerEmail, () =>
        sendPostponementRejectedEmail(eventData.organizerEmail, eventData, reason)
      );
    } else if (type === 'CANCEL') {
      await safeSend('Cancellation rejected to organizer', eventData.organizerEmail, () =>
        sendCancellationRejectedEmail(eventData.organizerEmail, eventData, reason)
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  handleEventStatusChange,
  handleODStatusChange,
  handleIQACExtensionRequest,
  handleIQACExtensionDecision,
  handleEventCancelled,
  handleEventPostponed,
  notifyManagersAssigned,
  handleModificationRequestSubmitted,
  handleModificationRequestDecision,
  isValidEmail,
  getEmailsByRole,
  executeBackgroundNotification,
};
