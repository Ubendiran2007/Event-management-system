const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { collection, getDocs, doc, updateDoc, writeBatch, setDoc, deleteDoc } = require('firebase/firestore');
const { requireAuth, requireRole } = require('../middleware/auth');

// Protect all Manage Students APIs
router.use(requireAuth);
router.use(requireRole(['FACULTY', 'HOD', 'IQAC_TEAM']));

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

// POST /api/students — add a single student
router.post('/', async (req, res) => {
  if (checkDb(res)) return;
  const { name, rollNo, email, department, className, section, phone, odLimit, password } = req.body;

  if (!name || !rollNo || !email || !className || !section || !department || !phone) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }
  if (!CLASSES.includes(className)) {
    return res.status(400).json({ success: false, message: `className must be one of: ${CLASSES.join(', ')}` });
  }

  try {
    const studentId = `student_${rollNo}`;
    const studentRef = doc(db, 'students', className, 'members', studentId);
    
    const studentData = {
      name,
      rollNo,
      email,
      username: email,
      class: className,
      section: section || className,
      department: department || '',
      phone: phone || '',
      role: 'STUDENT_GENERAL',
      password: password || rollNo,
      odUsed: 0,
      odLimit: odLimit !== undefined ? Number(odLimit) : 7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      odResetTimestamp: new Date().toISOString()
    };

    await setDoc(studentRef, studentData);
    res.json({ success: true, message: 'Student added successfully', student: { id: studentId, ...studentData } });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/students/bulk — add multiple students
router.post('/bulk', async (req, res) => {
  if (checkDb(res)) return;
  const { students } = req.body;

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ success: false, message: 'An array of students is required' });
  }

  try {
    let batch = writeBatch(db);
    let count = 0;
    const addedStudents = [];

    for (const student of students) {
      const { name, rollNo, email, department, className, section, phone, odLimit, password } = student;
      if (!name || !rollNo || !email || !className || !section || !department || !phone || !CLASSES.includes(className)) continue;

      const studentId = `student_${rollNo}`;
      const studentRef = doc(db, 'students', className, 'members', studentId);
      
      const studentData = {
        name,
        rollNo,
        email,
        username: email,
        class: className,
        section: section || className,
        department: department || '',
        phone: phone || '',
        role: 'STUDENT_GENERAL',
        password: password || rollNo,
        odUsed: 0,
        odLimit: odLimit !== undefined ? Number(odLimit) : 7,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        odResetTimestamp: new Date().toISOString()
      };

      batch.set(studentRef, studentData);
      addedStudents.push({ id: studentId, ...studentData });
      count++;

      if (count % 490 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }

    if (count % 490 !== 0) {
      await batch.commit();
    }

    res.json({ success: true, message: `Successfully added ${count} students`, addedCount: count, students: addedStudents });
  } catch (err) {
    console.error('Error bulk adding students:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/students/:id — update a student
router.put('/:id', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { className, ...updateData } = req.body;

  if (!className || !CLASSES.includes(className)) {
    return res.status(400).json({ success: false, message: 'Valid className is required' });
  }

  try {
    const studentRef = doc(db, 'students', className, 'members', id);
    // Don't allow changing core ID fields directly or setting empty class
    delete updateData.id;
    updateData.updatedAt = new Date().toISOString();

    await updateDoc(studentRef, updateData);
    res.json({ success: true, message: 'Student updated successfully' });
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/students/:id — delete a student
router.delete('/:id', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { className } = req.body; // or req.query

  const targetClass = className || req.query.className;

  if (!targetClass || !CLASSES.includes(targetClass)) {
    return res.status(400).json({ success: false, message: 'Valid className is required' });
  }

  try {
    const studentRef = doc(db, 'students', targetClass, 'members', id);
    await deleteDoc(studentRef);
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    console.error('Error deleting student:', err);
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
    // Record the exact moment of reset. odSync will only count OD requests
    // created AFTER this timestamp, so historical approvals are excluded.
    const resetTimestamp = new Date().toISOString();

    let totalReset = 0;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const className of CLASSES) {
      const snapshot = await getDocs(collection(db, 'students', className, 'members'));
      for (const studentDoc of snapshot.docs) {
        const studentRef = doc(db, 'students', className, 'members', studentDoc.id);

        batch.update(studentRef, {
          odUsed: 0,                         // Reset stored count to zero
          odLimit: 7,                        // Restore annual maximum limit
          odResetTimestamp: resetTimestamp,  // Mark the reset moment
          updatedAt: resetTimestamp
        });
        totalReset++;
        batchCount++;

        // Firestore batches support up to 500 operations — commit at 490 to be safe
        if (batchCount >= 490) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`[IQAC] OD usage reset for ${totalReset} students at ${resetTimestamp}.`);
    res.json({
      success: true,
      message: `Successfully reset OD usage for ${totalReset} students.`,
      count: totalReset,
      resetTimestamp
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
