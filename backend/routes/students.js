const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { collection, getDocs, doc, updateDoc } = require('firebase/firestore');

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

const CLASSES = ['CSE-B', 'CSE-D'];
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

module.exports = router;
