const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { collection, getDocs, doc, getDoc, addDoc, updateDoc } = require('firebase/firestore');

const STUDENT_CLASS_DOCS = ['CSE-B', 'CSE-D'];

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
  for (const className of STUDENT_CLASS_DOCS) {
    const studentRef = doc(db, 'students', className, 'members', studentId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      return { className, ...studentSnap.data() };
    }
  }
  return null;
};

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

const VALID_STATUSES = ['PENDING_ORGANIZER', 'APPROVED', 'REJECTED', 'WITHDRAWN'];

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

    const studentRecord = await findStudentInFirestore(studentId);
    const normalizedRollNo =
      normalizeRollNo(studentRecord?.rollNo) ||
      normalizeRollNo(rollNo) ||
      normalizeRollNo(studentId); // always falls back to studentId — never empty
    const normalizedClassSection = resolveClassSection(studentRecord, studentClass);

    const requestedType = registrationType === 'VOLUNTEER' ? 'VOLUNTEER' : 'PARTICIPANT';
    const allowVolunteer = Boolean(event.registrationOptions?.allowVolunteer);
    const normalizedRegistrationType = allowVolunteer ? requestedType : 'PARTICIPANT';

    // Check for any existing OD request for this student+event
    const snapshot = await getDocs(collection(db, 'odRequests'));
    const existingDoc = snapshot.docs.find(d => {
      const r = d.data();
      return r.eventId === eventId && r.studentId === studentId;
    });

    if (existingDoc) {
      const existingStatus = existingDoc.data().status;
      // Block if already active
      if (existingStatus !== 'WITHDRAWN' && existingStatus !== 'REJECTED') {
        return res.status(409).json({ success: false, message: 'Already registered for this event' });
      }
      // Re-registration: reset the existing doc instead of creating a new one
      const reActivated = {
        eventTitle: event.title || '',
        eventDate: event.date || '',
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
      return res.status(200).json({ success: true, odRequest: { id: existingDoc.id, ...existingDoc.data(), ...reActivated } });
    }

    const odData = {
      eventId,
      eventTitle: event.title || '',
      eventDate: event.date || '',
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
    const snapshot = await getDocs(collection(db, 'odRequests'));
    let requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (eventId)     requests = requests.filter(r => r.eventId === eventId);
    if (studentId)   requests = requests.filter(r => r.studentId === studentId);
    if (organizerId) requests = requests.filter(r => r.organizerId === organizerId);
    if (status)      requests = requests.filter(r => r.status === status);

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

    const update = { status, updatedAt: new Date().toISOString() };
    if (status === 'APPROVED') {
      update.approvedAt = new Date().toISOString();
      update.approvedBy = approvedBy || 'Organizer';
    }
    if (status === 'REJECTED') {
      update.rejectedAt = new Date().toISOString();
      update.rejectedBy = approvedBy || 'Organizer';
    }

    await updateDoc(odRef, update);
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

    await updateDoc(odRef, {
      status: 'WITHDRAWN',
      withdrawnAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
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
