const express = require('express');
const router = express.Router();
const { db, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, getDoc, limit } = require('../firebaseClientWrapper');
const { requireAuth, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { parsePaginationParams } = require('../utils/paginationHelper');

const { buildStaffData } = require('../services/userService');
const { getAllStaffDocs, clearStaffDocsCache } = require('../utils/staffHelper');

// Protect all Manage Users APIs
router.use(requireAuth);
// Protect manage routes later

const INCHARGE_ROLES = [
  'HR', 'TRANSPORT_MANAGER', 'WARDEN', 'IQAC_TEAM',
  'ICTS', 'AUDIO_VISUAL', 'MEDIA_MANAGER', 'PRINCIPAL'
];

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

// --- CACHE IMPLEMENTATION ---
let cachedUsers = null;

const invalidateCache = () => {
  cachedUsers = null;
  clearStaffDocsCache(); // also bust the underlying staffs cache
};
// ----------------------------

// GET /api/users — fetch all staff members with in-memory pagination
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { role, department, search, category } = req.query;
    const { limit: limitCount, cursor } = parsePaginationParams(req.query, 50, 200);

    let allUsers = [];
    if (cachedUsers) {
      allUsers = cachedUsers;
    } else {
      const allStaffDocs = await getAllStaffDocs();
      allStaffDocs.forEach(staffDoc => {
        const arr = staffDoc.data.staffs || [];
        arr.forEach(staff => {
          const { password, ...safeData } = staff;
          allUsers.push({ id: staff.id, ...safeData });
        });
      });
      cachedUsers = allUsers;
    }

    // Server-side filtering
    let filtered = allUsers;
    if (role) filtered = filtered.filter(u => u.role === role);
    if (department) filtered = filtered.filter(u => u.department === department);
    if (category === 'FACULTY') filtered = filtered.filter(u => ['FACULTY', 'HOD'].includes(u.role));
    if (category === 'INCHARGE') filtered = filtered.filter(u => !['FACULTY', 'HOD'].includes(u.role));
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    }

    // In-memory cursor (offset-based, encoded as base64 integer for simplicity)
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
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Protect mutation routes
router.use(requireRole(['IQAC_TEAM', 'HOD'])); // IQAC and HOD can manage staff

