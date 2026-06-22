const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { collection, getDocs, doc, updateDoc, writeBatch } = require('firebase/firestore');

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

const CLASSES = [
  'CSE-B', 'CSE-D', 
  'ECE-A', 'ECE-B', 
  'CCE-A', 
  'CSBS-A', 
  'MECH-A', 
  'CYBER-A', 
  'EEE-A', 
  'AIML-A', 
  'AIDS-A'
];
const VALID_ROLES = ['STUDENT_ORGANIZER', 'STUDENT_GENERAL'];

// GET /api/students — fetch all students from all classes
// Optional query param: ?class=CSE-B to filter by a single class
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { class: classFilter } = req.query;

    // Validate class filter if provided
    if (classFilter && !CLASSES.includes(classFilter)) {
      return res.status(400).json({
        success: false,
        message: `Invalid class. Must be one of: ${CLASSES.join(', ')}`,
      });
    }

    const classesToFetch = classFilter ? [classFilter] : CLASSES;
    const allStudents = [];

    for (const className of classesToFetch) {
      const snapshot = await getDocs(collection(db, 'students', className, 'members'));
      snapshot.docs.forEach(d => {
        const data = d.data();
        delete data.password; // never expose passwords
        allStudents.push({ id: d.id, ...data, class: className });
      });
    }

    res.json({ success: true, students: allStudents, total: allStudents.length });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/students/:id/role — update a student's role (make or revoke organizer)
// Body: { role: "STUDENT_ORGANIZER" | "STUDENT_GENERAL", className: "CSE-B" | "CSE-D", isApprovedOrganizer: boolean }
router.patch('/:id/role', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { role, className, isApprovedOrganizer } = req.body;

  if (!role || !className) {
    return res.status(400).json({ success: false, message: 'role and className are required' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      message: `role must be one of: ${VALID_ROLES.join(', ')}`,
    });
  }
  if (!CLASSES.includes(className)) {
    return res.status(400).json({
      success: false,
      message: `className must be one of: ${CLASSES.join(', ')}`,
    });
  }

  try {
    const studentRef = doc(db, 'students', className, 'members', id);
    await updateDoc(studentRef, {
      role,
      isApprovedOrganizer: Boolean(isApprovedOrganizer),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Student role updated successfully', studentId: id, role });
  } catch (err) {
    console.error('Error updating student role:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/students/reset-od-usage — IQAC resets OD count for all students at start of semester
router.post('/reset-od-usage', async (req, res) => {
  if (checkDb(res)) return;
  
  try {
    let totalReset = 0;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const className of CLASSES) {
      const snapshot = await getDocs(collection(db, 'students', className, 'members'));
      for (const studentDoc of snapshot.docs) {
        const studentRef = doc(db, 'students', className, 'members', studentDoc.id);
        batch.update(studentRef, {
          odUsed: 0,
          updatedAt: new Date().toISOString()
        });
        totalReset++;
        batchCount++;

        // Firestore batches support up to 500 operations. We commit at 490 to be safe.
        if (batchCount >= 490) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
    }

    // Commit any remaining operations in the last batch
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`[IQAC] OD usage reset for ${totalReset} students.`);
    res.json({ 
      success: true, 
      message: `Successfully reset OD usage for ${totalReset} students.`,
      count: totalReset 
    });
  } catch (err) {
    console.error('Error resetting OD usage:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/students/:id/od-stats — IQAC updates a student's OD usage or limit
router.patch('/:id/od-stats', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { className, odUsed, odLimit } = req.body;
  
  if (!className) return res.status(400).json({ success: false, message: 'Class name is required' });
  
  try {
    const studentRef = doc(db, 'students', className, 'members', id);
    const updates = { updatedAt: new Date().toISOString() };
    if (odUsed !== undefined) updates.odUsed = Number(odUsed);
    if (odLimit !== undefined) updates.odLimit = Number(odLimit);
    
    await updateDoc(studentRef, updates);
    res.json({ success: true, message: 'OD stats updated successfully' });
  } catch (err) {
    console.error('Error updating OD stats:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
