const express = require('express');
const router = express.Router();

const { collection, getDocs, doc, getDoc, updateDoc, writeBatch, setDoc, deleteDoc, db } = require('../firebaseClientWrapper');
const { requireAuth, requireRole } = require('../middleware/auth');
const { buildStudentData } = require('../services/userService');

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

const VALID_ROLES = ['STUDENT_ORGANIZER', 'STUDENT_GENERAL'];
const { getAllSectionDocs } = require('../utils/studentHelper');

// --- CACHE IMPLEMENTATION ---
let cachedStudents = null;

const invalidateCache = () => {
  cachedStudents = null;
};
// ----------------------------

// GET /api/students — fetch all students
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { batch, department, section, class: classFilter } = req.query;

    let allStudents = [];
    
    if (cachedStudents) {
      allStudents = cachedStudents;
    } else {
      const sectionDocs = await getAllSectionDocs();
      
      sectionDocs.forEach(secDoc => {
        const studentsArray = secDoc.data.students || [];
        studentsArray.forEach(data => {
          // Create a copy without password
          const { password, ...safeData } = data;
          allStudents.push(safeData);
        });
      });
      cachedStudents = allStudents;
    }

    // Apply filters
    if (batch || department || section || classFilter) {
      allStudents = allStudents.filter(safeData => {
        if (batch && safeData.academicBatch !== batch) return false;
        if (department && safeData.department !== department) return false;
        if (section && safeData.section !== section) return false;
        if (classFilter && safeData.class !== classFilter) return false;
        return true;
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
  const { name, rollNo, email, department, className, section, phone, odLimit, password, academicBatch } = req.body;

  if (!name || !rollNo || !email || !department || !phone || !academicBatch || (!className && !section)) {
    return res.status(400).json({ success: false, message: 'Missing required fields including academicBatch, department, and section/class' });
  }

  try {
    const { studentId, studentData } = await buildStudentData(req.body);
    studentData.id = studentId;

    const actualSection = section || className;
    const actualDept = department.toUpperCase();
    const studentRef = doc(db, 'students', academicBatch, actualDept, actualSection.toUpperCase());
    
    const snap = await getDoc(studentRef);
    if (!snap.exists()) {
      await setDoc(studentRef, { 
        batch: academicBatch, 
        department: actualDept, 
        section: actualSection.toUpperCase(), 
        students: [studentData] 
      });
    } else {
      const data = snap.data();
      const students = data.students || [];
      students.push(studentData);
      await updateDoc(studentRef, { students });
    }
    
    invalidateCache();
    res.json({ success: true, message: 'Student added successfully', student: studentData });
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
    const actorEmail = req.user?.email || 'SYSTEM';

    // Pre-fetch all students to detect database duplicates
    const existingEmails = new Set();
    const existingRollNos = new Set();
    
    const sectionDocs = await getAllSectionDocs();
    sectionDocs.forEach(secDoc => {
      const arr = secDoc.data.students || [];
      arr.forEach(s => {
        if (s.rollNo) existingRollNos.add(s.rollNo.toUpperCase());
        if (s.email) existingEmails.add(s.email.toLowerCase());
      });
    });

    const validToImport = [];
    const dbDuplicates = [];

    for (const student of students) {
      const { rollNo, email, academicBatch, department } = student;
      const actualSection = student.section || student.className;
      
      if (!academicBatch || !department || !actualSection) continue;

      const isDup = (rollNo && existingRollNos.has(rollNo.toUpperCase())) || 
                    (email && existingEmails.has(email.toLowerCase()));
      
      if (isDup) {
        dbDuplicates.push(student);
      } else {
        validToImport.push(student);
      }
    }

    if (validToImport.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No new students to import', 
        importedCount: 0, 
        dbDuplicatesCount: dbDuplicates.length 
      });
    }

    // Group valid imports by section doc path
    const importsByPath = {};
    const addedStudents = [];

    for (let i = 0; i < validToImport.length; i++) {
      const student = validToImport[i];
      const { studentId, studentData } = await buildStudentData(student);
      studentData.id = studentId;
      
      const actualSection = student.section || student.className;
      const actualDept = student.department.toUpperCase();
      const path = `students/${student.academicBatch}/${actualDept}/${actualSection.toUpperCase()}`;
      
      if (!importsByPath[path]) importsByPath[path] = { batch: student.academicBatch, dept: actualDept, sec: actualSection.toUpperCase(), students: [] };
      importsByPath[path].students.push(studentData);
      addedStudents.push(studentData);
    }

    let writeBatchFirebase = writeBatch(db);
    
    for (const path of Object.keys(importsByPath)) {
      const group = importsByPath[path];
      const ref = doc(db, path.split('/')[0], path.split('/')[1], path.split('/')[2], path.split('/')[3]);
      const snap = await getDoc(ref);
      
      if (snap.exists()) {
        const existingArr = snap.data().students || [];
        writeBatchFirebase.update(ref, { students: [...existingArr, ...group.students] });
      } else {
        writeBatchFirebase.set(ref, {
          batch: group.batch,
          department: group.dept,
          section: group.sec,
          students: group.students
        });
      }
    }
    
    await writeBatchFirebase.commit();

    const { logActivity } = require('../utils/logger');
    logActivity({
      category: 'USER_MANAGEMENT',
      action: 'Bulk Import Students',
      status: 'SUCCESS',
      actor: { userId: actorEmail, email: actorEmail, name: req.user?.name || 'System', role: req.user?.role || 'SYSTEM' },
      details: { 
        imported: addedStudents.length,
        dbDuplicates: dbDuplicates.length
      }
    });

    invalidateCache();

    res.json({ 
      success: true, 
      message: `Successfully added ${addedStudents.length} students`, 
      importedCount: addedStudents.length, 
      dbDuplicatesCount: dbDuplicates.length,
      students: addedStudents 
    });
  } catch (err) {
    console.error('Error bulk adding students:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/students/:id — update a student
router.put('/:id', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const updateData = req.body;
  delete updateData.className; 

  try {
    const sectionDocs = await getAllSectionDocs();
    let targetDoc = null;
    let studentIndex = -1;
    let studentsArray = [];

    for (const secDoc of sectionDocs) {
      const arr = secDoc.data.students || [];
      const idx = arr.findIndex(s => s.id === id);
      if (idx !== -1) {
        targetDoc = secDoc;
        studentIndex = idx;
        studentsArray = arr;
        break;
      }
    }

    if (!targetDoc) {
      return res.status(404).json({ success: false, message: 'Student not found in any class' });
    }

    // Check for email/rollNo uniqueness against ALL students except this one
    if (updateData.email || updateData.rollNo) {
      let conflict = false;
      for (const secDoc of sectionDocs) {
        const arr = secDoc.data.students || [];
        for (const s of arr) {
          if (s.id !== id) {
            if (updateData.email && s.email.toLowerCase() === updateData.email.toLowerCase()) conflict = true;
            if (updateData.rollNo && s.rollNo.toUpperCase() === updateData.rollNo.toUpperCase()) conflict = true;
          }
        }
      }
      if (conflict) {
         return res.status(400).json({ success: false, message: 'Email or Roll Number already exists in another student record' });
      }
    }

    delete updateData.id;
    updateData.updatedAt = new Date().toISOString();
    
    studentsArray[studentIndex] = { ...studentsArray[studentIndex], ...updateData };

    await updateDoc(targetDoc.ref, { students: studentsArray });
    invalidateCache();
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

  try {
    const sectionDocs = await getAllSectionDocs();
    let targetDoc = null;
    let studentsArray = [];

    for (const secDoc of sectionDocs) {
      const arr = secDoc.data.students || [];
      const idx = arr.findIndex(s => s.id === id);
      if (idx !== -1) {
        targetDoc = secDoc;
        studentsArray = arr;
        studentsArray.splice(idx, 1);
        break;
      }
    }

    if (!targetDoc) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    await updateDoc(targetDoc.ref, { students: studentsArray });
    invalidateCache();
    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/students/:id/role — change student role
router.put('/:id/role', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { role, isApprovedOrganizer } = req.body;

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  try {
    const sectionDocs = await getAllSectionDocs();
    let targetDoc = null;
    let studentIndex = -1;
    let studentsArray = [];

    for (const secDoc of sectionDocs) {
      const arr = secDoc.data.students || [];
      const idx = arr.findIndex(s => s.id === id);
      if (idx !== -1) {
        targetDoc = secDoc;
        studentIndex = idx;
        studentsArray = arr;
        break;
      }
    }

    if (!targetDoc) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    studentsArray[studentIndex].role = role;
    studentsArray[studentIndex].isApprovedOrganizer = Boolean(isApprovedOrganizer);
    studentsArray[studentIndex].updatedAt = new Date().toISOString();

    await updateDoc(targetDoc.ref, { students: studentsArray });
    invalidateCache();
    res.json({ success: true, message: 'Student role updated successfully', studentId: id, role });
  } catch (err) {
    console.error('Error updating student role:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/students/reset-od-usage — IQAC resets OD count for all students
router.post('/reset-od-usage', async (req, res) => {
  if (checkDb(res)) return;

  try {
    const resetTimestamp = new Date().toISOString();
    let totalReset = 0;
    let batch = writeBatch(db);
    let batchCount = 0;

    const sectionDocs = await getAllSectionDocs();
    
    for (const secDoc of sectionDocs) {
      const arr = secDoc.data.students || [];
      let changed = false;
      for (let i = 0; i < arr.length; i++) {
         arr[i].odUsed = 0;
         arr[i].odLimit = 7;
         arr[i].odResetTimestamp = resetTimestamp;
         arr[i].updatedAt = resetTimestamp;
         changed = true;
         totalReset++;
      }
      
      if (changed) {
        batch.update(secDoc.ref, { students: arr });
        batchCount++;
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

    const { logActivity } = require('../utils/logger');
    logActivity({
      category: 'OD_MANAGEMENT',
      action: 'Global OD Reset',
      status: 'SUCCESS',
      actor: { userId: req.user?.id, email: req.user?.email, role: req.user?.role },
      details: { studentsReset: totalReset }
    });

    invalidateCache();
    res.json({ success: true, message: `Successfully reset OD limit for ${totalReset} students.`, totalReset });
  } catch (error) {
    console.error('Error resetting OD limits:', error);
    res.status(500).json({ success: false, message: 'Failed to reset OD limits.' });
  }
});

module.exports = router;
