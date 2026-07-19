const express = require('express');
const {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  runTransaction,
  writeBatch,
  arrayUnion,
  deleteField,
  db
} = require('../firebaseClientWrapper');
const { storageAdmin } = require('../firebaseAdmin');
// Helper to recursively delete a folder in Firebase Storage using Admin SDK
const deleteStorageFolder = async (folderPath) => {
  try {
    const bucket = storageAdmin.bucket();
    await bucket.deleteFiles({ prefix: folderPath });
  } catch (error) {
    if (error.code !== 404) {
      console.error(`[deleteStorageFolder] Error deleting ${folderPath}:`, error.message);
    }
  }
};
const {
  sendEventNotificationToFaculty,
  sendEventStatusNotification,
  sendApprovalRequestToRole,
  sendPosterRequestEmail,
  sendPosterReadyEmail,
} = require('../services/emailService');
const {
  handleEventStatusChange,
  handleIQACExtensionRequest,
  handleIQACExtensionDecision,
  handleEventCancelled,
  handleEventPostponed,
  executeBackgroundNotification
} = require('../services/emailHandler');
const { requireAuth, requireRole, assertDeptMatch } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const crypto = require('crypto');

const router = express.Router();

// â”€â”€ Guard: firebase not ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function checkDb(res) {
  if (!db) {
    res.status(503).json({
      success: false,
      message: 'Firebase is not configured. Add backend/serviceAccountKey.json and restart.',
    });
    return false;
  }
  return true;
}

// ── Helper: Generate IQAC Reference ID ─────────────────────────────────────
async function generateEventReferenceId(department, startDateStr) {
  try {
    const date = new Date(startDateStr || Date.now());
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const acYearStart = month >= 6 ? year : year - 1;
    const acYearEnd = String(acYearStart + 1).slice(-2);
    const acYear = `${acYearStart}-${acYearEnd}`;
    const deptCode = String(department || 'GEN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);

    const counterDocId = `events_${acYear}_${deptCode}`;
    const counterRef = doc(db, 'counters', counterDocId);

    const newSeq = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let seq = 1;
      if (counterDoc.exists()) {
        seq = (counterDoc.data().seq || 0) + 1;
      }
      transaction.set(counterRef, { seq }, { merge: true });
      return seq;
    });

    const paddedSeq = String(newSeq).padStart(2, '0');
    return `IQAC/${acYear}/${deptCode}/${paddedSeq}`;
  } catch (error) {
    console.error('[events] Failed to generate Reference ID:', error.message);
    const randomFallback = Math.floor(Math.random() * 900) + 100;
    return `IQAC/TEMP/${randomFallback}`;
  }
}


// â”€â”€ Helper: Fetch faculty email by name â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Searches "coordinators" collection for matching faculty name
async function getFacultyEmailByName(facultyName) {
  if (!facultyName || !db) {
    return null;
  }

  try {
    const coordinatorsSnapshot = await getDocs(
      query(
        collection(db, 'coordinators'),
        where('name', '==', facultyName),
        limit(1)
      )
    );

    if (!coordinatorsSnapshot.empty) {
      const coordinatorData = coordinatorsSnapshot.docs[0].data();
      return coordinatorData.email || null;
    }

    const usersSnapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('name', '==', facultyName),
        where('role', '==', 'FACULTY'),
        limit(1)
      )
    );

    if (!usersSnapshot.empty) {
      return usersSnapshot.docs[0].data().email || null;
    }

    return null;
  } catch (error) {
    console.warn('[events] Error fetching faculty email:', error.message);
    return null;
  }
}

// â”€â”€ Helper: Fetch official emails by role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getOfficialEmailsByRole(role) {
  if (!role || !db) return [];
  try {
    const usersSnapshot = await getDocs(
      query(collection(db, 'users'), where('role', '==', role))
    );
    return usersSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
  } catch (error) {
    console.warn(`[events] Error fetching ${role} emails:`, error.message);
    return [];
  }
}

// â”€â”€ Helper: Get required departments for an event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getRequiredDepartments(eventData) {
  const reqs = eventData.requisition?.step1?.requirements || {};
  // Backward compatibility if requirements are at root level
  const isRequired = (key) => reqs[key] ?? eventData[key] ?? false;

  const requiredDepts = [];
  if (isRequired('venueRequired')) requiredDepts.push('venue');
  if (isRequired('audioRequired')) requiredDepts.push('audio');
  if (isRequired('ictsRequired')) requiredDepts.push('icts');
  if (isRequired('transportRequired')) requiredDepts.push('transport');
  if (isRequired('mediaRequired')) requiredDepts.push('media');

  if (isRequired('accommodationDiningRequired') || isRequired('accommodationRequired')) {
    const accom = eventData.requisition?.annexureV_accommodation || {};
    const males = Number(accom.maleGuests || 0);
    const females = Number(accom.femaleGuests || 0);

    if (males > 0) requiredDepts.push('boysAccommodation');
    if (females > 0) requiredDepts.push('girlsAccommodation');
    if (males === 0 && females === 0) requiredDepts.push('boysAccommodation'); // fallback
  }
  return requiredDepts;
}

// â”€â”€ POST /api/events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Create a new event (saves to Firestore "events" collection)
router.post('/', async (req, res) => {
  if (!checkDb(res)) return;

  const eventData = req.body;

  if (!eventData || !eventData.title) {
    return res.status(400).json({ success: false, message: 'Event title is required' });
  }

  try {
    const { parseEventStartDateTime } = require('../services/eventAutoRejectionService');
    const startDateTime = parseEventStartDateTime(eventData);
    if (startDateTime) {
      const nowMs = new Date().getTime();
      const startMs = startDateTime.getTime();
      const rejectAtMs = startMs - parseInt(process.env.AUTO_REJECT_BEFORE_START_MINUTES || '5', 10) * 60 * 1000;
      if (nowMs >= rejectAtMs) {
        return res.status(400).json({ success: false, message: 'Cannot create an event that starts in less than 5 minutes or is already in the past.' });
      }
    }

    const startDateTimeStr = eventData.requisition?.step1?.eventStartDate || eventData.date;
    const department = eventData.department || eventData.requisition?.step1?.organizerDetails?.department || 'GEN';
    const referenceId = await generateEventReferenceId(department, startDateTimeStr);

    const payload = {
      ...eventData,
      referenceId,
      status: eventData.status || 'PENDING_FACULTY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let docRef;
    if (eventData.id) {
      docRef = doc(db, 'events', eventData.id);
      await setDoc(docRef, payload);
    } else {
      docRef = await addDoc(collection(db, 'events'), payload);
    }

    // ── Background Notifications (centralized handler) ─────────────────
    const payloadWithId = { id: docRef.id, ...payload };
    executeBackgroundNotification('events/create', async () => {
      // Resolve faculty email if student-created event
      if (payload.status === 'PENDING_FACULTY') {
        let facultyEmail = payload.coordinator?.facultyEmail ||
                           payload.coordinator?.faculty_email ||
                           payload.facultyEmail || null;
        if (typeof facultyEmail === 'string') facultyEmail = facultyEmail.trim().toLowerCase();
        if (!facultyEmail && payload.coordinator?.facultyName) {
          facultyEmail = await getFacultyEmailByName(String(payload.coordinator.facultyName).trim());
        }
        payloadWithId.coordinator = { ...payloadWithId.coordinator, facultyEmail };
      }
      await handleEventStatusChange(payloadWithId, null, payload.status);
    });

    logActivity({
      category: 'EVENT',
      action: 'EVENT_CREATED',
      status: 'SUCCESS',
      correlationId: docRef.id,
      requestId: crypto.randomUUID(),
      actor: {
        userId: eventData.coordinator?.studentEmail || 'UNKNOWN',
        name: eventData.coordinator?.studentName || 'Unknown User',
        role: eventData.role || 'STUDENT'
      },
      target: { entityType: 'EVENT', entityId: docRef.id },
      details: { title: payload.title, status: payload.status }
    });

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: { id: docRef.id, ...payload },
    });
  } catch (error) {
    console.error('[events/create] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create event', error: error.message });
  }
});

