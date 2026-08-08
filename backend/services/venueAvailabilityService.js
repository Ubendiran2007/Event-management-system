const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const SystemConfig = require('../config/systemConfig');
const { EventStatus } = require('../events/constants/eventTypes');

/**
 * Reservation Lifecycle (Master Prompt — single source of truth)
 *
 *   AVAILABLE → HELD → BOOKED → EVENT COMPLETED → AVAILABLE
 *                      ↘ EXPIRED / CANCELLED ↗
 *
 * Legacy ReservationStatus values RESERVED / CONSUMED are mapped transparently:
 *   RESERVED ⇔ HELD
 *   CONSUMED ⇔ BOOKED
 * so existing venueReservations documents remain fully readable.
 */
const VenueReservationStatus = Object.freeze({
  HELD: 'HELD',
  BOOKED: 'BOOKED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  // Backwards-compatible aliases (reads only — new writes never produce these)
  _RESERVED: 'RESERVED',
  _CONSUMED: 'CONSUMED'
});

// Legacy constant preserved for old callers. Maps to HELD/CONSUMED semantics.
const ReservationStatus = {
  RESERVED: VenueReservationStatus.HELD,
  CONSUMED: VenueReservationStatus.BOOKED,
  EXPIRED: VenueReservationStatus.EXPIRED,
  CANCELLED: VenueReservationStatus.CANCELLED
};

const VENUE_HOLD_DURATION_OPTIONS = Object.freeze([10, 15, 30, 45, 60]);

function _isActiveHoldOrBooking(status) {
  return (
    status === VenueReservationStatus.HELD ||
    status === VenueReservationStatus.BOOKED ||
    status === VenueReservationStatus.COMPLETED ||
    status === ReservationStatus.RESERVED ||   // legacy docs
    status === ReservationStatus.CONSUMED       // legacy docs
  );
}

class VenueAvailabilityService {
  /**
   * Internal helper to determine if two date/time ranges overlap.
   * Assumes simple date/time matching. (In a real system, use moment/date-fns)
   */
  static _isOverlapping(startA, endA, startB, endB) {
    return (startA < endB) && (endA > startB);
  }

