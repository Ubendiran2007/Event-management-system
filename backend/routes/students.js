const express = require('express');
const router = express.Router();

const { collection, collectionGroup, getDocs, doc, getDoc, updateDoc, writeBatch, setDoc, deleteDoc, query, where, limit, db } = require('../firebaseClientWrapper');
const { requireAuth, requireRole } = require('../middleware/auth');
const { buildStudentData } = require('../services/userService');
const { parsePaginationParams } = require('../utils/paginationHelper');

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
const { getAllSectionDocs, clearSectionDocsCache, syncStructureMetadata, findStudentInFirestore } = require('../utils/studentHelper');

// --- CACHE IMPLEMENTATION ---
let cachedStudents = null;

// College-wide index cache (2-minute TTL) — busted on any write
let _collegeIndexCache = null;
let _collegeIndexExpiry = 0;
const COLLEGE_INDEX_TTL = 2 * 60 * 1000;

const invalidateCache = () => {
  cachedStudents = null;
  _collegeIndexCache = null;
  _collegeIndexExpiry = 0;
  clearSectionDocsCache();
};
// ----------------------------

/**
 * Build a college-wide index of rollNo → location and email → location
 * by scanning BOTH storage paths:
 *   1. students/{batch}/{dept}/{section}  (backend-created, students[] array)
 *   2. students/{CLASS}/members/{id}      (frontend-seeded, individual docs)
 * Returns:
 *   rollNoMap  : Map<upperRollNo, { rollNo, name, email, class, department, section }>
 *   emailMap   : Map<lowerEmail,  { rollNo, name, email, class, department, section }>
 */
async function buildCollegeWideStudentIndex() {
  // Return cached result if still fresh
  if (_collegeIndexCache && Date.now() < _collegeIndexExpiry) {
    return _collegeIndexCache;
  }

  const rollNoMap = new Map();
  const emailMap  = new Map();

  // Path 1 — array-based section docs (via metadata-driven scan)
  const sectionDocs = await getAllSectionDocs();
  for (const secDoc of sectionDocs) {
    for (const s of (secDoc.data.students || [])) {
      const entry = {
        rollNo: s.rollNo, name: s.name, email: s.email,
        class: s.class || `${secDoc.dept}-${secDoc.sec}`,
        department: secDoc.dept, section: secDoc.sec,
        existsIn: 'array-doc',
      };
      if (s.rollNo) rollNoMap.set(s.rollNo.toUpperCase(), entry);
      if (s.email)  emailMap.set(s.email.toLowerCase(), entry);
    }
  }

  // Path 2 — legacy members subcollection (frontend seed)
  try {
    const classesSnap = await getDocs(collection(db, 'students'));
    // Fire all member-subcollection reads in parallel
    await Promise.all(classesSnap.docs.map(async (classDoc) => {
      const membersSnap = await getDocs(collection(db, 'students', classDoc.id, 'members'));
      for (const memberDoc of membersSnap.docs) {
        const s = memberDoc.data();
        if (!s.rollNo && !s.email) continue;
        const entry = {
          rollNo: s.rollNo, name: s.name, email: s.email,
          class: classDoc.id,
          department: s.department || classDoc.id.split(/[\s\-]+/)[0].toUpperCase(),
          section: classDoc.id,
          existsIn: 'members-subcollection',
        };
        if (s.rollNo && !rollNoMap.has(s.rollNo.toUpperCase()))
          rollNoMap.set(s.rollNo.toUpperCase(), entry);
        if (s.email && !emailMap.has(s.email.toLowerCase()))
          emailMap.set(s.email.toLowerCase(), entry);
      }
    }));
  } catch (err) {
    console.warn('[students] Legacy members scan warning:', err.message);
  }

  const result = { rollNoMap, emailMap };
  _collegeIndexCache  = result;
  _collegeIndexExpiry = Date.now() + COLLEGE_INDEX_TTL;
  return result;
}