// ── GET /api/events ────────────────────────────────────────────────────────
// Get all events. Optional query params:
//   ?status=PENDING_FACULTY   → filter by status
//   ?organizerId=<id>         → filter by organiser
router.get('/', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { status, organizerId } = req.query;
    const constraints = [];

    if (status) constraints.push(where('status', '==', status));
    if (organizerId) constraints.push(where('organizerId', '==', organizerId));

    const snapshot =
      constraints.length > 0
        ? await getDocs(query(collection(db, 'events'), ...constraints))
        : await getDocs(collection(db, 'events'));

    const events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    return res.json({ success: true, count: events.length, events });
  } catch (error) {
    console.error('[events/list] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch events', error: error.message });
  }
});

// ── GET /api/events/:id ─────────────────────────────────────────────────────
// Get a single event by ID
router.get('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const docSnap = await getDoc(doc(db, 'events', req.params.id));

    if (!docSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    return res.json({ success: true, event: { id: docSnap.id, ...docSnap.data() } });
  } catch (error) {
    console.error('[events/get] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch event', error: error.message });
  }
});

// ── PATCH /api/events/:id/status ───────────────────────────────────────────
// Advance or reject an event through the approval chain
// Auth: requireAuth — role & department come ONLY from the verified token.
const STATUS_ALLOWED_ROLES = ['FACULTY', 'HOD', 'IQAC_TEAM', 'SYSTEM_ADMIN'];
router.patch('/:id/status', requireAuth, requireRole(STATUS_ALLOWED_ROLES), async (req, res) => {
  if (!checkDb(res)) return;

  // ⚠️  Role and department are resolved from the verified session token, NOT req.body
  const actingRole = req.user.role;
  const actingDept = req.user.department;
  const actingName = req.user.name;

  const { status } = req.body; // Only status is read from body

  const allowedStatuses = [
    'PENDING_FACULTY',
    'PENDING_HOD',
    'PENDING_DEPARTMENTS',
    'PENDING_IQAC',
    'APPROVED',
    'POSTED',
    'REJECTED',
    'COMPLETED',
  ];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
    });
  }

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const rawEventData = eventSnap.data();

    if (status !== 'REJECTED') {
      const { parseEventStartDateTime } = require('../services/eventAutoRejectionService');
      const startDateTime = parseEventStartDateTime(rawEventData);
      if (startDateTime) {
        const nowMs = new Date().getTime();
        const startMs = startDateTime.getTime();
        const rejectAtMs = startMs - parseInt(process.env.AUTO_REJECT_BEFORE_START_MINUTES || '5', 10) * 60 * 1000;
        if (nowMs >= rejectAtMs) {
          const autoRejectionPayload = {
            status: 'REJECTED',
            updatedAt: new Date().toISOString(),
            autoRejectedAt: new Date().toISOString(),
            autoRejectedBy: 'SYSTEM',
            rejectionReason: `Automatically rejected: action attempted within 5 minutes of event start time.`,
          };
          await updateDoc(eventRef, autoRejectionPayload);

          if (rawEventData.organizerEmail) {
            // Try sending notification but don't fail if it doesn't work
            sendEventStatusNotification(
              rawEventData.organizerEmail,
              { id: eventSnap.id, ...rawEventData, ...autoRejectionPayload },
              'REJECTED'
            ).catch(err => console.error('[events/status] auto-reject email error:', err.message));
          }

          return res.status(400).json({
            success: false,
            message: 'Event has been auto-rejected because it is within 5 minutes of the start time.',
            event: { id: req.params.id, ...rawEventData, ...autoRejectionPayload }
          });
        }
      }
    }

    let finalStatus = status;
    const updatePayload = { status: finalStatus, updatedAt: new Date().toISOString() };
    // approvedBy is set from the verified token identity, not req.body
    const approvedBy = actingName || actingRole;
    updatePayload.approvedBy = approvedBy;

    if (finalStatus === 'REJECTED') {
      const reason = String(req.body.rejectionReason || '').trim();
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is mandatory.',
        });
      }

      // ⚠️ Role comes from token — cannot be spoofed via req.body
      const displayRole = actingRole;
      updatePayload.rejectionReason = reason;
      updatePayload.rejectedByRole = displayRole;
      updatePayload.rejectedByName = actingName || approvedBy || 'Unknown Approver';
      updatePayload.rejectedByDept = actingDept || rawEventData.department || 'N/A';
      updatePayload.rejectedAt = new Date().toISOString();
    }

    // Department isolation: FACULTY and HOD can only act on their own department's events
    if (['FACULTY', 'HOD'].includes(actingRole)) {
      if (!assertDeptMatch(req, rawEventData.department)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: You can only act on events from your department (${actingDept}).`,
        });
      }
    }

    // Workflow guard: enforce correct sequential approval order
    const VALID_TRANSITIONS = {
      FACULTY:    { from: 'PENDING_FACULTY',     to: ['PENDING_HOD', 'REJECTED'] },
      HOD:        { from: 'PENDING_HOD',         to: ['PENDING_DEPARTMENTS', 'REJECTED'] },
      IQAC_TEAM:  { from: 'PENDING_IQAC',        to: ['POSTED', 'REJECTED'] },
    };
    const trans = VALID_TRANSITIONS[actingRole];
    if (trans && rawEventData.status !== trans.from && !trans.to.includes(status)) {
      // Allow system admin to override
      if (actingRole !== 'SYSTEM_ADMIN') {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Event is in status "${rawEventData.status}" — ${actingRole} cannot transition to "${status}" from this state.`,
        });
      }
    }

    // Record timestamped approval for each stage
    const prevStatus = eventSnap.data().status;
    if (finalStatus === 'PENDING_HOD' && prevStatus === 'PENDING_FACULTY') {
      updatePayload.facultyApprovedAt = new Date().toISOString();
      updatePayload.facultyApprovedBy = approvedBy || 'Faculty';
    }
    if (finalStatus === 'PENDING_DEPARTMENTS' && prevStatus === 'PENDING_HOD') {
      updatePayload.hodApprovedAt = new Date().toISOString();
      updatePayload.hodApprovedBy = approvedBy || 'HOD';

      // AUTO-ADVANCE: Skip PENDING_DEPARTMENTS and go to PENDING_IQAC if:
      // - No departments are required
      // - Event is a modification request (POSTPONE or CANCEL)
      // - Event is an IQAC Resubmission
      const requiredDepts = getRequiredDepartments(rawEventData);
      const isModification = !!rawEventData.modificationRequest;
      const isIqacResubmission = rawEventData.iqacResubmission === true;

      if (requiredDepts.length === 0 || isModification || isIqacResubmission) {
        console.log(`[events/status] Bypassing departments for event ${req.params.id}. Auto-advancing to PENDING_IQAC.`);
        finalStatus = 'PENDING_IQAC';
        updatePayload.status = finalStatus;
      }
    }
    if (finalStatus === 'POSTED' && prevStatus === 'PENDING_IQAC') {
      updatePayload.iqacApprovedAt = new Date().toISOString();
      updatePayload.iqacApprovedBy = approvedBy || 'IQAC';

      if (rawEventData.modificationRequest) {
        if (rawEventData.modificationRequest.type === 'CANCEL') {
          finalStatus = 'CANCELLED';
          updatePayload.status = finalStatus;
          updatePayload.cancelledBy = rawEventData.modificationRequest.requestedBy;
          updatePayload.cancelledAt = updatePayload.iqacApprovedAt;
          updatePayload.cancellationReason = rawEventData.modificationRequest.reason;

          const registeredStudents = rawEventData.registeredStudents || [];
          updatePayload.registeredStudents = registeredStudents.map(student => ({
            ...student,
            status: 'REGISTRATION_CANCELLED',
            cancelledReason: 'Event Cancelled'
          }));

          updatePayload.modificationRequest = deleteField();
        } else if (rawEventData.modificationRequest.type === 'POSTPONE') {
          finalStatus = 'POSTPONED';
          updatePayload.status = finalStatus;
          updatePayload.postponedBy = rawEventData.modificationRequest.requestedBy;
          updatePayload.postponedAt = updatePayload.iqacApprovedAt;
          updatePayload.postponementReason = rawEventData.modificationRequest.reason;

          const modReq = rawEventData.modificationRequest;
          updatePayload.oldDate = modReq.oldDate;
          updatePayload.newDate = modReq.newDate;
          updatePayload.oldStartTime = modReq.oldStartTime;
          updatePayload.newStartTime = modReq.newStartTime;
          updatePayload.oldEndTime = modReq.oldEndTime;
          updatePayload.newEndTime = modReq.newEndTime;
          updatePayload.date = modReq.newDate;
          updatePayload.startDate = modReq.newDate;
          updatePayload.endDate = modReq.newEndDate;
          updatePayload.startTime = modReq.newStartTime;
          updatePayload.endTime = modReq.newEndTime;

          if (rawEventData.requisition && rawEventData.requisition.step1) {
            const step1 = { 
              ...rawEventData.requisition.step1, 
              eventStartDate: modReq.newDate, 
              eventEndDate: modReq.newEndDate, 
              eventStartTime: modReq.newStartTime, 
              eventEndTime: modReq.newEndTime 
            };
            updatePayload.requisition = { ...rawEventData.requisition, step1 };
          }

          updatePayload.modificationRequest = deleteField();
        }
      }
    }

    // [MODULE 3] Atomic Write to events and eventApprovalLogs
    // [MODULE 7] Optmistic concurrency control using transactions
    const logRef = doc(collection(db, 'eventApprovalLogs'));
    const legacyAction = {
      status: finalStatus,
      approvedBy,
      role: actingRole,
      timestamp: new Date().toISOString(),
      remarks: finalStatus === 'REJECTED' ? updatePayload.rejectionReason : ''
    };
    updatePayload.eventActions = arrayUnion(legacyAction);

    try {
      await runTransaction(db, async (t) => {
        const snap = await t.get(eventRef);
        if (!snap.exists()) throw new Error('NOT_FOUND: Event not found');
        if (snap.data().status !== prevStatus) {
          throw new Error('CONFLICT: Event state was modified concurrently.');
        }

        t.update(eventRef, updatePayload);
        t.set(logRef, {
          eventId: req.params.id,
          action: finalStatus,
          approvedBy,
          role: actingRole,
          remarks: finalStatus === 'REJECTED' ? updatePayload.rejectionReason : '',
          timestamp: new Date().toISOString()
        });
      });
    } catch (txErr) {
      if (txErr.message.includes('CONFLICT')) {
        return res.status(409).json({ success: false, message: 'Conflict: This event was modified by someone else. Please refresh and try again.' });
      }
      throw txErr;
    }

    logActivity({
      category: 'EVENT',
      action: finalStatus === 'REJECTED' ? 'EVENT_REJECTED' : 'EVENT_APPROVED',
      status: 'SUCCESS',
      correlationId: req.params.id,
      requestId: crypto.randomUUID(),
      actor: {
        userId: req.user?.email || actingName || actingRole,
        name: actingName || 'Unknown Approver',
        role: actingRole
      },
      target: { entityType: 'EVENT', entityId: req.params.id },
      details: { previousStatus: prevStatus, newStatus: finalStatus }
    });

    const eventData = { id: req.params.id, ...eventSnap.data(), ...updatePayload };
    const notificationStatus = finalStatus; // Use the potentially advanced status for notifications

    // Cancel OD Requests if CANCELLED
    if (finalStatus === 'CANCELLED') {
      const odQuery = query(collection(db, 'odRequests'), where('eventId', '==', req.params.id));
      const odSnap = await getDocs(odQuery);
      const updateODPromises = odSnap.docs.map(d => {
        return updateDoc(d.ref, {
          odStatus: 'CANCELLED',
          status: 'OD_CANCELLED',
          updatedAt: new Date().toISOString(),
          reason: 'Event Cancelled'
        });
      });
      await Promise.all(updateODPromises);
    }

    // ── Background Notifications (centralized handler) ──────────────────────
    executeBackgroundNotification('events/status', async () => {
      if (finalStatus === 'CANCELLED') {
        await handleEventCancelled(eventData);
      } else if (finalStatus === 'POSTPONED') {
        await handleEventPostponed(eventData);
      } else {
        await handleEventStatusChange(eventData, prevStatus, notificationStatus);
      }
    });


    return res.json({
      success: true,
      message: `Event status updated to ${status}`,
      event: eventData,
    });
  } catch (error) {
    console.error('[events/status] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update event status', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/department-approval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Approve a specific department requirement
// Body: { department: 'venue' | 'audio' | 'icts' | 'transport' | 'accommodation' | 'media', approvedBy: string }
// Auth: role comes from verified token — not req.body
const DEPT_APPROVAL_ROLES = ['HR_TEAM', 'AUDIO_TEAM', 'SYSTEM_ADMIN', 'TRANSPORT_TEAM', 'BOYS_WARDEN', 'GIRLS_WARDEN', 'MEDIA'];
router.patch('/:id/department-approval', requireAuth, requireRole(DEPT_APPROVAL_ROLES), async (req, res) => {
  if (!checkDb(res)) return;

  const { department, status = 'APPROVED', reason } = req.body;
  // approvedBy resolved from verified token — cannot be spoofed via req.body
  const approvedBy = req.user.name || req.user.role;

  if (!department) {
    return res.status(400).json({ success: false, message: 'Department is required' });
  }


  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const departmentApprovals = eventData.departmentApprovals || {};

    if (status === 'REJECTED') {
      const reasonStr = String(reason || '').trim();
      if (!reasonStr) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is mandatory.',
        });
      }

      departmentApprovals[department] = {
        status: 'REJECTED',
        rejectedBy: approvedBy,
        rejectedAt: new Date().toISOString(),
        reason: reasonStr,
      };

      // Determine clean role and department names for display
      let displayRole = 'Department Officer';
      let displayDept = department.toUpperCase();

      if (department === 'venue') {
        displayRole = 'HR';
        displayDept = 'Venue';
      } else if (department === 'media') {
        displayRole = 'HR';
        displayDept = 'Media';
      } else if (department === 'audio') {
        displayRole = 'Audio';
        displayDept = 'Audio';
      } else if (department === 'icts') {
        displayRole = 'ICTS';
        displayDept = 'ICTS';
      } else if (department === 'transport') {
        displayRole = 'Transport';
        displayDept = 'Transport';
      } else if (department === 'boysAccommodation') {
        displayRole = 'Warden';
        displayDept = 'Boys Hostel';
      } else if (department === 'girlsAccommodation') {
        displayRole = 'Warden';
        displayDept = 'Girls Hostel';
      }

      const updatePayload = {
        departmentApprovals,
        status: 'REJECTED',
        rejectionReason: reasonStr,
        rejectedByRole: displayRole,
        rejectedByName: approvedBy,
        rejectedByDept: displayDept,
        rejectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await updateDoc(eventRef, updatePayload);

      executeBackgroundNotification('events/dept-approval/reject', async () => {
        if (eventData.organizerEmail) {
          await sendEventStatusNotification(eventData.organizerEmail, { id: req.params.id, ...eventData, ...updatePayload }, 'REJECTED');
        }
      });

      return res.json({
        success: true,
        message: `${department} rejected successfully`,
        event: { id: req.params.id, ...eventData, ...updatePayload },
      });
    }

    departmentApprovals[department] = {
      status: 'APPROVED',
      approvedBy,
      approvedAt: new Date().toISOString(),
    };

    const updatePayload = { departmentApprovals, updatedAt: new Date().toISOString() };

    const requiredDepts = getRequiredDepartments(eventData);
    const allApproved = requiredDepts.every(dept => departmentApprovals[dept]?.status === 'APPROVED');

    if (allApproved && eventData.status === 'PENDING_DEPARTMENTS') {
      updatePayload.status = 'PENDING_IQAC';
      await updateDoc(eventRef, updatePayload);

      executeBackgroundNotification('events/dept-approval/iqac', async () => {
        await handleEventStatusChange({ id: req.params.id, lastApprovedDept: department, ...eventData, ...updatePayload }, 'PENDING_DEPARTMENTS', 'PENDING_IQAC');
      });
    } else {
      await updateDoc(eventRef, updatePayload);
 
      executeBackgroundNotification('events/dept-approval/intermediate', async () => {
        // Pass a pseudo-status 'DEPARTMENT_APPROVED' so the handler emails the organizer about this intermediate step
        await handleEventStatusChange({ id: req.params.id, lastApprovedDept: department, ...eventData, ...updatePayload }, eventData.status, 'DEPARTMENT_APPROVED');
      });
    }

    return res.json({
      success: true,
      message: `${department} approved successfully`,
      event: { id: req.params.id, ...eventData, ...updatePayload },
    });
  } catch (error) {
    console.error('[events/department-approval] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update department approval', error: error.message });
  }
});

