const express = require('express');
const router = express.Router();
const { db, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, getDoc, limit } = require('../firebaseClientWrapper');
const { requireAuth, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const { buildStaffData } = require('../services/userService');

// Protect all Manage Users APIs
router.use(requireAuth);
router.use(requireRole(['IQAC_TEAM', 'HOD'])); // IQAC and HOD can manage staff

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

// GET /api/users — fetch all staff members
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const allUsers = [];
    snapshot.docs.forEach(d => {
      const data = d.data();
      delete data.password; // never expose passwords
      allUsers.push({ id: d.id, ...data });
    });
    res.json({ success: true, users: allUsers, total: allUsers.length });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users — add a new staff member
router.post('/', async (req, res) => {
  if (checkDb(res)) return;
  const { name, email, role, department, password, assignedClasses } = req.body;

  if (!name || !email || !role || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, role, and password are required' });
  }

  try {
    // Check if user already exists
    const usersQuery = query(collection(db, 'users'), where('email', '==', email.toLowerCase()), limit(1));
    const snapshot = await getDocs(usersQuery);
    if (!snapshot.empty) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const { userId, userData } = await buildStaffData({ name, email, role, department, password, assignedClasses });

    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, userData);
    
    const responseData = { ...userData };
    delete responseData.password;
    
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
    const userRef = doc(db, 'users', id);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

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

    await updateDoc(userRef, updates);
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
    const userRef = doc(db, 'users', id);
    await deleteDoc(userRef);
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

    // Step 1: Pre-fetch existing emails and document IDs to prevent race-condition duplicates
    const snapshot = await getDocs(collection(db, 'users'));
    const existingEmails = new Set();
    const existingIds = new Set();
    
    snapshot.docs.forEach(d => {
      existingIds.add(d.id);
      const data = d.data();
      if (data.email) existingEmails.add(data.email.toLowerCase());
    });

    const validToImport = [];
    const dbDuplicates = [];

    // Step 2: Separate duplicates from valid records
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

    // Step 3: Batch import with abort-on-failure
    const { writeBatch } = require('../firebaseClientWrapper');
    let batch = writeBatch(db);
    let countInBatch = 0;
    let totalImported = 0;
    
    const addedUsers = [];

    for (let i = 0; i < validToImport.length; i++) {
      const user = validToImport[i];
      const { userId, userData } = await buildStaffData(user);
      
      const userRef = doc(db, 'users', userId);
      batch.set(userRef, userData);
      addedUsers.push({ id: userId, ...userData });
      
      countInBatch++;
      totalImported++;

      if (countInBatch === 490 || i === validToImport.length - 1) {
        try {
          await batch.commit();
          batch = writeBatch(db); // reset for next batch
          countInBatch = 0;
        } catch (batchErr) {
          console.error('Batch commit failed:', batchErr);
          // ABORT on failure!
          
          // Log activity for what succeeded so far
          if (totalImported - countInBatch > 0) {
            const { logActivity } = require('../utils/logger');
            logActivity({
              category: 'USER_MANAGEMENT',
              action: 'Bulk Import Staff (Partial Failure)',
              status: 'WARNING',
              actor: { userId: actorEmail, email: actorEmail, name: req.user?.name || 'System', role: req.user?.role || 'SYSTEM' },
              details: { 
                imported: totalImported - countInBatch,
                failed: validToImport.length - (totalImported - countInBatch),
                dbDuplicates: dbDuplicates.length
              }
            });
          }

          return res.status(500).json({
            success: false,
            message: 'A database write batch failed. Import aborted.',
            importedCount: totalImported - countInBatch,
            failedCount: validToImport.length - (totalImported - countInBatch),
            dbDuplicatesCount: dbDuplicates.length
          });
        }
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