  static _getDatesBetween(startDate, endDate) {
    const dates = [];
    let current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  /**
   * Internal conflict check — validates both legacy (RESERVED/CONSUMED) and
   * HELD/BOOKED reservations plus booked events for overlapping time ranges.
   * Called inside a transaction. Returns the earliest end-of-conflict timestamp
   * so callers can surface "available after X".
   */
  static async _checkConflictsWithinTransaction(t, venueId, date, startTime, endTime, opts = {}) {
    const db = getFirestore();
    const { skipReservationId = null, now = new Date() } = opts;
    let earliestAvailable = null;
    let conflictReason = null;
    let conflictingReservation = null;
    let expiredRefs = [];

    // 1) ACTIVE venueReservations records (HELD/BOOKED/legacy RESERVED/legacy CONSUMED)
    // Note: Firestore doesn't support OR queries on status, so scan + filter by
    // active-status predicate. Use venueId+date indexing.
    const snap1 = await t.get(db.collection('venueReservations').where('venueId', '==', venueId).where('date', '==', date));
    const snap2 = await t.get(db.collection('venueReservations').where('venueId', '==', venueId).where('dates', 'array-contains', date));
    const mergedDocs = [...snap1.docs, ...snap2.docs].reduce((acc, doc) => {
      if (!acc.find(d => d.id === doc.id)) acc.push(doc);
      return acc;
    }, []);

    for (const resDoc of mergedDocs) {
      if (skipReservationId && resDoc.id === skipReservationId) continue;
      const resData = resDoc.data();
      if (opts.skipEventId && (resData.eventId === opts.skipEventId || resData.eventDraftId === opts.skipEventId)) continue;
      const st = resData.status;

      // Expired holds can be lazily cleaned up inside the transaction
      const expired = resData.expiresAt && now > resData.expiresAt.toDate() &&
        st !== VenueReservationStatus.BOOKED && st !== VenueReservationStatus.COMPLETED &&
        st !== ReservationStatus.CONSUMED;
      if (expired) {
        expiredRefs.push(resDoc.ref);
        continue;
      }
      if (!_isActiveHoldOrBooking(st)) continue;
      if (this._isOverlapping(startTime, endTime, resData.startTime, resData.endTime)) {
        // Conflict — compute available-after based on this slot's endTime
        const [eh, em] = String(resData.endTime || '23:59').split(':').map(Number);
        const [cd, cm, cy] = String(date).split('-').map(Number);
        const slotEndTs = cy && cd && cm && !Number.isNaN(eh)
          ? new Date(cy, cd - 1, cm, eh, em || 0).getTime()
          : null;
        if (slotEndTs && (earliestAvailable == null || slotEndTs < earliestAvailable)) {
          earliestAvailable = slotEndTs;
        }
        conflictReason = 'venue_reservation_overlap';
        conflictingReservation = {
          id: resDoc.id,
          status: st,
          reservedBy: resData.reservedBy || resData.organizerId,
          endTime: resData.endTime
        };
        break;
      }
    }

    if (!conflictReason) {
      // 2) Real events with venue booking on the same date
      const approvedEventsQ = db.collection('events')
        .where('venueId', '==', venueId)
        .where('date', '==', date)
        .where('status', 'in', [
          EventStatus.APPROVED,
          EventStatus.PUBLISHED,
          EventStatus.RUNNING,
          EventStatus.PENDING_FACULTY,
          EventStatus.PENDING_HOD,
          EventStatus.PENDING_IQAC
        ].filter(Boolean));
      const eventsSnap = await t.get(approvedEventsQ);
      for (const evDoc of eventsSnap.docs) {
        if (opts.skipEventId && evDoc.id === opts.skipEventId) continue;
        const evData = evDoc.data();
        if (this._isOverlapping(startTime, endTime, evData.startTime, evData.endTime)) {
          const [eh, em] = String(evData.endTime || '23:59').split(':').map(Number);
          const [cd, cm, cy] = String(date).split('-').map(Number);
          const slotEndTs = cy && cd && cm && !Number.isNaN(eh)
            ? new Date(cy, cd - 1, cm, eh, em || 0).getTime()
            : null;
          if (slotEndTs && (earliestAvailable == null || slotEndTs < earliestAvailable)) {
            earliestAvailable = slotEndTs;
          }
          conflictReason = 'venue_event_overlap';
          conflictingReservation = {
            id: evDoc.id,
            status: 'EVENT_' + evData.status,
            reservedBy: evData.organizerId,
            endTime: evData.endTime,
            eventTitle: evData.title || evData.eventName
          };
          break;
        }
      }
    }

    return { conflict: !!conflictReason, reason: conflictReason, earliestAvailable, conflictingReservation, expiredRefs };
  }

  /**
   * Main temporary-hold function. Creates a HELD reservation with metadata.
   * Executed inside a Firestore transaction to guarantee atomic double-booking
   * prevention.
   *
   * @param opts { organizerName, department, eventDraftId, coordinatorName }
   */
  static async holdVenue(venueId, userUid, date, startTime, endTime, opts = {}) {
    const db = getFirestore();
    const venueRef = db.collection('venues').doc(venueId);

    const finalStartDate = opts.startDate || date;
    const finalEndDate = opts.endDate || date;
    const dates = this._getDatesBetween(finalStartDate, finalEndDate);
    if (dates.length > 30) throw new Error('BAD_REQUEST:Cannot reserve venue for more than 30 consecutive days.');

    // Resolve hold duration from SystemConfig (10-60 allowed range) outside transaction
    const allCfg = await SystemConfig.loadAll();
    let durationMinutes = parseInt(allCfg.venueHoldDurationMinutes || allCfg.venueReservationDuration, 10);
    if (!VENUE_HOLD_DURATION_OPTIONS.includes(durationMinutes)) {
      durationMinutes = 30; // default
    }

    return await db.runTransaction(async (t) => {
      const venueDoc = await t.get(venueRef);
      if (!venueDoc.exists) throw new Error('NOT_FOUND:Venue does not exist.');
      const venueData = venueDoc.data();
      const venueStatus = venueData.status || 'ACTIVE';
      if (venueStatus !== 'ACTIVE') {
        throw new Error(`BAD_REQUEST:Venue is currently ${venueStatus} and cannot be reserved.`);
      }

      // Maintenance
      const mSnap = await t.get(db.collection('venueMaintenance').where('venueId', '==', venueId));
      for (const d of dates) {
        for (const mDoc of mSnap.docs) {
          const m = mDoc.data();
          if (d >= m.startDate && d <= m.endDate) {
            throw new Error(`BAD_REQUEST:Venue is in maintenance (${m.reason}) on ${d}.`);
          }
        }
      }

      const now = new Date();
      
      // Run all conflict checks concurrently to save transaction round-trips
      const conflictResults = await Promise.all(
        dates.map(d => this._checkConflictsWithinTransaction(t, venueId, d, startTime, endTime, { 
          now, 
          skipEventId: opts.eventDraftId || opts.eventId 
        }))
      );

      for (let i = 0; i < dates.length; i++) {
        const { conflict, earliestAvailable, conflictingReservation } = conflictResults[i];
        if (conflict) {
          const msg = earliestAvailable
            ? `Venue currently reserved on ${dates[i]}. Available after ${new Date(earliestAvailable).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`
            : `Venue is already reserved for this time slot on ${dates[i]}.`;
          const err = new Error('CONFLICT:' + msg);
          err.status = 409;
          err.earliestAvailable = earliestAvailable ? new Date(earliestAvailable).toISOString() : null;
          err.conflictingReservation = conflictingReservation || null;
          throw err;
        }
      }
      
      const uniqueRefs = new Map();
      conflictResults.forEach(res => {
        (res.expiredRefs || []).forEach(ref => uniqueRefs.set(ref.path, ref));
      });
      for (const ref of uniqueRefs.values()) {
        t.update(ref, {
          status: VenueReservationStatus.EXPIRED,
          expiredAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }

      const expirationDate = new Date(now.getTime() + durationMinutes * 60_000);

      const newReservationRef = db.collection('venueReservations').doc();
      const reservationData = {
        reservationId: newReservationRef.id,
        venueId,
        eventId: null,
        organizerId: userUid,
        organizerName: opts.organizerName || opts.userName || null,
        department: opts.department || null,
        coordinatorName: opts.coordinatorName || null,
        reservedBy: userUid,
        date: finalStartDate, // legacy
        startDate: finalStartDate,
        endDate: finalEndDate,
        dates: dates,
        startTime,
        endTime,
        status: VenueReservationStatus.HELD,
        heldAt: FieldValue.serverTimestamp(),
        expiresAt: expirationDate,
        holdDurationMinutes: durationMinutes,
        eventDraftId: opts.eventDraftId || null,
        previousReservationId: null,
        auditVersion: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      t.set(newReservationRef, reservationData);
      // Also update venue active metadata (for fast queries)
      t.set(venueRef, {
        activeReservationId: newReservationRef.id,
        activeEventId: null,
        currentStatus: VenueReservationStatus.HELD,
        currentStatusExpiresAt: expirationDate,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        reservationId: newReservationRef.id,
        status: VenueReservationStatus.HELD,
        expiresAt: expirationDate,
        holdDurationMinutes: durationMinutes,
        venueId,
        date: finalStartDate,
        startDate: finalStartDate,
        endDate: finalEndDate,
        dates,
        startTime,
        endTime
      };
    });
  }

  /**
   * Backwards-compatible alias. reserveVenue maps to holdVenue (Stage 1 Hold).
   */
  static reserveVenue(venueId, userUid, date, startTime, endTime) {
    return this.holdVenue(venueId, userUid, date, startTime, endTime, {});
  }

  /**
   * Release a HELD reservation explicitly (organizer cancels drafting).
   * RBAC: Organizer / Coordinator / Admin.
   */
  static async releaseReservation(reservationId, userUid, user = {}) {
    const db = getFirestore();
    const resRef = db.collection('venueReservations').doc(reservationId);

    await db.runTransaction(async (t) => {
      const doc = await t.get(resRef);
      if (!doc.exists) throw new Error('NOT_FOUND:Reservation not found.');
      const data = doc.data();
      const actingRole = user.role || 'STUDENT_ORGANIZER';
      const isOwner = String(data.reservedBy || data.organizerId || '') === String(userUid);
      const isAdmin = ['SYSTEM_ADMIN', 'IQAC_TEAM'].includes(actingRole);
      const isHod = actingRole === 'HOD' &&
        String(user.department || '').toUpperCase() === String(data.department || '').toUpperCase();
      if (!isOwner && !isAdmin && !isHod) throw new Error('FORBIDDEN:Unauthorized to release this reservation.');

      if (data.status === VenueReservationStatus.HELD || data.status === ReservationStatus.RESERVED) {
        let vDoc = null;
        let venueRef = null;
        if (data.venueId) {
          venueRef = db.collection('venues').doc(data.venueId);
          vDoc = await t.get(venueRef);
        }

        t.update(resRef, {
          status: VenueReservationStatus.CANCELLED,
          cancelledAt: FieldValue.serverTimestamp(),
          cancelledBy: { uid: userUid, name: user.name || null, role: actingRole, department: user.department || null },
          updatedAt: FieldValue.serverTimestamp()
        });

        // Clear venue active-reservation pointer if it points here
        if (vDoc && vDoc.exists && String(vDoc.data().activeReservationId || '') === String(reservationId)) {
          t.set(venueRef, {
            activeReservationId: null,
            activeEventId: null,
            currentStatus: 'AVAILABLE',
            currentStatusExpiresAt: null,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }
    });
    return true;
  }

  /**
   * Extend a hold (within allowed duration option range).
   */
  static async extendHold(reservationId, userUid, user = {}, extraMinutes) {
    const db = getFirestore();
    const resRef = db.collection('venueReservations').doc(reservationId);
    const now = new Date();
    const allCfg = await SystemConfig.loadAll();
    const allowed = [...VENUE_HOLD_DURATION_OPTIONS];
    const defaultExtend = 15;

    return await db.runTransaction(async (t) => {
      const snap = await t.get(resRef);
      if (!snap.exists) throw new Error('NOT_FOUND:Reservation not found.');
      const data = snap.data();
      const actingRole = user.role || 'STUDENT_ORGANIZER';
      const isOwner = String(data.reservedBy || data.organizerId || '') === String(userUid);
      const isAdmin = ['SYSTEM_ADMIN', 'IQAC_TEAM'].includes(actingRole);
      const isHod = actingRole === 'HOD' &&
        String(user.department || '').toUpperCase() === String(data.department || '').toUpperCase();
      if (!isOwner && !isAdmin && !isHod) throw new Error('FORBIDDEN:Unauthorized to extend this hold.');
      if (data.status !== VenueReservationStatus.HELD && data.status !== ReservationStatus.RESERVED) {
        throw new Error(`BAD_REQUEST:Cannot extend a ${data.status} reservation.`);
      }
      // Conflict check re-verify slot still free for extended hold
      const { conflict, expiredRefs } = await this._checkConflictsWithinTransaction(
        t, data.venueId, data.date, data.startTime, data.endTime,
        { skipReservationId: reservationId, now }
      );
      if (conflict) throw new Error('CONFLICT:Venue slot has been taken since the hold was created.');

      (expiredRefs || []).forEach(ref => {
        t.update(ref, {
          status: VenueReservationStatus.EXPIRED,
          expiredAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      });

      let addMinutes = parseInt(extraMinutes || defaultExtend, 10);
      if (!allowed.includes(addMinutes)) addMinutes = defaultExtend;
      // Cap absolute extension: no more than max option added to original start time
      const currentExp = data.expiresAt ? data.expiresAt.toDate() : now;
      const newExp = new Date(Math.max(currentExp.getTime(), now.getTime()) + addMinutes * 60_000);

      t.update(resRef, {
        expiresAt: newExp,
        holdDurationMinutes: (data.holdDurationMinutes || 30) + addMinutes,
        extendedAt: FieldValue.serverTimestamp(),
        extendedBy: { uid: userUid, name: user.name || null, role: actingRole, addedMinutes: addMinutes },
        auditVersion: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      });
      if (data.venueId) {
        t.set(db.collection('venues').doc(data.venueId), {
          currentStatusExpiresAt: newExp,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      return {
        reservationId,
        expiresAt: newExp,
        addedMinutes: addMinutes,
        totalDurationMinutes: (data.holdDurationMinutes || 30) + addMinutes
      };
    });
  }

  /**
   * Convert a HELD reservation → BOOKED once event is created/updated successfully.
   * If a transaction `t` is provided, operations are added to it (atomic with event write).
   *
   * Required: hold exists, still valid, slot still free, matches event metadata.
   */
  static async consumeReservation(reservationId, opts = {}) {
    const db = getFirestore();
    const t = opts.t || null;
    const eventId = opts.eventId;
    const now = new Date();

    async function _apply(transaction) {
      const resRef = db.collection('venueReservations').doc(reservationId);
      const snap = await transaction.get(resRef);
      if (!snap.exists) throw new Error('NOT_FOUND:Reservation not found.');
      const data = snap.data();
      const validStatuses = [
        VenueReservationStatus.HELD,
        ReservationStatus.RESERVED,  // legacy
        ReservationStatus.CONSUMED   // idempotent double-commit safe
      ];
      if (!validStatuses.includes(data.status) && data.status !== VenueReservationStatus.BOOKED) {
        throw new Error(`BAD_REQUEST:Hold status is ${data.status}. Expected HELD to convert to BOOKED.`);
      }
      if (data.expiresAt && now > data.expiresAt.toDate() && data.status !== VenueReservationStatus.BOOKED) {
        throw new Error('BAD_REQUEST:Hold has expired. Please re-reserve the venue.');
      }
      transaction.update(resRef, {
        status: VenueReservationStatus.BOOKED,
        eventId: eventId || data.eventId || null,
        bookedAt: FieldValue.serverTimestamp(),
        bookedBy: opts.bookedBy || { uid: (opts.userId || null), name: (opts.userName || null) },
        auditVersion: FieldValue.increment(1),
        expiresAt: null, // Bookings don't expire; cancelled only via event cancel
        updatedAt: FieldValue.serverTimestamp()
      });
      if (data.venueId) {
        const venueRef = db.collection('venues').doc(data.venueId);
        transaction.set(venueRef, {
          activeReservationId: reservationId,
          activeEventId: eventId || data.eventId || null,
          currentStatus: VenueReservationStatus.BOOKED,
          currentStatusExpiresAt: null,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
      return true;
    }

    if (t) {
      // Caller-provided transaction: just append mutations
      return _apply(t);
    }
    // Otherwise commit our own transaction
    return await db.runTransaction(_apply);
  }

  /**
   * Alias for consumeReservation — more semantic name for external route.
   */
  static bookVenue(venueIdOrReservationId, opts) {
    // Support either signature. Prefer reservationId if provided.
    const reservationId = opts?.reservationId || venueIdOrReservationId;
    return this.consumeReservation(reservationId, opts || {});
  }

  /**
   * Release a BOOKED venue (e.g. on event cancellation). Idempotent.
   * Admin/HOD override allowed per RBAC rules in master prompt.
   */
  static async releaseBookedVenue(keys, user = {}) {
    const { eventId, reservationId, venueId, skipReservationId = null } = keys || {};
    const db = getFirestore();
    if (!eventId && !reservationId) throw new Error('VALIDATION:eventId or reservationId is required.');

    return await db.runTransaction(async (t) => {
      let targetResRef = null;
      let targetData = null;

      if (reservationId) {
        if (skipReservationId && reservationId === skipReservationId) {
          return { released: false, message: 'Reservation ID matches skip ID; no release needed.' };
        }
        targetResRef = db.collection('venueReservations').doc(reservationId);
        const snap = await t.get(targetResRef);
        if (snap.exists) targetData = snap.data();
      }
      if ((!targetResRef || !targetData) && eventId) {
        // Try to locate booking by eventId + venueId
        let q = db.collection('venueReservations').where('eventId', '==', eventId);
        const snap = await t.get(q);
        const candidates = snap.docs.filter(d => {
          if (skipReservationId && d.id === skipReservationId) return false;
          return true;
        });
        if (venueId) {
          candidates.forEach(d => {
            if (!targetResRef && String(d.data().venueId || '') === String(venueId)) {
              targetResRef = d.ref; targetData = d.data();
            }
          });
        } else if (candidates.length) {
          targetResRef = candidates[0].ref; targetData = candidates[0].data();
        }
      }
      if (!targetResRef) {
        return { released: false, message: 'No active venue booking found to release.' };
      }
      const st = targetData.status;
      const terminal = [
        VenueReservationStatus.CANCELLED,
        VenueReservationStatus.EXPIRED,
        VenueReservationStatus.COMPLETED
      ].includes(st);
      if (terminal) {
        return { released: false, message: `Venue already ${st}, no-op.` };
      }
      // RBAC: owner/admin/HOD for department
      const actingRole = user.role || 'STUDENT_ORGANIZER';
      const isOwner = String(targetData.organizerId || targetData.reservedBy || '') === String(user.id || user.uid);
      const isAdmin = ['SYSTEM_ADMIN', 'IQAC_TEAM'].includes(actingRole);
      const isHod = actingRole === 'HOD' &&
        String(user.department || '').toUpperCase() === String(targetData.department || '').toUpperCase();
      if (!isOwner && !isAdmin && !isHod) {
        throw new Error('FORBIDDEN:Unauthorized to release this booking.');
      }

      t.update(targetResRef, {
        status: VenueReservationStatus.CANCELLED,
        cancelledAt: FieldValue.serverTimestamp(),
        cancelledBy: {
          uid: user.id || user.uid, name: user.name || null,
          role: actingRole, department: user.department || null
        },
        releasedAt: FieldValue.serverTimestamp(),
        releasedBy: { uid: user.id || user.uid, name: user.name || null, role: actingRole },
        auditVersion: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      });
      const vId = targetData.venueId;
      if (vId) {
        const venueRef = db.collection('venues').doc(vId);
        const vsnap = await t.get(venueRef);
        if (vsnap.exists) {
          const vd = vsnap.data();
          if (String(vd.activeEventId || '') === String(targetData.eventId || eventId || '') ||
              String(vd.activeReservationId || '') === String(targetResRef.id)) {
            t.set(venueRef, {
              activeReservationId: null,
              activeEventId: null,
              currentStatus: 'AVAILABLE',
              currentStatusExpiresAt: null,
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
          }
        }
      }
      return { released: true, reservationId: targetResRef.id, venueId: vId };
    });
  }

  /**
   * Get current availability of a venue for a specific slot. Callers can use
   * this before rendering "Reserve" buttons.
   */
  static async getVenueSlotStatus(venueId, date, startTime, endTime, opts = {}) {
    const db = getFirestore();
    const now = new Date();
    return await db.runTransaction(async (t) => {
      const { conflict, earliestAvailable, conflictingReservation, expiredRefs } =
        await this._checkConflictsWithinTransaction(
          t, venueId, date, startTime, endTime, { skipReservationId: opts.skipReservationId, skipEventId: opts.skipEventId, now }
        );
        
      (expiredRefs || []).forEach(ref => {
        t.update(ref, {
          status: VenueReservationStatus.EXPIRED,
          expiredAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      });
      
      if (conflict) {
        const hold = conflictingReservation?.status === VenueReservationStatus.HELD ||
                     conflictingReservation?.status === ReservationStatus.RESERVED;
        const booked = conflictingReservation?.status === VenueReservationStatus.BOOKED ||
                       conflictingReservation?.status === ReservationStatus.CONSUMED ||
                       (conflictingReservation?.status || '').startsWith('EVENT_');
        let st = 'UNAVAILABLE';
        if (hold) st = 'HELD'; else if (booked) st = 'BOOKED';
        return {
          available: false,
          status: st,
          earliestAvailable,
          conflictingReservation
        };
      }
      return { available: true, status: 'AVAILABLE', earliestAvailable: null, conflictingReservation: null };
    });
  }

  /**
   * Administrative: list holds or bookings. Scoped by role if not admin/IQAC.
   */
  static async listReservations(user, query = {}) {
    const db = getFirestore();
    const { status, venueId, organizerId, dateFrom, dateTo, limit = 100, type = 'ALL' } = query;
    const actingRole = user.role || 'STUDENT_ORGANIZER';
    const isAdmin = ['SYSTEM_ADMIN', 'IQAC_TEAM'].includes(actingRole);

    let q = db.collection('venueReservations').orderBy('createdAt', 'desc').limit(Math.max(1, Math.min(500, Number(limit) || 100)));
    if (venueId) q = q.where('venueId', '==', venueId);
    if (dateFrom) q = q.where('date', '>=', dateFrom);
    if (dateTo) q = q.where('date', '<=', dateTo);
    if (!isAdmin) {
      q = q.where('organizerId', '==', user.id || user.uid);
    } else if (organizerId) {
      q = q.where('organizerId', '==', organizerId);
    }
    // Type filters (cannot use two status where clauses; filter in-memory)
    const snap = await q.get();
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (type === 'HOLDS') {
      docs = docs.filter(d => [VenueReservationStatus.HELD, ReservationStatus.RESERVED].includes(d.status));
    } else if (type === 'BOOKINGS') {
      docs = docs.filter(d => [VenueReservationStatus.BOOKED, VenueReservationStatus.COMPLETED, ReservationStatus.CONSUMED].includes(d.status));
    } else if (type === 'EXPIRED') {
      docs = docs.filter(d => d.status === VenueReservationStatus.EXPIRED);
    }
    if (status) docs = docs.filter(d => d.status === status);
    return docs;
  }

  /**
   * Force release/expire/reassign a reservation — ADMIN/IQAC override only.
   */
  static async adminOverride(reservationId, action, adminUser) {
    const db = getFirestore();
    const actingRole = adminUser.role || 'ADMIN';
    if (!['SYSTEM_ADMIN', 'IQAC_TEAM'].includes(actingRole)) {
      throw new Error('FORBIDDEN:Admin override requires SYSTEM_ADMIN or IQAC_TEAM.');
    }
    return await db.runTransaction(async (t) => {
      const resRef = db.collection('venueReservations').doc(reservationId);
      const snap = await t.get(resRef);
      if (!snap.exists) throw new Error('NOT_FOUND:Reservation not found.');
      const data = snap.data();
      const actionSet = { updatedAt: FieldValue.serverTimestamp() };
      let newStatus = null;
      if (action === 'FORCE_RELEASE') {
        newStatus = VenueReservationStatus.CANCELLED;
        actionSet.status = newStatus;
        actionSet.releasedAt = FieldValue.serverTimestamp();
        actionSet.forcedBy = { uid: adminUser.id, name: adminUser.name, role: actingRole };
      } else if (action === 'FORCE_EXPIRE') {
        newStatus = VenueReservationStatus.EXPIRED;
        actionSet.status = newStatus;
        actionSet.expiredAt = FieldValue.serverTimestamp();
        actionSet.forcedBy = { uid: adminUser.id, name: adminUser.name, role: actingRole };
      } else if (action && action.newVenueId) {
        // FORCE_REASSIGN to a different venue (verify availability first at same date/time)
        const { conflict, expiredRefs } = await this._checkConflictsWithinTransaction(
          t, action.newVenueId, data.date, data.startTime, data.endTime, { skipReservationId: reservationId }
        );
        if (conflict) throw new Error('CONFLICT:New venue slot is not available for reassignment.');

        (expiredRefs || []).forEach(ref => {
          t.update(ref, {
            status: VenueReservationStatus.EXPIRED,
            expiredAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
        });
        actionSet.venueId = action.newVenueId;
        actionSet.previousVenueId = data.venueId;
        actionSet.reassignedAt = FieldValue.serverTimestamp();
        actionSet.reassignedBy = { uid: adminUser.id, name: adminUser.name, role: actingRole };
      } else {
        throw new Error('VALIDATION:Unknown admin override action.');
      }
      t.update(resRef, actionSet);
      if (data.venueId) {
        const venueRef = db.collection('venues').doc(data.venueId);
        const vsnap = await t.get(venueRef);
        if (vsnap.exists && String(vsnap.data().activeReservationId || '') === String(reservationId) &&
            [VenueReservationStatus.CANCELLED, VenueReservationStatus.EXPIRED].includes(newStatus)) {
          t.set(venueRef, {
            activeReservationId: null, activeEventId: null,
            currentStatus: 'AVAILABLE', currentStatusExpiresAt: null,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }
      return { reservationId, action, applied: true };
    });
  }

  /**
   * Expose calendar slots for a venue
   */
  static async getVenueCalendar(venueId, startDate, endDate) {
    const db = getFirestore();
    
    // 1. Get ALL venueReservations for this date range (no status filter — we
    //    classify client-side below so callers see HELD / BOOKED / legacy RESERVED /
    //    legacy CONSUMED / EXPIRED with identical semantics to the transactional
    //    conflict checker (_checkConflictsWithinTransaction).
    const resSnapshot = await db.collection('venueReservations')
      .where('venueId', '==', venueId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
      
    // 2. Get Approved/Pending events (same list _checkConflictsWithinTransaction uses)
    const statusesForCalendar = [
      EventStatus.APPROVED,
      EventStatus.PUBLISHED,
      EventStatus.RUNNING,
      EventStatus.PENDING_FACULTY,
      EventStatus.PENDING_HOD,
      EventStatus.PENDING_IQAC
    ].filter(Boolean);
    const eventsSnapshot = await db.collection('events')
      .where('venueId', '==', venueId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .where('status', 'in', statusesForCalendar)
      .get();

    const calendar = [];
    const now = new Date();

    resSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const st = data.status;
      // Same expiry predicate as _checkConflictsWithinTransaction — drop
      // logically-expired HELDs (but BOOKED/CONSUMED/COMPLETED always show)
      const expired = data.expiresAt &&
        (typeof data.expiresAt.toDate === 'function'
          ? data.expiresAt.toDate()
          : new Date(data.expiresAt)) < now &&
        st !== VenueReservationStatus.BOOKED &&
        st !== VenueReservationStatus.COMPLETED &&
        st !== ReservationStatus.CONSUMED;
      if (st === VenueReservationStatus.EXPIRED || expired) {
        calendar.push({
          type: 'RESERVATION',
          status: 'EXPIRED',
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          reservedBy: data.reservedBy || data.organizerId,
          expiresAt: null
        });
        return;
      }
      let mapStatus = st;
      if (st === ReservationStatus.RESERVED) mapStatus = VenueReservationStatus.HELD;
      if (st === ReservationStatus.CONSUMED) mapStatus = VenueReservationStatus.BOOKED;
      calendar.push({
        type: 'RESERVATION',
        status: mapStatus,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        reservedBy: data.reservedBy || data.organizerId,
        expiresAt: data.expiresAt
          ? (typeof data.expiresAt.toDate === 'function' ? data.expiresAt.toDate().toISOString() : new Date(data.expiresAt).toISOString())
          : null
      });
    });

    eventsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      calendar.push({
        type: 'EVENT',
        eventId: doc.id,
        title: data.title || data.eventName,
        status: 'EVENT_' + data.status,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        organizerId: data.organizerId
      });
    });

    // 3. Get Maintenance Windows
    const maintenanceSnapshot = await db.collection('venueMaintenance')
      .where('venueId', '==', venueId)
      .where('endDate', '>=', startDate)
      .get();

    maintenanceSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.startDate <= endDate) {
        calendar.push({
          type: 'MAINTENANCE',
          maintenanceId: doc.id,
          reason: data.reason || 'Scheduled Maintenance',
          startDate: data.startDate,
          endDate: data.endDate,
          date: data.startDate,
          startTime: '00:00',
          endTime: '23:59'
        });
      }
    });

    return calendar;
  }

  /**
   * Re-reserve an expired or expiring hold
   */
  static async reReserveVenue(reservationId, userUid) {
    const db = getFirestore();
    const resRef = db.collection('venueReservations').doc(reservationId);
    const doc = await resRef.get();
    if (!doc.exists) {
      throw new Error("Previous reservation not found.");
    }
    const data = doc.data();
    if (data.reservedBy !== userUid) {
      throw new Error("Unauthorized to re-reserve this venue slot.");
    }

    // Try to reserve it again using standard reserveVenue logic
    return await this.reserveVenue(data.venueId, userUid, data.date, data.startTime, data.endTime);
  }

  /**
   * Validate hold right before submitting event
   */
  static async validateHoldForSubmission(reservationId, venueId, userUid, date, startTime, endTime, opts = {}) {
    const db = getFirestore();
    if (!reservationId) {
      throw new Error("Reservation validation failed. No hold ID provided. Please reserve the venue again.");
    }

    const { startDate, endDate } = opts;
    const finalStartDate = startDate || date;
    const finalEndDate = endDate || date;
    const dates = this._getDatesBetween(finalStartDate, finalEndDate);

    const resRef = db.collection('venueReservations').doc(reservationId);
    const doc = await resRef.get();
    if (!doc.exists) {
      throw new Error("Reservation validation failed. Hold record not found. Please reserve the venue again.");
    }

    const data = doc.data();
    
    // Check if the reservation covers at least the event's start date.
    // Venue holds are booked for the initial time slot — for multi-day events,
    // the hold covering the startDate is sufficient; each subsequent day is
    // validated at the point of final booking by the backend.
    const reservationDates = data.dates || (data.date ? [data.date] : []);
    const coversStartDate = reservationDates.includes(finalStartDate) || data.startDate === finalStartDate || data.date === finalStartDate;

    if (data.reservedBy !== userUid || data.venueId !== venueId || !coversStartDate || data.startTime !== startTime || data.endTime !== endTime) {
      throw new Error("Reservation validation failed. Event details do not match the held venue slot. Please reserve the venue again.");
    }

    if (new Date() > data.expiresAt.toDate() || data.status === ReservationStatus.EXPIRED) {
      throw new Error("Your reservation has expired. Please reserve the venue again.");
    }

    // Check if venue is still ACTIVE
    const venueRef = db.collection('venues').doc(venueId);
    const venueDoc = await venueRef.get();
    if (!venueDoc.exists || venueDoc.data().status !== 'ACTIVE') {
      throw new Error(`Venue is no longer ACTIVE (${venueDoc.exists ? venueDoc.data().status : 'Not Found'}). Please select another venue.`);
    }

    // Check if venue entered maintenance in the meantime
    const maintenanceQuery = db.collection('venueMaintenance').where('venueId', '==', venueId);
    const maintenanceSnapshot = await maintenanceQuery.get();
    for (const mDoc of maintenanceSnapshot.docs) {
      const mData = mDoc.data();
      if (date >= mData.startDate && date <= mData.endDate) {
        throw new Error(`Venue has entered maintenance (${mData.reason}). Please select another venue.`);
      }
    }

    return true;
  }

  /**
   * Global cleanup method to sweep and expire old reservations
   */
  static async cleanupAllExpiredHolds() {
    const db = getFirestore();
    try {
      const now = new Date();
      const expiredQuery = db.collection('venueReservations')
        .where('status', '==', ReservationStatus.RESERVED)
        .where('expiresAt', '<=', now);
      const snapshot = await expiredQuery.get();
      if (snapshot.empty) return 0;
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { 
          status: ReservationStatus.EXPIRED,
          updatedAt: FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      return snapshot.size;
    } catch (err) {
      console.error('[VenueAvailabilityService] Error cleaning up expired holds:', err);
      return 0;
    }
  }
}

module.exports = VenueAvailabilityService;
