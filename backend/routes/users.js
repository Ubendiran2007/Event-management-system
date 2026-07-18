const express = require('express');
const router = express.Router();
const { db, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, getDoc } = require('../firebaseClientWrapper');
const { requireAuth, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

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
    const usersQuery = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
    const snapshot = await getDocs(usersQuery);
    if (!snapshot.empty) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const userId = `staff_${Date.now()}`;
    const userRef = doc(db, 'users', userId);
    
    const userData = {
      name,
      email: email.toLowerCase(),
      role: role.toUpperCase(),
      department: department || null,
      assignedClasses: assignedClasses || [],
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

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

module.exports = router;
