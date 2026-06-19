const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { collection, addDoc, getDocs, doc, updateDoc, getDoc, query, where } = require('firebase/firestore');
const { sendEmail } = require('../services/emailService');

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

async function getDeptStaffEmails(dept, role) {
  if (!dept || !db) return [];
  try {
    const q = query(
      collection(db, 'users'), 
      where('role', '==', role), 
      where('department', '==', dept)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data().email).filter(Boolean);
  } catch (err) {
    console.error('Error fetching staff emails:', err);
    return [];
  }
}

// GET /api/corrections - Fetch requests based on role and department
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  const { role, department, userId } = req.query;

  try {
    let q;
    const correctionsRef = collection(db, 'correctionRequests');

    if (role === 'STUDENT_GENERAL' || role === 'STUDENT_ORGANIZER') {
      q = query(correctionsRef, where('studentId', '==', userId));
    } else if (role === 'FACULTY') {
      q = query(correctionsRef, where('department', '==', department), where('status', '==', 'PENDING_FACULTY'));
    } else if (role === 'HOD') {
      q = query(correctionsRef, where('department', '==', department), where('status', '==', 'PENDING_HOD'));
    } else if (role === 'IQAC_TEAM') {
      q = query(correctionsRef, where('status', '==', 'PENDING_IQAC'));
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/corrections - Student submits a request
router.post('/', async (req, res) => {
  if (checkDb(res)) return;
  const { studentId, studentName, rollNo, className, department, description, requestedCount, requestedLimit } = req.body;

  try {
    const newRequest = {
      studentId,
      studentName,
      rollNo,
      className,
      department,
      description,
      requestedCount: Number(requestedCount),
      requestedLimit: Number(requestedLimit),
      status: 'PENDING_FACULTY',
      createdAt: new Date().toISOString(),
      history: [{ status: 'PENDING_FACULTY', time: new Date().toISOString(), user: studentName }]
    };

    const docRef = await addDoc(collection(db, 'correctionRequests'), newRequest);
    
    // Notify Faculty (Actual registered emails)
    const facultyEmails = await getDeptStaffEmails(department, 'FACULTY');
    for (const email of facultyEmails) {
      await sendEmail({
        to: email,
        subject: `New OD Correction Request: ${studentName}`,
        text: `Student ${studentName} (${rollNo}) has requested an OD count correction.\nDescription: ${description}`
      });
    }

    res.json({ success: true, id: docRef.id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/corrections/:id/status - Approve/Reject workflow
router.patch('/:id/status', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { status, remarks, approvedBy, role } = req.body;

  try {
    const requestRef = doc(db, 'correctionRequests', id);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) return res.status(404).json({ success: false, message: 'Request not found' });
    const requestData = requestSnap.data();

    let nextStatus = status;
    if (status === 'APPROVED') {
      if (role === 'FACULTY') nextStatus = 'PENDING_HOD';
      else if (role === 'HOD') nextStatus = 'PENDING_IQAC';
      else if (role === 'IQAC_TEAM') nextStatus = 'COMPLETED';
    } else if (status === 'REJECTED') {
      nextStatus = 'REJECTED';
    }

    const updates = {
      status: nextStatus,
      [`${role.toLowerCase()}Remarks`]: remarks,
      history: [...requestData.history, { status: nextStatus, time: new Date().toISOString(), user: approvedBy, remarks }]
    };

    await updateDoc(requestRef, updates);

    // Final Action: Update student count if COMPLETED
    if (nextStatus === 'COMPLETED') {
      const studentRef = doc(db, 'students', requestData.className, 'members', requestData.studentId);
      const studentUpdates = {};
      if (requestData.requestedCount !== undefined) studentUpdates.odUsed = requestData.requestedCount;
      if (requestData.requestedLimit !== undefined) studentUpdates.odLimit = requestData.requestedLimit;
      await updateDoc(studentRef, studentUpdates);
    }

    // Email Notifications
    const studentEmail = `${requestData.rollNo.toLowerCase()}@sece.ac.in`; // Mock
    await sendEmail({
      to: studentEmail,
      subject: `OD Correction Request Update: ${nextStatus}`,
      text: `Your OD correction request status has been updated to: ${nextStatus}.\nRemarks: ${remarks || 'None'}`
    });

    // Notify next in line
    if (nextStatus === 'PENDING_HOD') {
      const hodEmails = await getDeptStaffEmails(requestData.department, 'HOD');
      for (const email of hodEmails) {
        await sendEmail({
          to: email,
          subject: `Pending OD Correction Approval: ${requestData.studentName}`,
          text: `Faculty has approved a correction request for ${requestData.studentName}. Please review.`
        });
      }
    } else if (nextStatus === 'PENDING_IQAC') {
      await sendEmail({
        to: 'iqac@sece.ac.in',
        subject: `Pending OD Correction Approval: ${requestData.studentName}`,
        text: `HOD has approved a correction request for ${requestData.studentName}. Final IQAC approval required.`
      });
    }

    res.json({ success: true, nextStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
