const express = require('express');
const router = express.Router();

const { collection, getDocs, doc, getDoc, addDoc, updateDoc, db, collectionGroup, query, where, limit } = require('../firebaseClientWrapper');
const { getAllSectionDocs } = require('../utils/studentHelper');
const eventPublisher = require('../events/publishers/eventPublisher');
const crypto = require('crypto');
const { syncStudentODCount } = require('../utils/odSync');

const normalizeRollNo = (value) =>
  String(value || '')
    .trim()
    .replace(/^student_/i, '')
    .toUpperCase();

const compactClassSection = (value) =>
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

const resolveClassSection = (studentRecord, payloadClass = '') => {
  const classVal = String(studentRecord?.class || '').trim();
  const sectionVal = String(studentRecord?.section || '').trim();
  const payloadVal = String(payloadClass || '').trim();

  // Prefer explicit class+section from Firestore when available.
  if (classVal && sectionVal) {
    if (classVal.toLowerCase() === sectionVal.toLowerCase()) {
      return compactClassSection(classVal);
    }
    return compactClassSection(`${classVal}${sectionVal}`);
  }
  if (classVal) return compactClassSection(classVal);
  if (sectionVal) return compactClassSection(sectionVal);
  return compactClassSection(payloadVal);
};

const findStudentInFirestore = async (studentId) => {
  try {
    const sectionDocs = await getAllSectionDocs();
    for (const secDoc of sectionDocs) {
      const arr = secDoc.data.students || [];
      const data = arr.find(s => s.id === studentId);
      if (data) {
        return { className: data.class || data.section, ref: secDoc.ref, studentIndex: arr.findIndex(s => s.id === studentId), ...data };
      }
    }
    return null;
  } catch (err) {
    console.error(`[findStudentInFirestore] Error fetching student ${studentId}:`, err.message);
    return null;
  }
};

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

const VALID_STATUSES = ['PENDING_ORGANIZER', 'PENDING_FACULTY', 'PENDING_HOD', 'PENDING_IQAC', 'PENDING_PRINCIPAL', 'APPROVED', 'REJECTED', 'WITHDRAWN'];