// â”€â”€ PUT /api/events/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Full update of an event document
router.put('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const updatePayload = { ...req.body, updatedAt: new Date().toISOString() };
    await updateDoc(eventRef, updatePayload);

    return res.json({
      success: true,
      message: 'Event updated successfully',
      event: { id: req.params.id, ...eventSnap.data(), ...updatePayload },
    });
  } catch (error) {
    console.error('[events/update] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update event', error: error.message });
  }
});

// â”€â”€ PUT /api/events/:id/resubmit-edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Resubmit a rejected event
router.put('/:id/resubmit-edit', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const newEventData = req.body;
    const isFacultyOrganizer = eventData.creatorType === 'FACULTY';
    const hasMediaPoster = Boolean(eventData.posterDataUrl || eventData.posterUrl);

    // ── Poster Resubmission Logic ──
    let posterWorkflow = newEventData.posterWorkflow || eventData.posterWorkflow || {};
    let posterStatus = newEventData.posterStatus || eventData.posterStatus || 'PENDING';

    if (posterWorkflow.requested || hasMediaPoster || eventData.departmentApprovals?.media) {
      if (posterWorkflow.requested) {
        if (posterStatus === 'UPLOADED' || posterStatus === 'COMPLETED' || posterWorkflow.status === 'UPLOADED' || posterWorkflow.status === 'COMPLETED') {
          posterStatus = 'REVISION_REQUIRED';
          posterWorkflow.status = 'REVISION_REQUIRED';
        } else {
          posterStatus = 'REQUESTED';
          posterWorkflow.status = 'REQUESTED';
        }
      }
    }

    // Reset all approvals upon resubmission
    const newDeptApprovals = {};
    const wasIqacRejection = eventData.rejectedByRole === 'IQAC_TEAM';

    const updatePayload = {
      ...req.body,
      status: isFacultyOrganizer ? 'PENDING_HOD' : 'PENDING_FACULTY',
      isResubmitted: true,
      iqacResubmission: wasIqacRejection,
      updatedAt: new Date().toISOString(),
      posterStatus,
      posterWorkflow,

      // Clear all stage approvals
      approvedBy: null,
      rejectionReason: null,
      rejectedByRole: null,
      rejectedByName: null,
      rejectedByDept: null,
      rejectedAt: null,

      facultyApprovedAt: null,
      facultyApprovedBy: null,
      hodApprovedAt: null,
      hodApprovedBy: null,
      iqacApprovedAt: null,
      iqacApprovedBy: null,

      // Reset department approvals (except media if poster exists)
      departmentApprovals: newDeptApprovals
    };
    await updateDoc(eventRef, updatePayload);

    // After resubmitting, notify the faculty in the background
    executeBackgroundNotification('events/resubmit-edit', async () => {
      const payloadWithId = { id: req.params.id, ...updatePayload };
      let facultyEmail = updatePayload.coordinator?.facultyEmail || updatePayload.coordinator?.faculty_email || updatePayload.facultyEmail || null;
      if (typeof facultyEmail === 'string') facultyEmail = facultyEmail.trim().toLowerCase();

      if (!facultyEmail && updatePayload.coordinator?.facultyName) {
        facultyEmail = await getFacultyEmailByName(String(updatePayload.coordinator.facultyName).trim());
      }

      if (facultyEmail) {
        await sendEventNotificationToFaculty(payloadWithId, facultyEmail);
      }
    });

    return res.json({
      success: true,
      message: 'Event resubmitted successfully',
      event: { id: req.params.id, ...eventSnap.data(), ...updatePayload },
    });
  } catch (error) {
    console.error('[events/resubmit-edit] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resubmit event', error: error.message });
  }
});

