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

  if (!studentId || !studentName || !description) {
    return res.status(400).json({ success: false, message: 'studentId, studentName and description are required' });
  }

  try {
    const newRequest = {
      studentId,
      studentName,
      rollNo: rollNo || '',
      className: className || '',
      department: department || '',
      description,
      requestedCount: Number(requestedCount) || 0,
      requestedLimit: Number(requestedLimit) || 0,
      status: 'PENDING_FACULTY',
      createdAt: new Date().toISOString(),
      history: [{ status: 'PENDING_FACULTY', time: new Date().toISOString(), user: studentName }]
    };

    const docRef = await addDoc(collection(db, 'correctionRequests'), newRequest);

    // Notify Faculty — non-fatal: email failure must NOT crash the submission
    try {
      const facultyEmails = await getDeptStaffEmails(department, 'FACULTY');
      for (const email of facultyEmails) {
        try {
          await sendEmail({
            to: email,
            subject: `New OD Correction Request: ${studentName}`,
            text: `Student ${studentName} (${rollNo}) has requested an OD count correction.\nDescription: ${description}`
          });
        } catch (mailErr) {
          console.warn('[correctionRequests/POST] Email to faculty failed:', mailErr.message);
        }
      }
    } catch (emailLookupErr) {
      console.warn('[correctionRequests/POST] Faculty email lookup failed:', emailLookupErr.message);
    }

    res.json({ success: true, id: docRef.id });
  } catch (err) {
    console.error('[correctionRequests/POST] Error:', err);
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

    // Final Action: Update student OD count if COMPLETED
    if (nextStatus === 'COMPLETED') {
      try {
        // Query top-level users collection by studentId
        const usersSnap = await getDocs(query(collection(db, 'users'), where('id', '==', requestData.studentId)));
        if (!usersSnap.empty) {
          const studentDocRef = usersSnap.docs[0].ref;
          const studentUpdates = {};
          if (requestData.requestedCount !== undefined) studentUpdates.odUsed = requestData.requestedCount;
          if (requestData.requestedLimit !== undefined) studentUpdates.odLimit = requestData.requestedLimit;
          await updateDoc(studentDocRef, studentUpdates);
        } else {
          console.warn('[correctionRequests/PATCH] Student user doc not found for id:', requestData.studentId);
        }
      } catch (updateErr) {
        console.error('[correctionRequests/PATCH] Failed to update student OD counts:', updateErr.message);
      }
    }

    // Email Notifications — all non-fatal
    try {
      const studentEmail = requestData.rollNo
        ? `${String(requestData.rollNo).toLowerCase()}@sece.ac.in`
        : null;
      if (studentEmail) {
        await sendEmail({
          to: studentEmail,
          subject: `OD Correction Request Update: ${nextStatus}`,
          text: `Your OD correction request status has been updated to: ${nextStatus}.\nRemarks: ${remarks || 'None'}`
        });
      }
    } catch (mailErr) {
      console.warn('[correctionRequests/PATCH] Student email failed:', mailErr.message);
    }

    // Notify next approver in line
    try {
      if (nextStatus === 'PENDING_HOD') {
        const hodEmails = await getDeptStaffEmails(requestData.department, 'HOD');
        for (const email of hodEmails) {
          try {
            await sendEmail({
              to: email,
              subject: `Pending OD Correction Approval: ${requestData.studentName}`,
              text: `Faculty has approved a correction request for ${requestData.studentName}. Please review.`
            });
          } catch (e) { console.warn('[correctionRequests/PATCH] HOD email failed:', e.message); }
        }
      } else if (nextStatus === 'PENDING_IQAC') {
        const iqacEmails = await getDeptStaffEmails(null, 'IQAC_TEAM').catch(() => []);
        const targets = iqacEmails.length > 0 ? iqacEmails : ['iqac@sece.ac.in'];
        for (const email of targets) {
          try {
            await sendEmail({
              to: email,
              subject: `Pending OD Correction Approval: ${requestData.studentName}`,
              text: `HOD has approved a correction request for ${requestData.studentName}. Final IQAC approval required.`
            });
          } catch (e) { console.warn('[correctionRequests/PATCH] IQAC email failed:', e.message); }
        }
      }
    } catch (notifyErr) {
      console.warn('[correctionRequests/PATCH] Next-approver notification failed:', notifyErr.message);
    }

    res.json({ success: true, nextStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