// POST /api/od-requests — student registers for an event
router.post('/', async (req, res) => {
  if (checkDb(res)) return;
  const {
    eventId,
    studentId,
    studentName,
    rollNo,
    class: studentClass,
    email,
    reason,
    registrationType,
    department,
  } = req.body;

  if (!eventId || !studentId || !studentName) {
    return res.status(400).json({
      success: false,
      message: 'eventId, studentId, studentName are required',
    });
  }

  try {
    // Fetch event to get metadata
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const event = eventSnap.data();

    // Dynamic Registration Lock Check
    const sDate = event.requisition?.step1?.eventStartDate || event.date;
    const sTime = event.requisition?.step1?.eventStartTime || event.startTime || '00:00';
    let isLocked = event.registrationLocked;
    if (sDate && !isLocked) {
      const [y, mo, d] = String(sDate).split('-').map(Number);
      const [h, m] = String(sTime).split(':').map(Number);
      const eventStart = new Date(y, mo - 1, d, h, m, 0, 0).getTime();
      if (new Date().getTime() >= eventStart) isLocked = true;
    }
    if (isLocked) {
      return res.status(403).json({ success: false, message: 'Event has started. Registrations are now locked.' });
    }

    const studentRecord = await findStudentInFirestore(studentId);
    
    // Check OD participation limit (e.g. 7 ODs per semester)
    const odUsed = studentRecord?.odUsed || 0;
    const odLimit = studentRecord?.odLimit || 7;
    if (odUsed >= odLimit) {
      return res.status(403).json({
        success: false,
        message: `You have reached your semester limit of ${odLimit} ODs. Please contact IQAC if you believe this is an error.`
      });
    }

    const normalizedRollNo =
      normalizeRollNo(studentRecord?.rollNo) ||
      normalizeRollNo(rollNo) ||
      normalizeRollNo(studentId); // always falls back to studentId — never empty
    const normalizedClassSection = resolveClassSection(studentRecord, studentClass);

    const requestedType = registrationType === 'VOLUNTEER' ? 'VOLUNTEER' : 'PARTICIPANT';
    const allowVolunteer = Boolean(event.registrationOptions?.allowVolunteer);
    const normalizedRegistrationType = allowVolunteer ? requestedType : 'PARTICIPANT';

    // Check for any existing OD request for this student+event
    const qDup = query(
      collection(db, 'odRequests'),
      where('eventId', '==', eventId),
      where('studentId', '==', studentId),
      limit(1)
    );
    const snapshot = await getDocs(qDup);
    const existingDoc = snapshot.empty ? null : snapshot.docs[0];

    if (existingDoc) {
      const existingStatus = existingDoc.data().status;
      // Block if already active
      if (existingStatus !== 'WITHDRAWN' && existingStatus !== 'REJECTED') {
        return res.status(409).json({ success: false, message: 'Already registered for this event' });
      }

      const s1 = event.requisition?.step1;
      let eventDisplayDate = event.date || '';
      if (s1?.eventStartDate && s1?.eventEndDate) {
        eventDisplayDate = s1.eventStartDate === s1.eventEndDate
          ? s1.eventStartDate
          : `${s1.eventStartDate} - ${s1.eventEndDate}`;
      }

      // Re-registration: reset the existing doc instead of creating a new one
      const reActivated = {
        eventTitle: event.title || '',
        eventDate: eventDisplayDate,
        eventVenue: event.venue || '',
        organizerId: event.organizerId || '',
        organizerName: event.organizerName || '',
        studentName,
        rollNo: normalizedRollNo,
        class: normalizedClassSection || '',
        department: department || studentRecord?.department || '',
        email: email || '',
        registrationType: normalizedRegistrationType,
        reason:
          reason ||
          (normalizedRegistrationType === 'VOLUNTEER'
            ? 'Interested in volunteering for the event'
            : 'Interested in participating in the event'),
        status: 'PENDING_ORGANIZER',
        createdAt: new Date().toISOString(),
        // clear old terminal fields
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        withdrawnAt: null,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'odRequests', existingDoc.id), reActivated);
      
      eventPublisher.publishOdRequested({
        odId: existingDoc.id,
        studentId,
        studentName,
        approverIds: event.organizerId ? [event.organizerId] : [], // Goes to organizer first
        eventId,
        eventTitle: event.title || '',
        correlationId: crypto.randomUUID()
      });

      return res.status(200).json({ success: true, odRequest: { id: existingDoc.id, ...existingDoc.data(), ...reActivated } });
    }

    const s1_new = event.requisition?.step1;
    let eventDisplayDate_new = event.date || '';
    if (s1_new?.eventStartDate && s1_new?.eventEndDate) {
      eventDisplayDate_new = s1_new.eventStartDate === s1_new.eventEndDate
        ? s1_new.eventStartDate
        : `${s1_new.eventStartDate} - ${s1_new.eventEndDate}`;
    }

    const odData = {
      eventId,
      eventTitle: event.title || '',
      eventDate: eventDisplayDate_new,
      eventVenue: event.venue || '',
      organizerId: event.organizerId || '',
      organizerName: event.organizerName || '',
      studentId,
      studentName,
      rollNo: normalizedRollNo,
      class: normalizedClassSection || '',
      department: department || studentRecord?.department || '',
      email: email || '',
      registrationType: normalizedRegistrationType,
      reason:
        reason ||
        (normalizedRegistrationType === 'VOLUNTEER'
          ? 'Interested in volunteering for the event'
          : 'Interested in participating in the event'),
      status: 'PENDING_ORGANIZER',
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'odRequests'), odData);
    
    eventPublisher.publishOdRequested({
      odId: docRef.id,
      studentId,
      studentName,
      approverIds: event.organizerId ? [event.organizerId] : [],
      eventId,
      eventTitle: event.title || '',
      correlationId: crypto.randomUUID()
    });

    res.status(201).json({ success: true, odRequest: { id: docRef.id, ...odData } });
  } catch (err) {
    console.error('Error creating OD request:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/od-requests — list with optional filters: eventId, studentId, organizerId, status
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  const { eventId, studentId, organizerId, status } = req.query;

  try {
    let constraints = [];
    if (eventId) constraints.push(where('eventId', '==', eventId));
    if (studentId) constraints.push(where('studentId', '==', studentId));
    if (organizerId) constraints.push(where('organizerId', '==', organizerId));
    if (status) constraints.push(where('status', '==', status));

    const qList = constraints.length > 0 
      ? query(collection(db, 'odRequests'), ...constraints) 
      : collection(db, 'odRequests');
      
    const snapshot = await getDocs(qList);
    let requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Never expose passwords (shouldn't be here but defensive)
    requests = requests.map(r => {
      const normalized = { ...r };
      normalized.rollNo = normalizeRollNo(normalized.rollNo || normalized.studentId);
      normalized.class = compactClassSection(normalized.class);
      delete normalized.password;
      return normalized;
    });

    res.json({ success: true, odRequests: requests, total: requests.length });
  } catch (err) {
    console.error('Error fetching OD requests:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/od-requests/:id/status — organizer approves or rejects a student registration
router.patch('/:id/status', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { status, approvedBy } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });
  }

  try {
    const odRef = doc(db, 'odRequests', id);
    const odSnap = await getDoc(odRef);
    if (!odSnap.exists()) {
      return res.status(404).json({ success: false, message: 'OD request not found' });
    }
    
    const current = odSnap.data();

    const eventSnap = await getDoc(doc(db, 'events', current.eventId));
    if (eventSnap.exists()) {
      const event = eventSnap.data();
      const sDate = event.requisition?.step1?.eventStartDate || event.date;
      const sTime = event.requisition?.step1?.eventStartTime || event.startTime || '00:00';
      let isLocked = event.registrationLocked;
      if (sDate && !isLocked) {
        const [y, mo, d] = String(sDate).split('-').map(Number);
        const [h, m] = String(sTime).split(':').map(Number);
        const eventStart = new Date(y, mo - 1, d, h, m, 0, 0).getTime();
        if (new Date().getTime() >= eventStart) isLocked = true;
      }
      if (isLocked) {
        return res.status(403).json({ success: false, message: 'Event has started. Registration status cannot be modified.' });
      }
    }

    const update = { status, updatedAt: new Date().toISOString() };
    
    // Store remarks if provided
    if (req.body.remarks) {
      update.remarks = req.body.remarks;
    }

    if (status === 'PENDING_HOD') {
      update.facultyApprovedBy = approvedBy || 'Faculty';
      update.facultyApprovedAt = new Date().toISOString();
    }
    if (status === 'PENDING_IQAC' || status === 'PENDING_PRINCIPAL') {
      update.hodApprovedBy = approvedBy || 'HOD';
      update.hodApprovedAt = new Date().toISOString();
    }
    if (status === 'APPROVED') {
      update.iqacApprovedBy = approvedBy || 'IQAC';
      update.iqacApprovedAt = new Date().toISOString();
      update.approvedAt = new Date().toISOString();
      update.approvedBy = approvedBy || 'Organizer';
    }
    if (status === 'REJECTED') {
      update.rejectedAt = new Date().toISOString();
      update.rejectedBy = approvedBy || 'Organizer';
      // Record which stage rejected it
      if (!current.facultyApprovedBy) update.facultyRejectedAt = new Date().toISOString();
      else if (!current.hodApprovedBy) update.hodRejectedAt = new Date().toISOString();
      else update.iqacRejectedAt = new Date().toISOString();
    }

    await updateDoc(odRef, update);

    // Handle OD Usage Count synchronization dynamically
    if (current.studentId && (status === 'APPROVED' || current.status === 'APPROVED')) {
      try {
        await syncStudentODCount(current.studentId);
      } catch (err) {
        console.error('[odRequests/status] Failed to sync OD usage:', err.message);
      }
    }

    // ── Background Notifications (centralized handler) ─────────────────
    (async () => {
      try {
        const payload = {
          odId: id,
          studentId: current.studentId,
          studentName: current.studentName,
          eventId: current.eventId,
          eventTitle: current.eventTitle,
          reason: req.body.remarks || '',
          correlationId: crypto.randomUUID()
        };

        if (status === 'PENDING_HOD') {
          // Faculty Approved
          payload.facultyId = req.user?.uid || update.facultyApprovedBy;
          payload.hodIds = current.department ? [`hod_${current.department}`] : []; // Example: target HOD by dept
          eventPublisher.publishOdFacultyApproved(payload);
        } else if (status === 'PENDING_IQAC' || status === 'PENDING_PRINCIPAL') {
          // HOD Approved
          payload.hodId = req.user?.uid || update.hodApprovedBy;
          eventPublisher.publishOdHodApproved(payload);
        } else if (status === 'REJECTED') {
          payload.actorId = req.user?.uid || update.rejectedBy;
          eventPublisher.publishOdRejected(payload);
        } else if (status === 'APPROVED') {
          // Final Approval - for OD, maybe we just use OdHodApproved for final, 
          // or we can add OdApproved if needed. 
          // For now, if IQAC approves, we'll map it to OdHodApproved (since it notifies student).
          payload.hodId = req.user?.uid || update.iqacApprovedBy;
          eventPublisher.publishOdHodApproved(payload);
        }
      } catch (err) {
        console.error('[odRequests/status/bg] Error publishing OD event:', err.message);
      }
    })();

    res.json({ success: true, message: 'Status updated', id, status });
  } catch (err) {
    console.error('Error updating OD request status:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/od-requests/:id/withdraw — student withdraws their own OD request
router.patch('/:id/withdraw', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;

  try {
    const odRef = doc(db, 'odRequests', id);
    const odSnap = await getDoc(odRef);
    if (!odSnap.exists()) {
      return res.status(404).json({ success: false, message: 'OD request not found' });
    }
    const current = odSnap.data();
    if (current.status === 'REJECTED' || current.status === 'WITHDRAWN') {
      return res.status(400).json({ success: false, message: `Cannot withdraw a request that is already ${current.status.toLowerCase()}` });
    }

    const eventSnap = await getDoc(doc(db, 'events', current.eventId));
    if (eventSnap.exists()) {
      const event = eventSnap.data();
      const sDate = event.requisition?.step1?.eventStartDate || event.date;
      const sTime = event.requisition?.step1?.eventStartTime || event.startTime || '00:00';
      let isLocked = event.registrationLocked;
      if (sDate && !isLocked) {
        const [y, mo, d] = String(sDate).split('-').map(Number);
        const [h, m] = String(sTime).split(':').map(Number);
        const eventStart = new Date(y, mo - 1, d, h, m, 0, 0).getTime();
        if (new Date().getTime() >= eventStart) isLocked = true;
      }
      if (event.status === 'CANCELLED') {
        return res.status(403).json({ success: false, message: 'Event has been cancelled. Registrations cannot be withdrawn.' });
      }
      if (isLocked) {
        return res.status(403).json({ success: false, message: 'Event has started or registration is locked. Registrations cannot be withdrawn.' });
      }
    }

    await updateDoc(odRef, {
      status: 'WITHDRAWN',
      withdrawnAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // If it was already approved, sync the student's OD usage to accurately reflect the withdrawal
    if (current.status === 'APPROVED' && current.studentId) {
      try {
        await syncStudentODCount(current.studentId);
      } catch (err) {
        console.error('[odRequests/withdraw] Failed to sync OD usage:', err.message);
      }
    }
    res.json({ success: true, message: 'OD request withdrawn successfully', id });
  } catch (err) {
    console.error('Error withdrawing OD request:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/od-requests/:id/feedback — approved student submits event feedback
router.patch('/:id/feedback', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { rating, comment } = req.body;

  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    return res.status(400).json({ success: false, message: 'rating must be 1–5' });
  }

  try {
    const odRef = doc(db, 'odRequests', id);
    const odSnap = await getDoc(odRef);
    if (!odSnap.exists()) {
      return res.status(404).json({ success: false, message: 'OD request not found' });
    }
    if (odSnap.data().status !== 'APPROVED') {
      return res.status(403).json({ success: false, message: 'Only approved participants can submit feedback' });
    }

    await updateDoc(odRef, {
      feedback: {
        rating: numRating,
        comment: comment || '',
        submittedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