// â”€â”€ POST /api/events/:id/register â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// A student registers for an event â€” adds them to the registeredStudents array
router.post('/:id/register', async (req, res) => {
  if (!checkDb(res)) return;  // checkDb returns false when db is ready

  try {
    const { userId, userName, userEmail, userDepartment, userYear, rollNo, userClass } = req.body;

    if (!userId || !userName) {
      return res.status(400).json({ success: false, message: 'userId and userName are required' });
    }

    const eventRef = doc(db, 'events', req.params.id);
    const registrationId = `${req.params.id}_${userId}`;
    const registrationRef = doc(db, 'eventRegistrations', registrationId);

    const newEntry = {
      eventId: req.params.id,
      studentId: userId,
      userId,
      userName,
      userEmail: userEmail || '',
      userDepartment: userDepartment || '',
      userYear: userYear || '',
      rollNo: rollNo || '',
      userClass: userClass || '',
      status: 'REGISTERED',
      registeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await runTransaction(db, async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists()) {
        throw new Error('NOT_FOUND:Event not found');
      }

      const eventData = eventSnap.data();

      if (eventData.status !== 'POSTED') {
        throw new Error('BAD_REQUEST:Cannot register for an event that is not approved and posted.');
      }

      // Prevent organizers from registering for their own event
      if (String(eventData.organizerId) === String(userId) || (eventData.organizerEmail && userEmail && eventData.organizerEmail.toLowerCase() === userEmail.toLowerCase())) {
        throw new Error('BAD_REQUEST:Organizers cannot register for their own events.');
      }

      const startDateStr = eventData.requisition?.step1?.eventStartDate || eventData.date;
      const startTimeStr = eventData.requisition?.step1?.eventStartTime || eventData.startTime || '00:00';
      
      if (startDateStr) {
        try {
          const sDP = startDateStr.split('-');
          const sTP = startTimeStr.split(':');
          const startTimestamp = new Date(parseInt(sDP[0]), parseInt(sDP[1]) - 1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1])).getTime();
          
          if (Date.now() >= startTimestamp) {
            throw new Error('BAD_REQUEST:Registration is closed. This event is already ongoing or completed.');
          }
        } catch (err) {
          const today = new Date().toISOString().split('T')[0];
          if (startDateStr < today) {
            throw new Error('BAD_REQUEST:Registration is closed. This event is already ongoing or completed.');
          }
        }
      }

      const regSnap = await transaction.get(registrationRef);
      if (regSnap.exists()) {
        throw new Error('CONFLICT:Already registered for this event');
      }

      // [LEGACY COMPATIBILITY - REMOVE LATER]
      const registeredStudents = eventData.registeredStudents || [];
      if (registeredStudents.some(s => s.userId === userId)) {
        throw new Error('CONFLICT:Already registered for this event');
      }
      
      const updatedList = [...registeredStudents, newEntry];
      const stats = eventData.stats || {};
      const newStats = {
        ...stats,
        registeredCount: (stats.registeredCount || 0) + 1
      };

      // 1. Create root collection doc
      transaction.set(registrationRef, newEntry);
      
      // 2. Update events document (stats + dual-write legacy)
      transaction.update(eventRef, {
        registeredStudents: updatedList, // [LEGACY COMPATIBILITY - REMOVE LATER]
        stats: newStats,
        updatedAt: new Date().toISOString(),
      });
    });

    return res.status(201).json({ success: true, message: 'Registered successfully', entry: newEntry });
  } catch (error) {
    if (error.message.includes('NOT_FOUND')) return res.status(404).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('BAD_REQUEST')) return res.status(400).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('CONFLICT')) return res.status(409).json({ success: false, message: error.message.split(':')[1] });
    
    console.error('[events/register] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to register', error: error.message });
  }
});

