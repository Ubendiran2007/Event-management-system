const express = require('express');
const router = express.Router();
const { db, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, getDoc, limit } = require('../firebaseClientWrapper');
const { requireAuth, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const { buildStaffData } = require('../services/userService');
const { getAllStaffDocs } = require('../utils/staffHelper');

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
};
// ----------------------------

// GET /api/users — fetch all staff members
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  try {
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
    res.json({ success: true, users: allUsers, total: allUsers.length });
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
  const { name, email, role, department, password, assignedClasses } = req.body;

  if (!name || !email || !role || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, role, and password are required' });
  }

  try {
    const allStaffDocs = await getAllStaffDocs();
    
    // Check if user already exists
    let existingUser = false;
    for (const sDoc of allStaffDocs) {
      const arr = sDoc.data.staffs || [];
      if (arr.some(s => s.email?.toLowerCase() === email.toLowerCase())) {
        existingUser = true;
        break;
      }
    }
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const { userId, userData } = await buildStaffData({ name, email, role, department, password, assignedClasses });

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

    // Pre-fetch all staffs
    const allStaffDocs = await getAllStaffDocs();
    const existingEmails = new Set();
    const existingIds = new Set();
    
    allStaffDocs.forEach(sDoc => {
      const arr = sDoc.data.staffs || [];
      arr.forEach(s => {
        if (s.id) existingIds.add(s.id);
        if (s.email) existingEmails.add(s.email.toLowerCase());
      });
    });

    const validToImport = [];
    const dbDuplicates = [];

    for (const user of newUsers) {
      const { staffId, email } = user;
      const docId = staffId ? `staff_${staffId}` : null;
      
      if ((docId && existingIds.has(docId)) || (email && existingEmails.has(email.toLowerCase()))) {
        dbDuplicates.push(user);
      } else {
        validToImport.push(user);
      }
    }

    if (validToImport.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No new users to import', 
        importedCount: 0, 
        dbDuplicatesCount: dbDuplicates.length 
      });
    }

    let totalImported = 0;
    const addedUsers = [];
    
    // Group new users by category to write them correctly
    const categoryMap = {};

    for (let i = 0; i < validToImport.length; i++) {
      const user = validToImport[i];
      const { userId, userData } = await buildStaffData(user);
      
      const category = INCHARGE_ROLES.includes(userData.role.toUpperCase()) ? 'Incharges' : (userData.department || 'Unknown').toUpperCase();
      
      if (!categoryMap[category]) {
        categoryMap[category] = [];
      }
      categoryMap[category].push(userData);
      
      addedUsers.push({ id: userId, ...userData });
      totalImported++;
    }

    // Write to DB
    for (const category of Object.keys(categoryMap)) {
      const categoryDoc = allStaffDocs.find(d => d.category === category);
      if (categoryDoc) {
        const arr = categoryDoc.data.staffs || [];
        const newArr = arr.concat(categoryMap[category]);
        await updateDoc(categoryDoc.ref, { staffs: newArr });
      } else {
        const newRef = doc(db, 'staffs', category);
        await setDoc(newRef, { category, staffs: categoryMap[category] });
      }
    }

    // Log Activity for full success
    const { logActivity } = require('../utils/logger');
    logActivity({
      category: 'USER_MANAGEMENT',
      action: 'Bulk Import Staff',
      status: 'SUCCESS',
      actor: { userId: actorEmail, email: actorEmail, name: req.user?.name || 'System', role: req.user?.role || 'SYSTEM' },
      details: { 
        imported: totalImported,
        dbDuplicates: dbDuplicates.length
      }
    });

    invalidateCache();

    res.json({ 
      success: true, 
      message: `Successfully added ${totalImported} staff members`, 
      importedCount: totalImported, 
      dbDuplicatesCount: dbDuplicates.length,
      users: addedUsers.map(u => { const { password, ...rest } = u; return rest; }) 
    });

  } catch (err) {
    console.error('Error bulk adding users:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