// GET /api/students — fetch students with in-memory pagination
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { batch, department, section, class: classFilter, search } = req.query;
    const { limit: limitCount, cursor } = parsePaginationParams(req.query, 50, 200);

    let allStudents = [];
    
    if (cachedStudents) {
      allStudents = cachedStudents;
    } else {
      const sectionDocs = await getAllSectionDocs();
      
      sectionDocs.forEach(secDoc => {
        const studentsArray = secDoc.data.students || [];
        studentsArray.forEach(data => {
          const { password, ...safeData } = data;
          // Infer department from class if missing (e.g. "CSE D" → "CSE")
          if (!safeData.department && safeData.class) {
            safeData.department = safeData.class.replace(/-/g, ' ').trim().split(' ')[0].toUpperCase();
          }
          allStudents.push(safeData);
        });
      });
      cachedStudents = allStudents;
    }

    // Apply filters
    let filtered = allStudents;
    if (batch) filtered = filtered.filter(s => s.academicBatch === batch);
    if (department) filtered = filtered.filter(s => s.department === department);
    if (section) filtered = filtered.filter(s => s.section === section);
    if (classFilter) {
      const normalizeClass = (value) => String(value || '').trim().replace(/\s+/g, '-').toUpperCase();
      const requestedClass = normalizeClass(classFilter);
      filtered = filtered.filter(s => normalizeClass(s.class || `${s.department || ''}-${s.section || ''}`) === requestedClass);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.rollNo || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q)
      );
    }

    // In-memory offset pagination
    let offset = 0;
    if (cursor) {
      try { offset = parseInt(Buffer.from(cursor, 'base64').toString('utf8'), 10) || 0; } catch(_) {}
    }

    const pageItems = filtered.slice(offset, offset + limitCount + 1);
    const hasMore = pageItems.length > limitCount;
    const dataItems = hasMore ? pageItems.slice(0, limitCount) : pageItems;
    const nextOffset = offset + dataItems.length;
    const nextCursor = hasMore ? Buffer.from(String(nextOffset)).toString('base64') : null;

    res.json({
      success: true,
      data: dataItems,
      pagination: { limit: limitCount, hasMore, nextCursor, count: dataItems.length }
    });
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
    // ── College-wide duplicate check (rollNo + email) ──────────────────────
    const { rollNoMap, emailMap } = await buildCollegeWideStudentIndex();

    const conflicts = [];
    const rollNoUpper = rollNo.toUpperCase();
    const emailLower  = email.toLowerCase();

    if (rollNoMap.has(rollNoUpper)) {
      const existing = rollNoMap.get(rollNoUpper);
      conflicts.push({
        field: 'rollNo',
        value: rollNo,
        message: `Roll No "${rollNo}" already belongs to ${existing.name || 'another student'} in class ${existing.class} (${existing.department})`,
        existingStudent: existing,
      });
    }
    if (emailMap.has(emailLower)) {
      const existing = emailMap.get(emailLower);
      conflicts.push({
        field: 'email',
        value: email,
        message: `Email "${email}" is already registered to ${existing.name || 'another student'} (Roll No: ${existing.rollNo || 'N/A'}) in class ${existing.class}`,
        existingStudent: existing,
      });
    }

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Duplicate detected — student not added. ${conflicts.map(c => c.message).join(' | ')}`,
        conflicts,
      });
    }

    // ── Safe to insert ─────────────────────────────────────────────────────
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
    
    const indexRef = doc(db, 'student_index', studentId);
    await setDoc(indexRef, {
      studentId, uid: null, batch: academicBatch,
      department: actualDept, section: actualSection.toUpperCase(),
      status: 'ACTIVE', updatedAt: new Date().toISOString()
    });
    await syncStructureMetadata(academicBatch, actualDept);
    
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

    // ── College-wide duplicate index (both storage paths) ──────────────────
    const { rollNoMap, emailMap } = await buildCollegeWideStudentIndex();

    const validToImport   = [];
    const dbDuplicates    = []; // { student, conflicts: [{field, value, message, existingStudent}] }
    const fileRollNos     = new Map(); // track within-file duplicates
    const fileEmails      = new Map();

    for (const student of students) {
      const { rollNo, email, academicBatch, department } = student;
      const actualSection = student.section || student.className;
      if (!academicBatch || !department || !actualSection) continue;

      const rollUpper  = rollNo  ? rollNo.toUpperCase()  : null;
      const emailLower = email   ? email.toLowerCase()   : null;

      const conflicts = [];

      // DB duplicates
      if (rollUpper && rollNoMap.has(rollUpper)) {
        const ex = rollNoMap.get(rollUpper);
        conflicts.push({
          field: 'rollNo', value: rollNo,
          message: `Roll No "${rollNo}" already exists — ${ex.name || ''} in ${ex.class} (${ex.department})`,
          existingStudent: ex,
        });
      }
      if (emailLower && emailMap.has(emailLower)) {
        const ex = emailMap.get(emailLower);
        conflicts.push({
          field: 'email', value: email,
          message: `Email "${email}" already exists — ${ex.name || ''} (${ex.rollNo || 'N/A'}) in ${ex.class}`,
          existingStudent: ex,
        });
      }

      // Within-file duplicates
      if (rollUpper && fileRollNos.has(rollUpper)) {
        conflicts.push({ field: 'rollNo', value: rollNo, message: `Roll No "${rollNo}" appears more than once in the uploaded file` });
      }
      if (emailLower && fileEmails.has(emailLower)) {
        conflicts.push({ field: 'email', value: email, message: `Email "${email}" appears more than once in the uploaded file` });
      }

      if (conflicts.length > 0) {
        dbDuplicates.push({ student, conflicts });
      } else {
        validToImport.push(student);
        if (rollUpper)  fileRollNos.set(rollUpper, true);
        if (emailLower) fileEmails.set(emailLower, true);
      }
    }

    if (validToImport.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No new students to import — all records are duplicates', 
        importedCount: 0, 
        dbDuplicatesCount: dbDuplicates.length,
        duplicateDetails: dbDuplicates,
      });
    }

    // ── Group valid imports by section doc path ────────────────────────────
    const importsByPath = {};
    const addedStudents = [];

    for (const student of validToImport) {
      const { studentId, studentData } = await buildStudentData(student);
      studentData.id = studentId;
      const actualSection = student.section || student.className;
      const actualDept    = student.department.toUpperCase();
      const path = `students/${student.academicBatch}/${actualDept}/${actualSection.toUpperCase()}`;
      if (!importsByPath[path]) importsByPath[path] = { batch: student.academicBatch, dept: actualDept, sec: actualSection.toUpperCase(), students: [] };
      importsByPath[path].students.push(studentData);
      addedStudents.push(studentData);
    }

    let batchWrite = writeBatch(db);
    for (const path of Object.keys(importsByPath)) {
      const group = importsByPath[path];
      const parts = path.split('/');
      const ref = doc(db, parts[0], parts[1], parts[2], parts[3]);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const existing = snap.data().students || [];
        batchWrite.update(ref, { students: [...existing, ...group.students] });
      } else {
        batchWrite.set(ref, { batch: group.batch, department: group.dept, section: group.sec, students: group.students });
      }
    }
    await batchWrite.commit();

    // ── Index + metadata ───────────────────────────────────────────────────
    const indexBatch  = writeBatch(db);
    const uniqueMeta  = new Set();
    for (const path of Object.keys(importsByPath)) {
      const group = importsByPath[path];
      uniqueMeta.add(`${group.batch}|${group.dept}`);
      for (const st of group.students) {
        indexBatch.set(doc(db, 'student_index', st.id), {
          studentId: st.id, uid: null,
          batch: group.batch, department: group.dept, section: group.sec,
          status: 'ACTIVE', updatedAt: new Date().toISOString()
        });
      }
    }
    await indexBatch.commit();
    for (const meta of uniqueMeta) {
      const [b, d] = meta.split('|');
      await syncStructureMetadata(b, d);
    }

    const { logActivity } = require('../utils/logger');
    logActivity({
      category: 'USER_MANAGEMENT', action: 'Bulk Import Students', status: 'SUCCESS',
      actor: { userId: actorEmail, email: actorEmail, name: req.user?.name || 'System', role: req.user?.role || 'SYSTEM' },
      details: { imported: addedStudents.length, dbDuplicates: dbDuplicates.length }
    });

    invalidateCache();

    res.json({ 
      success: true, 
      message: `Successfully added ${addedStudents.length} students`, 
      importedCount: addedStudents.length, 
      dbDuplicatesCount: dbDuplicates.length,
      duplicateDetails: dbDuplicates,
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
    const student = await findStudentInFirestore(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in any class' });
    }

    const targetDoc = { ref: student.ref };
    const studentIndex = student.studentIndex;
    const studentsArray = student.allStudents;

    // Check for email/rollNo uniqueness against ALL students except this one
    if (updateData.email || updateData.rollNo) {
      let conflict = false;
      const sectionDocs = await getAllSectionDocs();
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
    
    // Sync status or uid changes to index
    if (updateData.status || updateData.uid) {
      const idxSnap = await getDoc(doc(db, 'student_index', id));
      if (idxSnap.exists()) {
         const idxData = idxSnap.data();
         if (updateData.status) idxData.status = updateData.status;
         if (updateData.uid) idxData.uid = updateData.uid;
         idxData.updatedAt = new Date().toISOString();
         await updateDoc(doc(db, 'student_index', id), idxData);
      }
    }
    
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
    const student = await findStudentInFirestore(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in any class' });
    }

    const studentsArray = student.allStudents;
    studentsArray.splice(student.studentIndex, 1);

    await updateDoc(student.ref, { students: studentsArray });
    
    // Phase 3B: Delete from index
    await deleteDoc(doc(db, 'student_index', id));

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
    // O(1) lookup via student_index instead of full section scan
    const student = await findStudentInFirestore(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const studentsArray = student.allStudents;
    studentsArray[student.studentIndex].role = role;
    studentsArray[student.studentIndex].isApprovedOrganizer = Boolean(isApprovedOrganizer);
    studentsArray[student.studentIndex].updatedAt = new Date().toISOString();

    await updateDoc(student.ref, { students: studentsArray });
    invalidateCache();
    res.json({ success: true, message: 'Student role updated successfully', studentId: id, role });
  } catch (err) {
    console.error('Error updating student role:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/students/:id/od-stats — update a student's OD stats
router.patch('/:id/od-stats', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { odUsed, odLimit } = req.body;

  try {
    // O(1) lookup via student_index
    const student = await findStudentInFirestore(id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const studentsArray = student.allStudents;
    if (odUsed !== undefined) studentsArray[student.studentIndex].odUsed = Number(odUsed);
    if (odLimit !== undefined) studentsArray[student.studentIndex].odLimit = Number(odLimit);
    studentsArray[student.studentIndex].updatedAt = new Date().toISOString();

    await updateDoc(student.ref, { students: studentsArray });
    invalidateCache();
    res.json({ success: true, message: 'Student OD stats updated successfully', studentId: id });
  } catch (err) {
    console.error('Error updating student OD stats:', err);
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