// â”€â”€ POST /api/events/:id/withdraw â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// A student withdraws their registration â€” removes them from registeredStudents
router.post('/:id/withdraw', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const eventRef = doc(db, 'events', req.params.id);
    const registrationId = `${req.params.id}_${userId}`;
    const registrationRef = doc(db, 'eventRegistrations', registrationId);

    await runTransaction(db, async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists()) {
        throw new Error('NOT_FOUND:Event not found');
      }

      const regSnap = await transaction.get(registrationRef);
      const isNewArchitectureRegistered = regSnap.exists() && regSnap.data().status === 'REGISTERED';
      
      const eventData = eventSnap.data();
      const registeredStudents = eventData.registeredStudents || [];
      const isLegacyRegistered = registeredStudents.some(s => s.userId === userId);

      if (!isNewArchitectureRegistered && !isLegacyRegistered) {
         // Idempotency: already withdrawn or never registered
         return;
      }

      const updatedList = registeredStudents.filter(s => s.userId !== userId);
      
      const stats = eventData.stats || {};
      const currentCount = stats.registeredCount || 0;
      const newStats = {
        ...stats,
        // Only decrement if we are actually removing them from new architecture OR if legacy list was shortened
        registeredCount: Math.max(0, currentCount - 1)
      };

      if (regSnap.exists()) {
         transaction.update(registrationRef, { status: 'WITHDRAWN', updatedAt: new Date().toISOString() });
      }

      transaction.update(eventRef, {
        registeredStudents: updatedList, // [LEGACY COMPATIBILITY - REMOVE LATER]
        stats: newStats,
        updatedAt: new Date().toISOString(),
      });
    });

    return res.json({ success: true, message: 'Withdrawn successfully' });
  } catch (error) {
    if (error.message.includes('NOT_FOUND')) return res.status(404).json({ success: false, message: error.message.split(':')[1] });
    
    console.error('[events/withdraw] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to withdraw', error: error.message });
  }
});

// ————————————————————————————————————————————
router.delete('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Delete associated OD requests to prevent orphans
    const odQuery = query(collection(db, 'odRequests'), where('eventId', '==', req.params.id));
    const odSnap = await getDocs(odQuery);
    const deleteODPromises = odSnap.docs.map(d => deleteDoc(d.ref));

    // Delete associated Correction requests to prevent orphans
    const correctionQuery = query(collection(db, 'correctionRequests'), where('eventId', '==', req.params.id));
    const correctionSnap = await getDocs(correctionQuery);
    const deleteCorrectionPromises = correctionSnap.docs.map(d => deleteDoc(d.ref));

    await Promise.all([...deleteODPromises, ...deleteCorrectionPromises]);
    await deleteDoc(eventRef);

    // Clean up Firebase Storage files associated with this event
    await deleteStorageFolder(`events/${req.params.id}`);

    return res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('[events/delete] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete event', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/poster â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Update just the poster data of an event
router.patch('/:id/poster', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const { posterDataUrl, posterFileName, posterMimeType, updatedBy, action } = req.body;

    const now = new Date().toISOString();
    let updatePayload = {};
    let isMediaUpload = false;
    const currentWorkflow = eventData.posterWorkflow || {};

    if (action === 'remove') {
      updatePayload = {
        posterDataUrl: null,
        posterFileName: null,
        posterMimeType: null,
        posterStorage: null,
        updatedAt: now,
        posterStatus: 'PENDING'
      };
      
      if (currentWorkflow.requested) {
        updatePayload.posterWorkflow = {
          ...currentWorkflow,
          status: 'REQUESTED' // Revert to requested
        };
      }
    } else {
      const { posterStorage } = req.body;
      if (!posterDataUrl && !posterStorage) {
        return res.status(400).json({ success: false, message: 'Poster data or storage metadata is required' });
      }

      updatePayload = {
        posterDataUrl: posterDataUrl || null,
        posterStorage: posterStorage || null,
        posterFileName,
        posterMimeType,
        updatedAt: now,
        posterUploadedAt: now,
        posterStatus: 'UPLOADED'
      };

      if (updatedBy) {
        updatePayload.posterUpdatedBy = updatedBy;
        updatePayload.posterUploadedBy = updatedBy;
      }

      // If a poster was requested from media team, update the workflow to reflect completion
      if (currentWorkflow.requested) {
        isMediaUpload = true;
        updatePayload.posterWorkflow = {
          ...currentWorkflow,
          status: 'UPLOADED',
          finalUploadedAt: now,
          finalUploadedBy: updatedBy || 'Media Team'
        };
      }
    }

    await updateDoc(eventRef, updatePayload);

    // Send notification if this was a requested media poster upload
    if (isMediaUpload && eventData.organizerEmail) {
      const refreshedData = { id: req.params.id, ...eventData, ...updatePayload };
      executeBackgroundNotification('events/poster', async () => {
        await sendPosterReadyEmail(refreshedData, eventData.organizerEmail);
      });
    }

    return res.json({
      success: true,
      message: 'Poster uploaded successfully'
    });
  } catch (error) {
    console.error('[events/poster] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload poster', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/poster-workflow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Update just the poster workflow sub-object of an event
router.patch('/:id/poster-workflow', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const currentWorkflow = eventData.posterWorkflow || {};

    const updates = req.body;
    const { updatedBy, ...workflowFields } = updates;

    const newWorkflow = {
      ...currentWorkflow,
      ...workflowFields,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: updatedBy || 'Unknown User'
    };

    await updateDoc(eventRef, {
      posterWorkflow: newWorkflow,
      updatedAt: new Date().toISOString()
    });

    const refreshedData = { id: req.params.id, ...eventData, posterWorkflow: newWorkflow };

    // Trigger emails for specific steps in the workflow
    if ((updates.status === 'SENT_TO_ORGANIZER' || updates.status === 'COMPLETED') && eventData.organizerEmail) {
      executeBackgroundNotification('events/poster-workflow', async () => {
        await sendPosterReadyEmail(refreshedData, eventData.organizerEmail);
      });
    }

    return res.json({
      success: true,
      message: 'Poster workflow updated',
      posterWorkflow: newWorkflow
    });
  } catch (error) {
    console.error('[events/poster-workflow] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update poster workflow', error: error.message });
  }
});

// â”€â”€ POST /api/events/test-email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Test endpoint to verify email configuration
router.post('/test-email', async (req, res) => {
  const { emailAddress } = req.body;

  if (!emailAddress) {
    return res.status(400).json({
      success: false,
      message: 'Email address is required',
    });
  }

  try {
    const testEventData = {
      title: 'Test Event',
      description: 'This is a test email to verify SMTP configuration.',
      eventType: 'Test',
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '12:00',
      venue: 'Test Venue',
      organizerName: 'Test Organizer',
      organizingDepartment: 'CSE',
    };

    const emailResult = await sendEventNotificationToFaculty(testEventData, emailAddress);

    if (emailResult.success) {
      return res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: emailResult.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: emailResult.error,
      });
    }
  } catch (error) {
    console.error('[events/test-email] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message,
    });
  }
});

// â”€â”€ GET /api/events/coordinators/list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Get all faculty coordinators
router.get('/coordinators/list', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const snapshot = await getDocs(collection(db, 'coordinators'));
    const coordinators = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    return res.json({
      success: true,
      count: coordinators.length,
      coordinators,
    });
  } catch (error) {
    console.error('[events/coordinators/list] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch coordinators',
      error: error.message,
    });
  }
});

// â”€â”€ POST /api/events/coordinators/add â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Add a new faculty coordinator
// Body: { name: string, email: string, department?: string }
router.post('/coordinators/add', async (req, res) => {
  if (!checkDb(res)) return;

  const { name, email, department } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Faculty name and email are required',
    });
  }

  try {
    const coordinatorData = {
      name,
      email,
      department: department || 'CSE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'coordinators'), coordinatorData);

    return res.status(201).json({
      success: true,
      message: 'Coordinator added successfully',
      coordinator: { id: docRef.id, ...coordinatorData },
    });
  } catch (error) {
    console.error('[events/coordinators/add] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add coordinator',
      error: error.message,
    });
  }
});

// â”€â”€ DELETE /api/events/coordinators/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Delete a faculty coordinator
router.delete('/coordinators/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const coordinatorRef = doc(db, 'coordinators', req.params.id);
    const coordinatorSnap = await getDoc(coordinatorRef);

    if (!coordinatorSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Coordinator not found',
      });
    }

    await deleteDoc(coordinatorRef);

    return res.json({
      success: true,
      message: 'Coordinator deleted successfully',
    });
  } catch (error) {
    console.error('[events/coordinators/delete] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete coordinator',
      error: error.message,
    });
  }
});

