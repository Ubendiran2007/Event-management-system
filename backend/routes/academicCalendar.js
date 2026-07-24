const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { collection, getDocs, doc, getDoc, updateDoc, setDoc, query, where, db, writeBatch, deleteDoc } = require('../firebaseClientWrapper');
const { logActivity, logAudit } = require('../utils/logger');

// Enforce authentication for all routes in this router
router.use(requireAuth);

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

// Helper to log calendar activities
const logCalendarAction = (action, user, target, details, status = 'SUCCESS') => {
  const actor = {
    userId: user.id || user.email,
    name: user.name || user.email,
    role: user.role,
    department: user.department || 'IQAC'
  };

  const payload = {
    category: 'ACADEMIC_CALENDAR',
    action,
    status,
    actor,
    target,
    details
  };

  logActivity(payload);
  logAudit(payload); // Mirror to security logs
};

// ==========================================
// ACADEMIC YEARS (IQAC Only)
// ==========================================

router.post('/academic-years', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

router.put('/academic-years/:id', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

router.put('/academic-years/:id/activate', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

// Excel Import for Academic Years
router.post('/academic-years/import', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid records payload.' });

    let batch = writeBatch(db);
    let count = 0;
    const importedIds = [];
    let duplicates = 0;
    let invalid = 0;
    
    const existingSnap = await getDocs(collection(db, 'academicYears'));
    const existingIds = new Set();
    existingSnap.docs.forEach(doc => existingIds.add(doc.id));
    
    for (const record of records) {
      if (!record.name || !record.startDate || !record.endDate) {
        invalid++;
        continue;
      }
      
      const id = `ay_${record.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (existingIds.has(id)) {
        duplicates++;
        continue;
      }

      existingIds.add(id);

      const ayData = {
        name: record.name,
        startDate: record.startDate,
        endDate: record.endDate,
        status: record.status || 'ARCHIVED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const docRef = doc(db, 'academicYears', id);
      batch.set(docRef, ayData);
      importedIds.push(id);
      count++;
      
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    
    if (importedIds.length > 0) {
      logCalendarAction('IMPORT_ACADEMIC_YEARS', req.user, 'Bulk Import Academic Years', { importedCount: importedIds.length, duplicates, invalid });
    }

    res.json({ success: true, data: { imported: importedIds.length, duplicates, invalid } });
  } catch (error) {
    console.error('Error importing academic years:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// SEMESTERS (IQAC Only)
// ==========================================

router.post('/semesters', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

router.put('/semesters/:id', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

router.delete('/semesters/:id', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

// Excel Import for Semesters
router.post('/semesters/import', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid records payload.' });

    let batch = writeBatch(db);
    let count = 0;
    const importedIds = [];
    let duplicates = 0;
    let invalid = 0;
    
    // Simplistic duplicate check based on exact name and academic year
    const existingSnap = await getDocs(collection(db, 'semesters'));
    const existingKeys = new Set();
    existingSnap.docs.forEach(doc => existingKeys.add(`${doc.data().name}_${doc.data().academicYear}`));
    
    for (const record of records) {
      if (!record.name || !record.academicYear || !record.startDate || !record.endDate) {
        invalid++;
        continue;
      }
      
      const key = `${record.name}_${record.academicYear}`;
      if (existingKeys.has(key)) {
        duplicates++;
        continue;
      }

      existingKeys.add(key);

      const semData = {
        name: record.name,
        academicYear: record.academicYear,
        startDate: record.startDate,
        endDate: record.endDate,
        status: record.status || 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      
      const docRef = doc(collection(db, 'semesters'));
      batch.set(docRef, semData);
      importedIds.push(docRef.id);
      count++;
      
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    
    if (importedIds.length > 0) {
      logCalendarAction('IMPORT_SEMESTERS', req.user, 'Bulk Import Semesters', { importedCount: importedIds.length, duplicates, invalid });
    }

    res.json({ success: true, data: { imported: importedIds.length, duplicates, invalid } });
  } catch (error) {
    console.error('Error importing semesters:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// COLLEGE HOLIDAYS (IQAC Only)
// ==========================================

router.post('/holidays', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

// Excel Import for Holidays
router.post('/holidays/import', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid records payload.' });

    let batch = writeBatch(db);
    let count = 0;
    const importedIds = [];
    let duplicates = 0;
    let invalid = 0;
    
    // Optimized: Fetch all existing holidays once to build a duplicate checking set
    const existingHolidaysSnap = await getDocs(collection(db, 'holidays'));
    const existingDates = new Set();
    existingHolidaysSnap.docs.forEach(doc => {
      existingDates.add(doc.data().date);
    });
    
    for (const record of records) {
      if (!record.name || !record.date || !record.type) {
        invalid++;
        continue;
      }
      
      if (existingDates.has(record.date)) {
        duplicates++;
        continue;
      }

      existingDates.add(record.date); // Prevent duplicates within the import payload itself

      const holidayData = {
        name: record.name,
        type: record.type,
        date: record.date,
        createdAt: new Date().toISOString()
      };
      
      const docRef = doc(collection(db, 'holidays'));
      batch.set(docRef, holidayData);
      importedIds.push(docRef.id);
      count++;
      
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    
    if (importedIds.length > 0) {
      logCalendarAction('IMPORT_HOLIDAYS', req.user, 'Bulk Import Holidays', { importedCount: importedIds.length, duplicates, invalid });
    }

    res.json({ success: true, data: { imported: importedIds.length, duplicates, invalid } });
  } catch (error) {
    console.error('Error importing holidays:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/holidays/:id', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

router.delete('/holidays/:id', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

router.post('/exams', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

router.put('/exams/:id', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

router.delete('/exams/:id', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

// Excel Import for Exams
router.post('/exams/import', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid records payload.' });

    let batch = writeBatch(db);
    let count = 0;
    const importedIds = [];
    let duplicates = 0;
    let invalid = 0;
    
    const existingSnap = await getDocs(collection(db, 'exams'));
    const existingKeys = new Set();
    existingSnap.docs.forEach(doc => existingKeys.add(`${doc.data().name}_${doc.data().department}`));
    
    for (const record of records) {
      if (!record.name || !record.startDate || !record.endDate || !record.department) {
        invalid++;
        continue;
      }
      
      const key = `${record.name}_${record.department}`;
      if (existingKeys.has(key)) {
        duplicates++;
        continue;
      }

      existingKeys.add(key);

      const examData = {
        name: record.name,
        startDate: record.startDate,
        endDate: record.endDate,
        department: record.department,
        semester: record.semester || '',
        createdAt: new Date().toISOString()
      };
      
      const docRef = doc(collection(db, 'exams'));
      batch.set(docRef, examData);
      importedIds.push(docRef.id);
      count++;
      
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    
    if (importedIds.length > 0) {
      logCalendarAction('IMPORT_EXAMS', req.user, 'Bulk Import Exams', { importedCount: importedIds.length, duplicates, invalid });
    }

    res.json({ success: true, data: { imported: importedIds.length, duplicates, invalid } });
  } catch (error) {
    console.error('Error importing exams:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// WORKING DAYS (IQAC Only)
// ==========================================

router.post('/working-days', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
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

// Excel Import for Working Days
router.post('/working-days/import', requireRole(['IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid records payload.' });

    // Fetch existing working days config
    let workingDays = {};
    const snap = await getDoc(doc(db, 'settings', 'workingDays'));
    if (snap.exists()) {
      workingDays = snap.data();
    }
    
    let updated = 0;
    
    for (const record of records) {
      if (record.day && record.isWorking !== undefined) {
        // Standardize day name
        const dayMap = {
          'monday': 'Monday', 'tuesday': 'Tuesday', 'wednesday': 'Wednesday', 
          'thursday': 'Thursday', 'friday': 'Friday', 'saturday': 'Saturday', 'sunday': 'Sunday'
        };
        const dayKey = dayMap[String(record.day).toLowerCase()];
        
        if (dayKey) {
          workingDays[dayKey] = Boolean(record.isWorking === 'true' || record.isWorking === true || record.isWorking === 1 || record.isWorking === '1');
          updated++;
        }
      }
    }

    await setDoc(doc(db, 'settings', 'workingDays'), workingDays);
    logCalendarAction('UPDATE_WORKING_DAYS', req.user, 'Imported Config', workingDays);
    
    res.json({ success: true, data: { imported: updated, workingDays } });
  } catch (error) {
    console.error('Error importing working days:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==========================================
// DEPARTMENT CALENDAR (HOD Only)
// ==========================================

router.post('/department-events', requireRole(['HOD']), async (req, res) => {
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

router.put('/department-events/:id', requireRole(['HOD']), async (req, res) => {
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

router.delete('/department-events/:id', requireRole(['HOD']), async (req, res) => {
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
router.post('/department-events/import', requireRole(['HOD']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { records } = req.body; // Array of objects
    if (!records || !Array.isArray(records)) return res.status(400).json({ success: false, message: 'Invalid records payload.' });

    const department = req.user.department;
    if (!department) return res.status(403).json({ success: false, message: 'User has no department assigned.' });

    let batch = writeBatch(db);
    let count = 0;
    const importedIds = [];
    let duplicates = 0;
    let invalid = 0;
    
    // Optimized: Fetch all existing department events once to build a duplicate checking set
    const qEvents = query(collection(db, 'departmentCalendar'), where('department', '==', department));
    const existingEventsSnap = await getDocs(qEvents);
    const existingEventKeys = new Set();
    existingEventsSnap.docs.forEach(doc => {
      const data = doc.data();
      existingEventKeys.add(`${data.title}_${data.date}`);
    });
    
    for (const record of records) {
      if (!record.title || !record.date || !record.type) {
        invalid++;
        continue;
      }
      
      const eventKey = `${record.title}_${record.date}`;
      if (existingEventKeys.has(eventKey)) {
        duplicates++;
        continue;
      }
      
      existingEventKeys.add(eventKey); // Prevent duplicates within payload

      const eventData = {
        title: record.title,
        type: record.type,
        date: record.date,
        endDate: record.endDate || null,
        description: record.description || '',
        department,
        createdAt: new Date().toISOString()
      };
      
      const docRef = doc(collection(db, 'departmentCalendar'));
      batch.set(docRef, eventData);
      importedIds.push(docRef.id);
      count++;
      
      if (count === 500) {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    if (importedIds.length > 0) {
      logCalendarAction('IMPORT_DEPT_EVENTS', req.user, 'Bulk Import', { importedCount: importedIds.length, duplicates, invalid });
    }

    res.json({ success: true, data: { imported: importedIds.length, duplicates, invalid } });
  } catch (error) {
    console.error('Error importing department events:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add Single Department Event
router.post('/department-events', requireRole(['HOD']), async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { title, type, date, endDate, description } = req.body;
    
    if (!title || !date || !type) {
      return res.status(400).json({ success: false, message: 'Title, Date, and Type are required.' });
    }

    const department = req.user.department;
    if (!department) return res.status(403).json({ success: false, message: 'User has no department assigned.' });

    const eventData = {
      title,
      type,
      date,
      endDate: endDate || null,
      description: description || '',
      department,
      createdAt: new Date().toISOString()
    };
    
    const docRef = doc(collection(db, 'departmentCalendar'));
    await setDoc(docRef, eventData);
    
    logCalendarAction('ADD_DEPT_EVENT', req.user, 'Added Event', { title, date });
    
    res.json({ success: true, message: 'Event added successfully.', data: { id: docRef.id, ...eventData } });
  } catch (error) {
    console.error('Error adding department event:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
