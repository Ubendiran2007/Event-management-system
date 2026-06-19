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
  // â”€â”€ CSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'faculty.cse':  { username: 'faculty.cse',  password: 'password', user: { id: 'f_cse',   name: 'Dr. Arul Kumar',     email: 'ubendirankumar@gmail.com',   role: 'FACULTY', department: 'CSE'   } },
  'hod.cse':      { username: 'hod.cse',      password: 'password', user: { id: 'h_cse',   name: 'Dr. Meena Iyer',     email: 'ubendirankumar@gmail.com',       role: 'HOD',     department: 'CSE'   } },

  // â”€â”€ ECE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'faculty.ece':  { username: 'faculty.ece',  password: 'password', user: { id: 'f_ece',   name: 'Dr. Ramesh S',       email: 'ubendirankumar@gmail.com',   role: 'FACULTY', department: 'ECE'   } },
  'hod.ece':      { username: 'hod.ece',      password: 'password', user: { id: 'h_ece',   name: 'Dr. Suresh K',       email: 'ubendirankumar@gmail.com',       role: 'HOD',     department: 'ECE'   } },

  // â”€â”€ CCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'faculty.cce':  { username: 'faculty.cce',  password: 'password', user: { id: 'f_cce',   name: 'Dr. Anitha R',       email: 'ubendirankumar@gmail.com',   role: 'FACULTY', department: 'CCE'   } },
  'hod.cce':      { username: 'hod.cce',      password: 'password', user: { id: 'h_cce',   name: 'Dr. Senthil N',      email: 'ubendirankumar@gmail.com',       role: 'HOD',     department: 'CCE'   } },

  // â”€â”€ Cyber Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'faculty.cyber': { username: 'faculty.cyber', password: 'password', user: { id: 'f_cyber', name: 'Dr. Vijay M',      email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'Cyber' } },
  'hod.cyber':     { username: 'hod.cyber',     password: 'password', user: { id: 'h_cyber', name: 'Dr. Pradeep G',    email: 'ubendirankumar@gmail.com',     role: 'HOD',     department: 'Cyber' } },

  // â”€â”€ CSBS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'faculty.csbs': { username: 'faculty.csbs', password: 'password', user: { id: 'f_csbs',  name: 'Dr. Nithya B',       email: 'ubendirankumar@gmail.com',  role: 'FACULTY', department: 'CSBS'  } },
  'hod.csbs':     { username: 'hod.csbs',     password: 'password', user: { id: 'h_csbs',  name: 'Dr. Rajan L',        email: 'ubendirankumar@gmail.com',      role: 'HOD',     department: 'CSBS'  } },

  // â”€â”€ MECH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'faculty.mech': { username: 'faculty.mech', password: 'password', user: { id: 'f_mech',  name: 'Dr. Karthik A',      email: 'ubendirankumar@gmail.com',  role: 'FACULTY', department: 'MECH'  } },
  'hod.mech':     { username: 'hod.mech',     password: 'password', user: { id: 'h_mech',  name: 'Dr. Babu T',         email: 'ubendirankumar@gmail.com',      role: 'HOD',     department: 'MECH'  } },

  // â”€â”€ IT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'faculty.it':   { username: 'faculty.it',   password: 'password', user: { id: 'f_it',    name: 'Dr. Kavitha S',      email: 'ubendirankumar@gmail.com',    role: 'FACULTY', department: 'IT'    } },
  'hod.it':       { username: 'hod.it',       password: 'password', user: { id: 'h_it',    name: 'Dr. Rajesh P',       email: 'ubendirankumar@gmail.com',        role: 'HOD',     department: 'IT'    } },

  // â”€â”€ AI & DS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'faculty.aids': { username: 'faculty.aids', password: 'password', user: { id: 'f_aids',  name: 'Dr. Divya P',        email: 'ubendirankumar@gmail.com',  role: 'FACULTY', department: 'AI&DS' } },
  'hod.aids':     { username: 'hod.aids',     password: 'password', user: { id: 'h_aids',  name: 'Dr. Harish V',       email: 'ubendirankumar@gmail.com',      role: 'HOD',     department: 'AI&DS' } },

  // â”€â”€ AIML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'faculty.aiml': { username: 'faculty.aiml', password: 'password', user: { id: 'f_aiml',  name: 'Dr. Sangeetha R',    email: 'ubendirankumar@gmail.com',  role: 'FACULTY', department: 'AIML'  } },
  'hod.aiml':     { username: 'hod.aiml',     password: 'password', user: { id: 'h_aiml',  name: 'Dr. Mohan K',        email: 'ubendirankumar@gmail.com',      role: 'HOD',     department: 'AIML'  } },

  // â”€â”€ EEE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  'faculty.eee':  { username: 'faculty.eee',  password: 'password', user: { id: 'f_eee',   name: 'Dr. Priya M',        email: 'ubendirankumar@gmail.com',   role: 'FACULTY', department: 'EEE'   } },
  'hod.eee':      { username: 'hod.eee',      password: 'password', user: { id: 'h_eee',   name: 'Dr. Vignesh R',      email: 'ubendirankumar@gmail.com',       role: 'HOD',     department: 'EEE'   } },

  // â”€â”€ Global / Cross-Department Roles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  hr:           { username: 'hr',           password: 'hr',        user: { id: 'hr1',    name: 'HR Department',      email: 'ubendirankumar@gmail.com',            role: 'HR_TEAM',        department: null } },
  audio:        { username: 'audio',        password: 'audio',     user: { id: 'au1',    name: 'Audio Section',      email: 'ubendirankumar@gmail.com',         role: 'AUDIO_TEAM',     department: null } },
  icts:         { username: 'icts',         password: 'icts',      user: { id: 'ic1',    name: 'ICTS Team',          email: 'ubendirankumar@gmail.com',          role: 'SYSTEM_ADMIN',   department: null } },
  transport:    { username: 'transport',    password: 'transport', user: { id: 'tr1',    name: 'Transport Office',   email: 'ubendirankumar@gmail.com',     role: 'TRANSPORT_TEAM', department: null } },
  warden:       { username: 'warden',       password: 'warden',    user: { id: 'wa1',    name: 'Boys Hostel Warden', email: 'ubendirankumar@gmail.com',        role: 'BOYS_WARDEN',    department: null } },
  warden_girls: { username: 'warden.girls', password: 'warden',    user: { id: 'wa2',    name: 'Girls Hostel Warden',email: 'ubendirankumar@gmail.com',  role: 'GIRLS_WARDEN',   department: null } },
  media:        { username: 'media',        password: 'media',     user: { id: 'md1',    name: 'Media Team',         email: 'ubendirankumar@gmail.com',         role: 'MEDIA',          department: null } },
  iqac:         { username: 'iqac',         password: 'iqac',      user: { id: 'iq1',    name: 'IQAC Team',          email: 'ubendirankumar@gmail.com',          role: 'IQAC_TEAM',      department: null } },
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
    department: staffUser.department || null,
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

// GET /api/login â€” health check
router.get('/login', (req, res) => {
  res.json({ status: 'Login API working' });
});

// POST /api/login/seed-staff-users â€” seed default staff into Firestore users collection
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

// POST /api/login â€” authenticate a user
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

    // â”€â”€ 1. Check the top-level "users" collection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

      // Email matched but password wrong â€” stop here
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // â”€â”€ 2. Fall back to students/{className}/members structure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Students use "username" (email) + "password" (roll number) fields
    const classes = [
      'CSE-B', 'CSE-D', 
      'ECE-A', 'ECE-B', 
      'CCE-A', 
      'CSBS-A', 
      'MECH-A', 
      'CYBER-A', 
      'EEE-A', 
      'AIML-A', 
      'AIDS-A'
    ];

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
              department: student.department || 'CSE', // Multi-department fallback
              isApprovedOrganizer: student.isApprovedOrganizer || false,
              odUsed: student.odUsed || 0,
              odLimit: student.odLimit || 7,
              className,
            },
          });
        }
      }
    }

    // â”€â”€ 3. No match found â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