// â”€â”€ PATCH /api/events/:id/request-iqac-extension â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Organizer requests an extension for IQAC submission with a reason
router.patch('/:id/request-iqac-extension', async (req, res) => {
  if (!checkDb(res)) return;
  const { reason, requestedBy } = req.body;
  if (!reason || !requestedBy) {
    return res.status(400).json({ success: false, message: 'Reason and requestedBy are required' });
  }
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();

    const iqacExtensionRequest = {
      reason,
      requestedBy,
      requestedAt: new Date().toISOString(),
      status: 'PENDING'
    };
    const updatePayload = { iqacExtensionRequest, updatedAt: new Date().toISOString() };
    await updateDoc(eventRef, updatePayload);

    (async () => {
      try {
        const hodEmails = await getOfficialEmailsByRole('HOD');
        if (hodEmails.length > 0) {
          Promise.allSettled(hodEmails.map(email =>
            sendIQACExtensionRequestEmail(email, { id: req.params.id, ...eventData }, reason)
          )).catch(e => console.error('[events/request-iqac-extension/bg] Error:', e.message));
        }
      } catch (err) {
        console.error('[events/request-iqac-extension/bg] background err:', err.message);
      }
    })();

    return res.json({ success: true, message: 'IQAC extension requested successfully', event: { id: req.params.id, ...eventData, ...updatePayload } });
  } catch (error) {
    console.error('[events/request-iqac-extension] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to request extension', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/approve-iqac-extension â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HOD approves an IQAC extension request with a specific end date
router.patch('/:id/approve-iqac-extension', async (req, res) => {
  if (!checkDb(res)) return;
  const { endDate, approvedBy } = req.body;
  if (!endDate || !approvedBy) {
    return res.status(400).json({ success: false, message: 'End date and approvedBy (HOD name) are required' });
  }
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();
    const updatePayload = {
      iqacWindowExtended: true,
      iqacWindowExtendedAt: new Date().toISOString(),
      iqacWindowExtendedBy: approvedBy,
      iqacExtensionEndDate: endDate,
      'iqacExtensionRequest.status': 'APPROVED',
      updatedAt: new Date().toISOString()
    };
    await updateDoc(eventRef, updatePayload);

    executeBackgroundNotification('events/approve-iqac-extension', async () => {
      if (eventData.organizerEmail) {
        await sendIQACExtensionStatusEmail(eventData.organizerEmail, { id: req.params.id, ...eventData }, true);
      }
    });

    return res.json({ success: true, message: 'IQAC extension approved successfully', event: { id: req.params.id, ...eventData, ...updatePayload } });
  } catch (error) {
    console.error('[events/approve-iqac-extension] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to approve extension', error: error.message });
  }
});

// PATCH /api/events/:id/reject-iqac-extension
router.patch('/:id/reject-iqac-extension', async (req, res) => {
  if (!checkDb(res)) return;
  const { rejectedBy } = req.body;
  if (!rejectedBy) {
    return res.status(400).json({ success: false, message: 'rejectedBy (HOD name) is required' });
  }
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();
    const updatePayload = {
      'iqacExtensionRequest.status': 'REJECTED',
      'iqacExtensionRequest.rejectedBy': rejectedBy,
      'iqacExtensionRequest.rejectedAt': new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await updateDoc(eventRef, updatePayload);

    executeBackgroundNotification('events/reject-iqac-extension', async () => {
      if (eventData.organizerEmail) {
        await sendIQACExtensionStatusEmail(eventData.organizerEmail, { id: req.params.id, ...eventData }, false);
      }
    });

    return res.json({ success: true, message: 'IQAC extension rejected successfully' });
  } catch (error) {
    console.error('[events/reject-iqac-extension] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject extension', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/extend-iqac-window â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// (Existing) Legacy/Faculty-only quick extension (grants 2 extra days from now)
router.patch('/:id/extend-iqac-window', async (req, res) => {
  if (!checkDb(res)) return;
  const { extendedBy } = req.body;
  if (!extendedBy) return res.status(400).json({ success: false, message: 'extendedBy is required' });
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    // Legacy logic: 2 days from now
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const updatePayload = {
      iqacWindowExtended: true,
      iqacWindowExtendedBy: extendedBy,
      iqacWindowExtendedAt: new Date().toISOString(),
      iqacExtensionEndDate: twoDaysFromNow.toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(eventRef, updatePayload);
    return res.json({ success: true, message: 'IQAC window extended successfully', event: { id: req.params.id, ...eventSnap.data(), ...updatePayload } });
  } catch (error) {
    console.error('[events/extend-iqac-window] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to extend window', error: error.message });
  }
});

// ── PATCH /api/events/:id/cancel ───────────────────────────────────────────
// Cancel an event (STUDENT_ORGANIZER or FACULTY)
router.patch('/:id/cancel', requireAuth, requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { cancellationReason, confirmationText } = req.body;
  
  if (!cancellationReason || typeof cancellationReason !== 'string' || cancellationReason.trim() === '') {
    return res.status(400).json({ success: false, message: 'Cancellation reason is mandatory' });
  }
  
  if (confirmationText !== 'CANCEL EVENT') {
    return res.status(400).json({ success: false, message: 'Invalid confirmation text' });
  }

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    
    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only cancel your own events' });
    }
    
    if (eventData.status === 'COMPLETED' || eventData.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel an event that is already completed or cancelled' });
    }

    const now = new Date().toISOString();
    
    const newStatus = req.user.role === 'STUDENT_ORGANIZER' ? 'PENDING_FACULTY' : 'PENDING_HOD';
    const updatePayload = {
      status: newStatus,
      modificationRequest: {
        type: 'CANCEL',
        reason: cancellationReason.trim(),
        requestedBy: req.user.name || req.user.email,
        requestedAt: now
      },
      updatedAt: now,
      facultyApprovedAt: null,
      facultyApprovedBy: null,
      hodApprovedAt: null,
      hodApprovedBy: null,
      iqacApprovedAt: null,
      iqacApprovedBy: null
    };

    // [MODULE 3] Atomic Write for cancellation
    const batch = writeBatch(db);
    
    // [LEGACY COMPATIBILITY - REMOVE LATER] Dual-write to embedded array
    const legacyAction = {
      action: 'CANCEL_REQUESTED',
      status: newStatus,
      approvedBy: req.user.name || req.user.email,
      role: req.user.role,
      timestamp: new Date().toISOString(),
      remarks: cancellationReason.trim()
    };
    updatePayload.eventActions = arrayUnion(legacyAction);
    
    batch.update(eventRef, updatePayload);

    // [NEW ARCHITECTURE] Write to normalized eventApprovalLogs collection
    const logRef = doc(collection(db, 'eventApprovalLogs'));
    batch.set(logRef, {
      eventId: req.params.id,
      action: newStatus,
      approvedBy: req.user.name || req.user.email,
      role: req.user.role,
      remarks: cancellationReason.trim(),
      timestamp: new Date().toISOString()
    });

    await batch.commit();

    // Notifications
    const { handleEventStatusChange } = require('../services/emailHandler');
    executeBackgroundNotification('events/cancel', async () => {
      await handleEventStatusChange({ id: req.params.id, ...eventData, ...updatePayload }, eventData.status, newStatus);
    });

    return res.json({ success: true, message: 'Event cancelled successfully', event: { id: req.params.id, ...eventData, ...updatePayload } });
  } catch (error) {
    console.error('[events/cancel] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel event', error: error.message });
  }
});

