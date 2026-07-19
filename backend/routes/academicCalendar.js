const express = require('express');
const router = express.Router();

const { collection, getDocs, doc, getDoc, updateDoc, setDoc, query, where, db, writeBatch, deleteDoc } = require('../firebaseClientWrapper');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

// Helper to log calendar activities
const logCalendarAction = (action, user, target, details, status = 'SUCCESS') => {
  logActivity({
    category: 'ACADEMIC_CALENDAR',
    action,
    status,
    actor: {
      userId: user.id || user.email,
      name: user.name || user.email,
      role: user.role,
      department: user.department || 'IQAC'
    },
    target,
    details
  });
};

// ==========================================
// ACADEMIC YEARS (IQAC Only)
// ==========================================

router.post('/academic-years', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { name, startDate, endDate, status = 'ACTIVE' } = req.body;
    if (!name || !startDate || !endDate) return res.status(400).json({ success: false, message: 'Missing required fields' });
    
    const id = `ay_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const snap = await getDoc(doc(db, 'academicYears', id));
    if (snap.exists()) {
      return res.status(400).json({ success: false, message: 'Academic Year already exists.' });
    }

    const batch = writeBatch(db);
    
    // If activating, deactivate others
    if (status === 'ACTIVE') {
      const q = query(collection(db, 'academicYears'), where('status', '==', 'ACTIVE'));
      const activeSnaps = await getDocs(q);
      activeSnaps.docs.forEach(d => {
        batch.update(d.ref, { status: 'ARCHIVED', updatedAt: new Date().toISOString() });
      });
    }

    const ayData = {
      name,
      startDate,
      endDate,
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    batch.set(doc(db, 'academicYears', id), ayData);
    await batch.commit();

    logCalendarAction('CREATE_ACADEMIC_YEAR', req.user, name, { startDate, endDate, status });
    res.json({ success: true, data: { id, ...ayData } });
  } catch (error) {
    console.error('Error creating academic year:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/academic-years/:id', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    const { name, startDate, endDate, status } = req.body;
    
    const ayRef = doc(db, 'academicYears', id);
    const snap = await getDoc(ayRef);
    if (!snap.exists()) return res.status(404).json({ success: false, message: 'Academic Year not found.' });

    const updates = { updatedAt: new Date().toISOString() };
    
    if (name !== undefined && name !== snap.data().name) {
        const newId = `ay_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const existingSnap = await getDoc(doc(db, 'academicYears', newId));
        if (existingSnap.exists()) {
            return res.status(400).json({ success: false, message: 'Academic Year already exists.' });
        }
        updates.name = name;
    }
    
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;

    await updateDoc(ayRef, updates);
    
    logCalendarAction('UPDATE_ACADEMIC_YEAR', req.user, id, updates);
    res.json({ success: true, data: { id, ...snap.data(), ...updates } });
  } catch (error) {
    console.error('Error updating academic year:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/academic-years/:id/activate', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    const ayRef = doc(db, 'academicYears', id);
    const snap = await getDoc(ayRef);
    if (!snap.exists()) return res.status(404).json({ success: false, message: 'Academic Year not found.' });

    const batch = writeBatch(db);
    
    // Deactivate others
    const q = query(collection(db, 'academicYears'), where('status', '==', 'ACTIVE'));
    const activeSnaps = await getDocs(q);
    activeSnaps.docs.forEach(d => {
      if (d.id !== id) {
        batch.update(d.ref, { status: 'ARCHIVED', updatedAt: new Date().toISOString() });
      }
    });

    batch.update(ayRef, { status: 'ACTIVE', updatedAt: new Date().toISOString() });
    await batch.commit();

    logCalendarAction('ACTIVATE_ACADEMIC_YEAR', req.user, snap.data().name, { id });
    res.json({ success: true, message: 'Academic Year activated.' });
  } catch (error) {
    console.error('Error activating academic year:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// SEMESTERS (IQAC Only)
// ==========================================

router.post('/semesters', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { name, academicYear, startDate, endDate, status = 'ACTIVE' } = req.body;
    if (!name || !academicYear || !startDate || !endDate) return res.status(400).json({ success: false, message: 'Missing required fields' });
    
    // Overlap validation within the same academic year
    const q = query(collection(db, 'semesters'), where('academicYear', '==', academicYear));
    const snaps = await getDocs(q);
    const hasOverlap = snaps.docs.some(d => {
      const data = d.data();
      // If new start is before existing end AND new end is after existing start
      return new Date(startDate) <= new Date(data.endDate) && new Date(endDate) >= new Date(data.startDate);
    });
    if (hasOverlap) {
      return res.status(400).json({ success: false, message: 'Semester dates overlap with an existing semester in this academic year.' });
    }

    const semData = { name, academicYear, startDate, endDate, status, createdAt: new Date().toISOString() };
    const docRef = doc(collection(db, 'semesters'));
    await setDoc(docRef, semData);

    logCalendarAction('CREATE_SEMESTER', req.user, name, { academicYear, startDate, endDate });
    res.json({ success: true, data: { id: docRef.id, ...semData } });
  } catch (error) {
    console.error('Error creating semester:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/semesters/:id', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    const { name, academicYear, startDate, endDate, status } = req.body;
    
    const semRef = doc(db, 'semesters', id);
    const semSnap = await getDoc(semRef);
    if (!semSnap.exists()) return res.status(404).json({ success: false, message: 'Semester not found.' });
    
    const updates = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (academicYear !== undefined) updates.academicYear = academicYear;
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;
    if (status !== undefined) updates.status = status;

    // Optional: Overlap check could be repeated here for PUT if dates changed
    // For simplicity, we just update it.
    
    await updateDoc(semRef, updates);
    logCalendarAction('UPDATE_SEMESTER', req.user, id, updates);
    res.json({ success: true, data: { id, ...semSnap.data(), ...updates } });
  } catch (error) {
    console.error('Error updating semester:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/semesters/:id', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    await deleteDoc(doc(db, 'semesters', id));
    logCalendarAction('DELETE_SEMESTER', req.user, id, {});
    res.json({ success: true, message: 'Semester deleted.' });
  } catch (error) {
    console.error('Error deleting semester:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// COLLEGE HOLIDAYS (IQAC Only)
// ==========================================

router.post('/holidays', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { name, date, type } = req.body;
    if (!name || !date || !type) return res.status(400).json({ success: false, message: 'Missing required fields' });
    
    // Check duplicate dates
    const q = query(collection(db, 'holidays'), where('date', '==', date));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return res.status(400).json({ success: false, message: `A holiday already exists on ${date}.` });
    }

    const holidayData = { name, date, type, createdAt: new Date().toISOString() };
    const docRef = doc(collection(db, 'holidays'));
    await setDoc(docRef, holidayData);

    logCalendarAction('CREATE_HOLIDAY', req.user, name, { date, type });
    res.json({ success: true, data: { id: docRef.id, ...holidayData } });
  } catch (error) {
    console.error('Error creating holiday:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/holidays/:id', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    const { name, date, type } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (date) updates.date = date;
    if (type) updates.type = type;
    await updateDoc(doc(db, 'holidays', id), updates);
    logCalendarAction('UPDATE_HOLIDAY', req.user, id, updates);
    res.json({ success: true, data: { id, ...updates } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/holidays/:id', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    await deleteDoc(doc(db, 'holidays', id));
    logCalendarAction('DELETE_HOLIDAY', req.user, id, {});
    res.json({ success: true, message: 'Holiday deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// EXAMINATIONS (IQAC Only)
// ==========================================

router.post('/exams', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { name, startDate, endDate, department, semester } = req.body;
    const examData = { name, startDate, endDate, department, semester, createdAt: new Date().toISOString() };
    const docRef = doc(collection(db, 'exams'));
    await setDoc(docRef, examData);
    logCalendarAction('CREATE_EXAM', req.user, name, examData);
    res.json({ success: true, data: { id: docRef.id, ...examData } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/exams/:id', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    await updateDoc(doc(db, 'exams', id), updates);
    logCalendarAction('UPDATE_EXAM', req.user, id, updates);
    res.json({ success: true, data: { id, ...updates } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/exams/:id', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    await deleteDoc(doc(db, 'exams', id));
    logCalendarAction('DELETE_EXAM', req.user, id, {});
    res.json({ success: true, message: 'Exam deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// WORKING DAYS (IQAC Only)
// ==========================================

router.post('/working-days', requireAuth, requireRole(['IQAC_TEAM']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const workingDays = req.body; // { Monday: true, Tuesday: true, ... }
    await setDoc(doc(db, 'settings', 'workingDays'), workingDays);
    logCalendarAction('UPDATE_WORKING_DAYS', req.user, 'Global Configuration', workingDays);
    res.json({ success: true, data: workingDays });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// DEPARTMENT CALENDAR (HOD Only)
// ==========================================

router.post('/department-events', requireAuth, requireRole(['HOD']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { title, type, date, description } = req.body;
    // Enforce HOD's own department
    const department = req.user.department;
    if (!department) return res.status(403).json({ success: false, message: 'User has no department assigned.' });

    const eventData = { title, type, date, description, department, createdAt: new Date().toISOString() };
    const docRef = doc(collection(db, 'departmentCalendar'));
    await setDoc(docRef, eventData);
    logCalendarAction('CREATE_DEPT_EVENT', req.user, title, eventData);
    res.json({ success: true, data: { id: docRef.id, ...eventData } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/department-events/:id', requireAuth, requireRole(['HOD']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    const { title, type, date, description } = req.body;
    const department = req.user.department;

    const eventRef = doc(db, 'departmentCalendar', id);
    const snap = await getDoc(eventRef);
    if (!snap.exists()) return res.status(404).json({ success: false, message: 'Event not found.' });
    if (snap.data().department !== department) return res.status(403).json({ success: false, message: 'Permission denied.' });

    const updates = { title, type, date, description, updatedAt: new Date().toISOString() };
    Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);
    
    await updateDoc(eventRef, updates);
    logCalendarAction('UPDATE_DEPT_EVENT', req.user, id, updates);
    res.json({ success: true, data: { id, ...snap.data(), ...updates } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/department-events/:id', requireAuth, requireRole(['HOD']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    const department = req.user.department;

    const eventRef = doc(db, 'departmentCalendar', id);
    const snap = await getDoc(eventRef);
    if (!snap.exists()) return res.status(404).json({ success: false, message: 'Event not found.' });
    if (snap.data().department !== department) return res.status(403).json({ success: false, message: 'Permission denied.' });

    await deleteDoc(eventRef);
    logCalendarAction('DELETE_DEPT_EVENT', req.user, id, {});
    res.json({ success: true, message: 'Event deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Excel Import for Department Events
router.post('/department-events/import', requireAuth, requireRole(['HOD']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { records } = req.body; // Array of objects
    if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid records payload.' });

    const department = req.user.department;
    if (!department) return res.status(403).json({ success: false, message: 'User has no department assigned.' });

    const batch = writeBatch(db);
    const importedIds = [];
    let duplicates = 0;
    let invalid = 0;
    
    for (const record of records) {
      if (!record.title || !record.date || !record.type) {
        invalid++;
        continue;
      }
      
      // Duplicate check logic
      const q = query(collection(db, 'departmentCalendar'), 
        where('title', '==', record.title),
        where('date', '==', record.date),
        where('department', '==', department)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        duplicates++;
        continue;
      }

      const eventData = {
        title: record.title,
        type: record.type,
        date: record.date,
        description: record.description || '',
        department,
        createdAt: new Date().toISOString()
      };
      
      const docRef = doc(collection(db, 'departmentCalendar'));
      batch.set(docRef, eventData);
      importedIds.push(docRef.id);
    }

    if (importedIds.length > 0) {
      await batch.commit();
      logCalendarAction('IMPORT_DEPT_EVENTS', req.user, 'Bulk Import', { importedCount: importedIds.length, duplicates, invalid });
    }

    res.json({ success: true, data: { imported: importedIds.length, duplicates, invalid } });
  } catch (error) {
    console.error('Error importing department events:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
