const express = require('express');
const {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} = require('firebase/firestore');
const { db } = require('../firebase');

const router = express.Router();

const STAFF_CREDENTIALS = {
  faculty: {
    username: 'faculty',
    password: 'faculty',
    user: {
      id: 'f1',
      name: 'Dr. Arul Kumar',
      email: 'ubendiran2007@gmail.com',
      role: 'FACULTY',
    },
  },
  hod: {
    username: 'hod',
    password: 'hod',
    user: {
      id: 'h1',
      name: 'Dr. Meena Iyer',
      email: 'ubendirankumar@gmail.com',
      role: 'HOD',
    },
  },
  principal: {
    username: 'principal',
    password: 'principal',
    user: {
      id: 'p1',
      name: 'Dr. S. Rajan',
      email: 'ubendiran.lakshmanan007@gmail.com',
      role: 'PRINCIPAL',
    },
  },
  media: {
    username: 'media',
    password: 'media',
    user: {
      id: 'm1',
      name: 'Media Team',
      email: 'media@sece.ac.in',
      role: 'MEDIA',
    },
  },
};

async function syncStaffUserToFirestore(staffUser, password) {
  if (!db || !staffUser?.id) return;

  const userRef = doc(db, 'users', staffUser.id);
  const existing = await getDoc(userRef);
  const current = existing.exists() ? existing.data() : {};

  await setDoc(userRef, {
    ...current,
    name: staffUser.name,
    email: String(staffUser.email || '').toLowerCase(),
    role: String(staffUser.role || '').toUpperCase(),
    password,
    updatedAt: new Date().toISOString(),
    createdAt: current.createdAt || new Date().toISOString(),
  }, { merge: true });
}

async function syncAllStaffUsersToFirestore() {
  const staffEntries = Object.values(STAFF_CREDENTIALS);
  let syncedCount = 0;

  for (const entry of staffEntries) {
    if (!entry?.user?.id) continue;
    await syncStaffUserToFirestore(entry.user, entry.password);
    syncedCount += 1;
  }

  return syncedCount;
}

// GET /api/login — health check
router.get('/login', (req, res) => {
  res.json({ status: 'Login API working' });
});

// POST /api/login/seed-staff-users — seed default staff into Firestore users collection
router.post('/login/seed-staff-users', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Firestore is not configured',
      });
    }

    const syncedCount = await syncAllStaffUsersToFirestore();

    return res.json({
      success: true,
      message: `Seeded ${syncedCount} staff users into Firestore`,
      users: Object.values(STAFF_CREDENTIALS).map((entry) => ({
        id: entry.user.id,
        email: entry.user.email,
        role: entry.user.role,
      })),
    });
  } catch (error) {
    console.error('[auth] Error seeding staff users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to seed staff users',
      error: error.message,
    });
  }
});

// POST /api/login — authenticate a user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  try {
    // 0. Default staff credentials (requested fallback)
    const matchedStaff = Object.values(STAFF_CREDENTIALS).find(
      (cred) =>
        cred.username.toLowerCase() === String(email).toLowerCase() &&
        cred.password === password
    );

    if (matchedStaff) {
      try {
        await syncStaffUserToFirestore(matchedStaff.user, matchedStaff.password);
      } catch (syncError) {
        console.warn('[auth] Unable to sync staff user to Firestore:', syncError.message);
      }

      return res.json({
        success: true,
        message: 'Login successful',
        user: matchedStaff.user,
      });
    }

    // ── 1. Check the top-level "users" collection ──────────────────────────
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase())
    );
    const usersSnapshot = await getDocs(usersQuery);

    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();

      if (userData.password === password) {
        const { password: _pw, ...safeData } = userData;
        return res.json({
          success: true,
          message: 'Login successful',
          user: { id: userDoc.id, ...safeData },
        });
      }

      // Email matched but password wrong — stop here
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // ── 2. Fall back to students/{className}/members structure ─────────────
    // Students use "username" (email) + "password" (roll number) fields
    const classes = ['CSE-B', 'CSE-D'];

    for (const className of classes) {
      const membersSnapshot = await getDocs(
        collection(db, 'students', className, 'members')
      );

      for (const memberDoc of membersSnapshot.docs) {
        const student = memberDoc.data();

        const usernameMatch =
          student.username?.toLowerCase() === email.toLowerCase() ||
          student.email?.toLowerCase() === email.toLowerCase();

        const passwordMatch =
          student.password?.toUpperCase() === password.toUpperCase();

        if (usernameMatch && passwordMatch) {
          return res.json({
            success: true,
            message: 'Login successful',
            user: {
              id: memberDoc.id,
              email: student.email || student.username,
              name: student.name || null,
              role: (student.role || 'STUDENT_GENERAL').toUpperCase(),
              isApprovedOrganizer: student.isApprovedOrganizer || false,
              className,
            },
          });
        }
      }
    }

    // ── 3. No match found ─────────────────────────────────────────────────
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