// ── PATCH /api/events/:id/postpone ─────────────────────────────────────────
// Postpone an event (STUDENT_ORGANIZER or FACULTY)
router.patch('/:id/postpone', requireAuth, requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { reason, newDate, newEndDate: providedEndDate, newStartTime, newEndTime } = req.body;
  const newEndDate = providedEndDate || newDate;
  
  if (!reason || !newDate || !newStartTime || !newEndTime) {
    return res.status(400).json({ success: false, message: 'Reason, newDate, newStartTime, and newEndTime are mandatory' });
  }

  // Basic time validation
  if (newDate > newEndDate) {
    return res.status(400).json({ success: false, message: 'End date must be after or equal to start date' });
  }
  if (newDate === newEndDate && newStartTime >= newEndTime) {
    return res.status(400).json({ success: false, message: 'End time must be after start time on the same day' });
  }

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    
    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only postpone your own events' });
    }
    
    if (eventData.status === 'COMPLETED' || eventData.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot postpone an event that is completed or cancelled' });
    }

    const now = new Date().toISOString();
    
    const oldDate = eventData.requisition?.step1?.eventStartDate || eventData.date;
    const oldStartTime = eventData.requisition?.step1?.eventStartTime || eventData.startTime;
    const oldEndTime = eventData.requisition?.step1?.eventEndTime || eventData.endTime;

    const newStatus = req.user.role === 'STUDENT_ORGANIZER' ? 'PENDING_FACULTY' : 'PENDING_HOD';
    const firestoreUpdate = {
      status: newStatus,
      modificationRequest: {
        type: 'POSTPONE',
        reason: reason.trim(),
        newDate,
        newEndDate,
        newStartTime,
        newEndTime,
        oldDate,
        oldStartTime,
        oldEndTime,
        requestedBy: req.user.name || req.user.email,
        requestedAt: now
      },
      updatedAt: now,
      facultyApprovedAt: null,
      facultyApprovedBy: null,
      hodApprovedAt: null,
      hodApprovedBy: null,
      iqacApprovedAt: null,
      iqacApprovedBy: null,
      departmentApprovals: {}, // Reset department approvals as dates have changed
      eventActions
    };

    // [MODULE 3] Atomic Write for postpone
    const batch = writeBatch(db);
    
    // [LEGACY COMPATIBILITY - REMOVE LATER] Dual-write to embedded array
    const legacyAction = {
      action: 'POSTPONE_REQUESTED',
      status: newStatus,
      approvedBy: req.user.name || req.user.email,
      role: req.user.role,
      timestamp: new Date().toISOString(),
      remarks: reason.trim()
    };
    firestoreUpdate.eventActions = arrayUnion(legacyAction);
    batch.update(eventRef, firestoreUpdate);

    // [NEW ARCHITECTURE] Write to normalized eventApprovalLogs collection
    const logRef = doc(collection(db, 'eventApprovalLogs'));
    batch.set(logRef, {
      eventId: req.params.id,
      action: newStatus,
      approvedBy: req.user.name || req.user.email,
      role: req.user.role,
      remarks: reason,
      timestamp: new Date().toISOString()
    });

    await batch.commit();

    // Notifications
    const { handleEventStatusChange } = require('../services/emailHandler');
    executeBackgroundNotification('events/postpone', async () => {
      await handleEventStatusChange({ id: req.params.id, ...eventData, ...firestoreUpdate }, eventData.status, newStatus);
    });

    return res.json({ success: true, message: 'Event postponed successfully', event: { id: req.params.id, ...eventData, ...firestoreUpdate } });
  } catch (error) {
    console.error('[events/postpone] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to postpone event', error: error.message });
  }
});

// ── ATTENDANCE ROUTES ────────────────────────────────────────────────────────