// POST /api/users — add a new staff member
router.post('/', async (req, res) => {
  if (checkDb(res)) return;
  const { name, email, role, department, password, assignedClasses, staffId } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({ success: false, message: 'Name, email, and role are required' });
  }

  try {
    const allStaffDocs = await getAllStaffDocs();

    // ── Derive stable staffId (same logic as buildStaffData) ──────────────
    const derivedStaffId = staffId ? String(staffId).toLowerCase().replace(/[^a-z0-9]/g, '_') : email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const candidateId = `staff_${derivedStaffId}`;

    // ── College-wide duplicate check (staffId + email) ─────────────────────
    const conflicts = [];
    for (const sDoc of allStaffDocs) {
      for (const s of (sDoc.data.staffs || [])) {
        if (s.email && s.email.toLowerCase() === email.toLowerCase()) {
          conflicts.push({
            field: 'email', value: email,
            message: `Email "${email}" is already registered to ${s.name || 'another staff'} (${s.role || ''}) in category "${sDoc.category}"`,
            existing: { id: s.id, name: s.name, role: s.role, department: s.department, category: sDoc.category },
          });
        }
        if (s.id && s.id === candidateId) {
          conflicts.push({
            field: 'staffId', value: candidateId,
            message: `A staff with this email-derived ID ("${candidateId}") already exists as ${s.name || 'another staff'} in category "${sDoc.category}"`,
            existing: { id: s.id, name: s.name, role: s.role, department: s.department, category: sDoc.category },
          });
        }
      }
    }

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Duplicate detected — staff not added. ${conflicts.map(c => c.message).join(' | ')}`,
        conflicts,
      });
    }

    const { userId, userData } = await buildStaffData({ name, email, role, department, password, assignedClasses, staffId: staffId || derivedStaffId });

    const category = INCHARGE_ROLES.includes(role.toUpperCase()) ? 'Incharges' : (department || 'Unknown').toUpperCase();
    
    const categoryDoc = allStaffDocs.find(d => d.category === category);
    
    if (categoryDoc) {
      const arr = categoryDoc.data.staffs || [];
      arr.push(userData);
      await updateDoc(categoryDoc.ref, { staffs: arr });
    } else {
      const newRef = doc(db, 'staffs', category);
      await setDoc(newRef, { category, staffs: [userData] });
    }
    
    try {
      await setDoc(doc(db, 'users', userId), userData, { merge: true });
    } catch (syncErr) {
      console.error('Error syncing to users collection:', syncErr);
    }
    
    const responseData = { ...userData };
    delete responseData.password;
    
    invalidateCache();
    res.json({ success: true, message: 'Staff member added successfully', user: { id: userId, ...responseData } });
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id — update a staff member
router.put('/:id', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;
  const { name, email, role, department, password, assignedClasses } = req.body;

  try {
    const allStaffDocs = await getAllStaffDocs();
    
    let targetDoc = null;
    let targetArr = null;
    let staffIdx = -1;
    
    for (const sDoc of allStaffDocs) {
      const arr = sDoc.data.staffs || [];
      const idx = arr.findIndex(s => s.id === id);
      if (idx !== -1) {
        targetDoc = sDoc;
        targetArr = arr;
        staffIdx = idx;
        break;
      }
    }
    
    if (!targetDoc) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentStaff = targetArr[staffIdx];
    
    const updates = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (role !== undefined) updates.role = role.toUpperCase();
    if (department !== undefined) updates.department = department || null;
    if (assignedClasses !== undefined) updates.assignedClasses = assignedClasses;
    
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    }
    
    const updatedStaff = { ...currentStaff, ...updates };
    
    const oldCategory = targetDoc.category;
    const newCategory = INCHARGE_ROLES.includes(updatedStaff.role) ? 'Incharges' : (updatedStaff.department || 'Unknown').toUpperCase();
    
    if (oldCategory === newCategory) {
      targetArr[staffIdx] = updatedStaff;
      await updateDoc(targetDoc.ref, { staffs: targetArr });
    } else {
      // Remove from old category
      targetArr.splice(staffIdx, 1);
      await updateDoc(targetDoc.ref, { staffs: targetArr });
      
      // Add to new category
      const newCategoryDoc = allStaffDocs.find(d => d.category === newCategory);
      if (newCategoryDoc) {
        const newArr = newCategoryDoc.data.staffs || [];
        newArr.push(updatedStaff);
        await updateDoc(newCategoryDoc.ref, { staffs: newArr });
      } else {
        const newRef = doc(db, 'staffs', newCategory);
        await setDoc(newRef, { category: newCategory, staffs: [updatedStaff] });
      }
    }

    try {
      await setDoc(doc(db, 'users', id), updatedStaff, { merge: true });
    } catch (syncErr) {
      console.error('Error syncing to users collection:', syncErr);
    }

    invalidateCache();
    res.json({ success: true, message: 'Staff member updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:id — delete a staff member
router.delete('/:id', async (req, res) => {
  if (checkDb(res)) return;
  const { id } = req.params;

  try {
    const allStaffDocs = await getAllStaffDocs();
    
    let targetDoc = null;
    let targetArr = null;
    let staffIdx = -1;
    
    for (const sDoc of allStaffDocs) {
      const arr = sDoc.data.staffs || [];
      const idx = arr.findIndex(s => s.id === id);
      if (idx !== -1) {
        targetDoc = sDoc;
        targetArr = arr;
        staffIdx = idx;
        break;
      }
    }
    
    if (!targetDoc) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    targetArr.splice(staffIdx, 1);
    await updateDoc(targetDoc.ref, { staffs: targetArr });
    
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (syncErr) {
      console.error('Error deleting from users collection:', syncErr);
    }
    
    invalidateCache();
    res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users/bulk - add multiple staff members
router.post('/bulk', async (req, res) => {
  if (checkDb(res)) return;
  const { users: newUsers } = req.body;

  if (!Array.isArray(newUsers) || newUsers.length === 0) {
    return res.status(400).json({ success: false, message: 'An array of users is required' });
  }

  try {
    const actorEmail = req.user?.email || 'SYSTEM';

    // ── Build college-wide staff index ─────────────────────────────────────
    const allStaffDocs = await getAllStaffDocs();
    const existingEmails = new Map(); // lowerEmail → { name, role, department, category }
    const existingIds    = new Map(); // id         → { name, role, department, category }

    allStaffDocs.forEach(sDoc => {
      (sDoc.data.staffs || []).forEach(s => {
        if (s.email) existingEmails.set(s.email.toLowerCase(), { name: s.name, role: s.role, department: s.department, category: sDoc.category });
        if (s.id)    existingIds.set(s.id, { name: s.name, role: s.role, department: s.department, category: sDoc.category });
      });
    });

    const validToImport  = [];
    const dbDuplicates   = []; // { user, conflicts[] }
    const fileEmails     = new Map();
    const fileIds        = new Map();

    for (const user of newUsers) {
      const { staffId, email } = user;
      const docId      = staffId ? `staff_${staffId}` : null;
      const emailLower = email   ? email.toLowerCase() : null;
      const conflicts  = [];

      // DB duplicates
      if (emailLower && existingEmails.has(emailLower)) {
        const ex = existingEmails.get(emailLower);
        conflicts.push({
          field: 'email', value: email,
          message: `Email "${email}" already belongs to ${ex.name || 'another staff'} (${ex.role || ''}) in category "${ex.category}"`,
          existing: ex,
        });
      }
      if (docId && existingIds.has(docId)) {
        const ex = existingIds.get(docId);
        conflicts.push({
          field: 'staffId', value: staffId,
          message: `Staff ID "${staffId}" already exists as ${ex.name || 'another staff'} (${ex.role || ''}) in category "${ex.category}"`,
          existing: ex,
        });
      }

      // Within-file duplicates
      if (emailLower && fileEmails.has(emailLower)) {
        conflicts.push({ field: 'email', value: email, message: `Email "${email}" appears more than once in the uploaded file` });
      }
      if (docId && fileIds.has(docId)) {
        conflicts.push({ field: 'staffId', value: staffId, message: `Staff ID "${staffId}" appears more than once in the uploaded file` });
      }

      if (conflicts.length > 0) {
        dbDuplicates.push({ user, conflicts });
      } else {
        validToImport.push(user);
        if (emailLower) fileEmails.set(emailLower, true);
        if (docId)      fileIds.set(docId, true);
      }
    }

    if (validToImport.length === 0) {
      return res.json({
        success: true,
        message: 'No new staff to import — all records are duplicates',
        importedCount: 0,
        dbDuplicatesCount: dbDuplicates.length,
        duplicateDetails: dbDuplicates,
      });
    }

    let totalImported = 0;
    const addedUsers  = [];
    const categoryMap = {};

    for (const user of validToImport) {
      const { userId, userData } = await buildStaffData(user);
      const category = INCHARGE_ROLES.includes(userData.role.toUpperCase()) ? 'Incharges' : (userData.department || 'Unknown').toUpperCase();
      if (!categoryMap[category]) categoryMap[category] = [];
      categoryMap[category].push(userData);
      addedUsers.push({ id: userId, ...userData });
      totalImported++;
    }

    for (const category of Object.keys(categoryMap)) {
      const categoryDoc = allStaffDocs.find(d => d.category === category);
      if (categoryDoc) {
        await updateDoc(categoryDoc.ref, { staffs: [...(categoryDoc.data.staffs || []), ...categoryMap[category]] });
      } else {
        await setDoc(doc(db, 'staffs', category), { category, staffs: categoryMap[category] });
      }
    }

    const { logActivity } = require('../utils/logger');
    logActivity({
      category: 'USER_MANAGEMENT', action: 'Bulk Import Staff', status: 'SUCCESS',
      actor: { userId: actorEmail, email: actorEmail, name: req.user?.name || 'System', role: req.user?.role || 'SYSTEM' },
      details: { imported: totalImported, dbDuplicates: dbDuplicates.length }
    });

    invalidateCache();

    res.json({
      success: true,
      message: `Successfully added ${totalImported} staff members`,
      importedCount: totalImported,
      dbDuplicatesCount: dbDuplicates.length,
      duplicateDetails: dbDuplicates,
      users: addedUsers.map(u => { const { password, ...rest } = u; return rest; }),
    });
  } catch (err) {
    console.error('Error bulk adding users:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