// Helper to log attendance modifications
async function logAttendanceAudit(eventId, logData) {
  try {
    const auditRef = collection(db, 'events', eventId, 'attendanceAuditLogs');
    await addDoc(auditRef, {
      ...logData,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to log attendance audit:', err.message);
  }
}

// ── GET /api/events/:id/attendance-audit ──────────────────────────────────
router.get('/:id/attendance-audit', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const auditRef = collection(db, 'events', req.params.id, 'attendanceAuditLogs');
    const snapshot = await getDocs(auditRef);
    const logs = snapshot.docs.map(d => {
      const data = d.data();
      const dateObj = new Date(data.timestamp);
      const dateStamp = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
      const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return {
        id: d.id,
        dateStamp,
        time,
        action: data.action || 'N/A',
        studentName: data.studentName || 'N/A',
        rollNo: data.rollNo || 'N/A',
        date: data.date || 'N/A',
        session: data.session || 'N/A',
        previousStatus: data.previousStatus || 'N/A',
        updatedStatus: data.updatedStatus || 'N/A',
        reason: data.reason || 'N/A',
        modifiedBy: data.modifiedBy || 'Unknown',
        userRole: data.userRole || 'N/A',
        timestamp: data.timestamp
      };
    });
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return res.json({ success: true, logs });
  } catch (error) {
    console.error('[events/attendance-audit] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
});

// ── PATCH /api/events/:id/attendance-config ────────────────────────────────
router.patch('/:id/attendance-config', requireAuth, requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { date, attendanceType } = req.body;
  if (!date || !attendanceType) return res.status(400).json({ success: false, message: 'Date and attendanceType required' });

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    
    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const attendanceConfigs = eventData.attendanceConfigs || {};
    
    attendanceConfigs[date] = {
      ...attendanceConfigs[date],
      attendanceType,
      session1Status: attendanceConfigs[date]?.session1Status || 'NotStarted',
      session2Status: attendanceType === 'Both Sessions' ? (attendanceConfigs[date]?.session2Status || 'Disabled') : 'Disabled',
      attendanceFinalized: attendanceConfigs[date]?.attendanceFinalized || false
    };

    await updateDoc(eventRef, { attendanceConfigs });

    await logAttendanceAudit(req.params.id, {
      action: 'Configuration Saved',
      date,
      session: 'N/A',
      previousStatus: eventData.attendanceConfigs?.[date]?.attendanceType || 'N/A',
      updatedStatus: attendanceType,
      reason: 'Configuration updated',
      modifiedBy: req.user.name || req.user.email,
      userRole: req.user.role
    });

    return res.json({ success: true, attendanceConfigs, attendanceStats: eventData.attendanceStats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/events/:id/attendance-session ───────────────────────────────
router.patch('/:id/attendance-session', requireAuth, requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { date, sessionKey, action } = req.body;
  
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false });
    
    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const attendanceConfigs = eventData.attendanceConfigs || {};
    const config = attendanceConfigs[date];
    if (!config) return res.status(400).json({ success: false, message: 'Config not found' });

    if (sessionKey === 'S1') {
      config.session1Status = action === 'START' ? 'Running' : 'Closed';
      if (action === 'START') {
        config.session1StartTime = new Date().toISOString();
        if (config.attendanceType === 'Both Sessions') {
          config.session2Status = 'Disabled';
        }
      }
      if (action === 'END') {
        config.session1EndTime = new Date().toISOString();
        if (config.attendanceType === 'Both Sessions') {
          config.session2Status = 'NotStarted';
        }
      }
    } else if (sessionKey === 'S2') {
      config.session2Status = action === 'START' ? 'Running' : 'Closed';
      if (action === 'START') config.session2StartTime = new Date().toISOString();
      if (action === 'END') config.session2EndTime = new Date().toISOString();
    }

    attendanceConfigs[date] = config;
    await updateDoc(eventRef, { attendanceConfigs });
    
    await logAttendanceAudit(req.params.id, {
      action: 'Session Toggle',
      date,
      session: sessionKey,
      previousStatus: 'N/A',
      updatedStatus: action,
      reason: `Session ${sessionKey} ${action}`,
      modifiedBy: req.user.name || req.user.email,
      userRole: req.user.role
    });

    return res.json({ success: true, attendanceConfigs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/events/:id/finalize-attendance ──────────────────────────────
router.patch('/:id/finalize-attendance', requireAuth, requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { date } = req.body;
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const attendanceConfigs = eventData.attendanceConfigs || {};
    if (attendanceConfigs[date]) {
      attendanceConfigs[date].attendanceFinalized = true;
      attendanceConfigs[date].session1Status = attendanceConfigs[date].session1Status === 'Running' ? 'Closed' : attendanceConfigs[date].session1Status;
      if (attendanceConfigs[date].attendanceType === 'Both Sessions') {
         attendanceConfigs[date].session2Status = attendanceConfigs[date].session2Status === 'Running' ? 'Closed' : attendanceConfigs[date].session2Status;
      }
    }
    await updateDoc(eventRef, { attendanceConfigs });

    await logAttendanceAudit(req.params.id, {
      action: 'Finalized',
      date,
      session: 'N/A',
      previousStatus: 'Open',
      updatedStatus: 'Finalized',
      reason: 'Attendance finalized for date',
      modifiedBy: req.user.name || req.user.email,
      userRole: req.user.role
    });

    return res.json({ success: true, attendanceConfigs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/events/:id/attendance ────────────────────────────────────────
router.post('/:id/attendance', requireAuth, requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { rollNo, studentName, eventId, registrationId, date } = req.body;
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    const eventData = eventSnap.data();
    
    if (eventData.organizerId !== req.user.id) return res.status(403).json({ success: false, silentMessage: 'Forbidden' });

    const config = (eventData.attendanceConfigs || {})[date];
    if (!config) return res.status(400).json({ success: false, silentMessage: 'Attendance not configured for this date' });
    
    const activeSession = config.session1Status === 'Running' ? 'S1' : config.session2Status === 'Running' ? 'S2' : null;
    if (!activeSession) return res.status(400).json({ success: false, silentMessage: 'No active session' });

    // Validate registration
    const reqRef = doc(db, 'odRequests', registrationId);

    const transactionResult = await runTransaction(db, async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      const eventData = eventSnap.data();
      
      if (eventData.organizerId !== req.user.id) {
        throw new Error('FORBIDDEN:Forbidden');
      }

      const config = (eventData.attendanceConfigs || {})[date];
      if (!config) throw new Error('BAD_REQUEST:Attendance not configured for this date');
      
      const activeSession = config.session1Status === 'Running' ? 'S1' : config.session2Status === 'Running' ? 'S2' : null;
      if (!activeSession) throw new Error('BAD_REQUEST:No active session');

      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) throw new Error('BAD_REQUEST:Registration not found');
      
      const reqData = reqSnap.data();
      if (reqData.eventId !== eventId || reqData.status !== 'APPROVED') {
        throw new Error('BAD_REQUEST:Student is not an approved participant');
      }

      // [MODULE 4] Normalized eventAttendance Collection
      const studentId = reqData.studentId || reqData.userId || reqData.rollNo;
      const attId = `${eventId}_${studentId}`;
      const attRef = doc(db, 'eventAttendance', attId);
      const attSnap = await transaction.get(attRef);
      
      let eventAttendanceData = attSnap.exists() ? attSnap.data() : {
          eventId: eventId,
          studentId: studentId,
          studentName: reqData.studentName,
          rollNo: reqData.rollNo,
          attendance: {},
          status: 'ATTENDED',
          createdAt: new Date().toISOString(),
      };

      const dateAttendance = eventAttendanceData.attendance[date] || {};
      if (dateAttendance[activeSession]) {
        return { 
          duplicate: true, 
          studentName: reqData.studentName, 
          rollNo: reqData.rollNo, 
          sessionLabel: activeSession === 'S1' ? 'Session 1' : 'Session 2' 
        };
      }

      let wasAlreadyPresentAtAll = false;
      Object.values(eventAttendanceData.attendance).forEach(dateAtt => {
         if (dateAtt.S1 || dateAtt.S2) wasAlreadyPresentAtAll = true;
      });

      dateAttendance[activeSession] = true;
      eventAttendanceData.attendance[date] = dateAttendance;
      eventAttendanceData.updatedAt = new Date().toISOString();

      // [LEGACY COMPATIBILITY - REMOVE LATER] Dual-write to odRequests
      const legacyAttendance = reqData.attendance || {};
      const legacyDateAtt = legacyAttendance[date] || {};
      legacyDateAtt[activeSession] = true;
      legacyAttendance[date] = legacyDateAtt;
      transaction.update(reqRef, { attendance: legacyAttendance });

      // 1. Create/Update root collection doc
      transaction.set(attRef, eventAttendanceData);

      // 2. Update events stats
      const stats = eventData.attendanceStats || { totalApproved: 0, totalPresent: 0, s1Present: 0, s2Present: 0 };
      if (activeSession === 'S1') stats.s1Present = (stats.s1Present || 0) + 1;
      if (activeSession === 'S2') stats.s2Present = (stats.s2Present || 0) + 1;
      if (!wasAlreadyPresentAtAll) {
         stats.totalPresent = (stats.totalPresent || 0) + 1;
      }
      
      transaction.update(eventRef, { attendanceStats: stats });

      return {
        success: true, 
        studentName: reqData.studentName, 
        rollNo: reqData.rollNo, 
        sessionLabel: activeSession === 'S1' ? 'Session 1' : 'Session 2',
        sessionKey: activeSession,
        isFirstScan: !wasAlreadyPresentAtAll
      };
    });

    if (transactionResult.duplicate) {
       return res.json({ success: false, ...transactionResult });
    }

    return res.json(transactionResult);
  } catch (err) {
    if (err.message.includes('FORBIDDEN')) return res.status(403).json({ success: false, silentMessage: err.message.split(':')[1] });
    if (err.message.includes('BAD_REQUEST')) return res.status(400).json({ success: false, silentMessage: err.message.split(':')[1] });
    
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/events/:id/attendance/correct ──────────────────────────────
router.patch('/:id/attendance/correct', requireAuth, requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { registrationId, date, session, s1Present, s2Present, reason } = req.body;
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    
    if (eventSnap.data().organizerId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const reqRef = doc(db, 'odRequests', registrationId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return res.status(404).json({ success: false, message: 'Registration not found' });
    
    const reqData = reqSnap.data();
    if (reqData.eventId !== req.params.id || reqData.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Invalid registration state' });
    }

    const attendance = reqData.attendance || {};
    const dateAttendance = attendance[date] || {};
    
    const correctionLogs = reqData.correctionLogs || [];
    const oldStatus = `S1: ${dateAttendance.S1 ? 'true' : 'false'}${session === 'BOTH' ? `, S2: ${dateAttendance.S2 ? 'true' : 'false'}` : ''}`;
    const newStatus = `S1: ${s1Present}${session === 'BOTH' ? `, S2: ${s2Present}` : ''}`;

    if (session === 'S1') {
       dateAttendance.S1 = s1Present;
    } else {
       dateAttendance.S1 = s1Present;
       dateAttendance.S2 = s2Present;
    }
    attendance[date] = dateAttendance;

    correctionLogs.push({
      timestamp: new Date().toISOString(),
      correctedBy: req.user.id,
      reason,
      changes: `Date: ${date} | ${newStatus}`
    });
    
    const studentId = reqData.studentId || reqData.userId || reqData.rollNo;
    const attId = `${req.params.id}_${studentId}`;
    const attRef = doc(db, 'eventAttendance', attId);
    
    // [MODULE 4] Atomic Write for Attendance Correction
    const batch = writeBatch(db);

    batch.update(reqRef, { attendance, correctionLogs }); // [LEGACY COMPATIBILITY - REMOVE LATER]
    
    batch.set(attRef, {
       eventId: req.params.id,
       studentId: studentId,
       studentName: reqData.studentName,
       rollNo: reqData.rollNo,
       attendance: attendance,
       status: 'ATTENDED',
       updatedAt: new Date().toISOString()
    }, { merge: true });

    await batch.commit();
    await logAttendanceAudit(req.params.id, {
      action: 'Correction',
      date,
      session,
      studentName: reqData.studentName,
      rollNo: reqData.rollNo,
      previousStatus: oldStatus,
      updatedStatus: newStatus,
      reason: reason || 'Manual correction',
      modifiedBy: req.user.name || req.user.email,
      userRole: req.user.role
    });

    // Recalculate global stats for bulletproof accuracy
    const qSnapshot = await getDocs(query(collection(db, 'odRequests'), where('eventId', '==', req.params.id), where('status', '==', 'APPROVED')));
    let newS1 = 0; let newS2 = 0; let newTotal = 0;
    qSnapshot.forEach(docSnap => {
       const d = docSnap.data();
       const att = d.attendance || {};
       let studentPresentAtAll = false;
       Object.values(att).forEach(dateAtt => {
          if (dateAtt.S1) newS1++;
          if (dateAtt.S2) newS2++;
          if (dateAtt.S1 || dateAtt.S2) studentPresentAtAll = true;
       });
       if (studentPresentAtAll) newTotal++;
    });

    const stats = eventSnap.data().attendanceStats || {};
    stats.s1Present = newS1;
    stats.s2Present = newS2;
    stats.totalPresent = newTotal;
    
    await updateDoc(eventRef, { attendanceStats: stats });

    return res.json({ success: true, message: 'Attendance corrected successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
