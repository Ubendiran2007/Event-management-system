const express = require('express');
const {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  deleteDoc
} = require('firebase/firestore');
const { db } = require('../firebase');
const { issueToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const UAParser = require('ua-parser-js');
const { sendEmail } = require('../services/emailService');
const emailTemplates = require('../services/emailTemplates');

const router = express.Router();

const STAFF_CREDENTIALS = {
  // ── CSE ──────────────────────────────────────────────────
  'faculty.cse':  { username: 'faculty.cse',  password: 'password', user: { id: 'f_cse',   name: 'Dr. Arul Kumar',     email: 'ubendirankumar@gmail.com',   role: 'FACULTY', department: 'CSE'   } },
  'hod.cse':      { username: 'hod.cse',      password: 'password', user: { id: 'h_cse',   name: 'Dr. Meena Iyer',     email: 'ubendirankumar@gmail.com',       role: 'HOD',     department: 'CSE'   } },

  // ── ECE ──────────────────────────────────────────────────
  'faculty.ece':  { username: 'faculty.ece',  password: 'password', user: { id: 'f_ece',   name: 'Dr. Ramesh S',       email: 'ubendirankumar@gmail.com',   role: 'FACULTY', department: 'ECE'   } },
  'hod.ece':      { username: 'hod.ece',      password: 'password', user: { id: 'h_ece',   name: 'Dr. Suresh K',       email: 'ubendirankumar@gmail.com',       role: 'HOD',     department: 'ECE'   } },

  // ── CCE ──────────────────────────────────────────────────
  'faculty.cce':  { username: 'faculty.cce',  password: 'password', user: { id: 'f_cce',   name: 'Dr. Anitha R',       email: 'ubendirankumar@gmail.com',   role: 'FACULTY', department: 'CCE'   } },
  'hod.cce':      { username: 'hod.cce',      password: 'password', user: { id: 'h_cce',   name: 'Dr. Senthil N',      email: 'ubendirankumar@gmail.com',       role: 'HOD',     department: 'CCE'   } },

  // ── Cyber Security ─────────────────────────────────────────
  'faculty.cyber': { username: 'faculty.cyber', password: 'password', user: { id: 'f_cyber', name: 'Dr. Vijay M',      email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'Cyber' } },
  'hod.cyber':     { username: 'hod.cyber',     password: 'password', user: { id: 'h_cyber', name: 'Dr. Pradeep G',    email: 'ubendirankumar@gmail.com',     role: 'HOD',     department: 'Cyber' } },

  // ── CSBS ─────────────────────────────────────────────────
  'faculty.csbs': { username: 'faculty.csbs', password: 'password', user: { id: 'f_csbs',  name: 'Dr. Nithya B',       email: 'ubendirankumar@gmail.com',  role: 'FACULTY', department: 'CSBS'  } },
  'hod.csbs':     { username: 'hod.csbs',     password: 'password', user: { id: 'h_csbs',  name: 'Dr. Rajan L',        email: 'ubendirankumar@gmail.com',      role: 'HOD',     department: 'CSBS'  } },

  // ── MECH ─────────────────────────────────────────────────
  'faculty.mech': { username: 'faculty.mech', password: 'password', user: { id: 'f_mech',  name: 'Dr. Karthik A',      email: 'ubendirankumar@gmail.com',  role: 'FACULTY', department: 'MECH'  } },
  'hod.mech':     { username: 'hod.mech',     password: 'password', user: { id: 'h_mech',  name: 'Dr. Babu T',         email: 'ubendirankumar@gmail.com',      role: 'HOD',     department: 'MECH'  } },

  // ── IT ───────────────────────────────────────────────────
  'faculty.it':   { username: 'faculty.it',   password: 'password', user: { id: 'f_it',    name: 'Dr. Kavitha S',      email: 'ubendirankumar@gmail.com',    role: 'FACULTY', department: 'IT'    } },
  'hod.it':       { username: 'hod.it',       password: 'password', user: { id: 'h_it',    name: 'Dr. Rajesh P',       email: 'ubendirankumar@gmail.com',        role: 'HOD',     department: 'IT'    } },

  // ── AI & DS ──────────────────────────────────────────────
  'faculty.aids': { username: 'faculty.aids', password: 'password', user: { id: 'f_aids',  name: 'Dr. Divya P',        email: 'ubendirankumar@gmail.com',  role: 'FACULTY', department: 'AI&DS' } },
  'hod.aids':     { username: 'hod.aids',     password: 'password', user: { id: 'h_aids',  name: 'Dr. Harish V',       email: 'ubendirankumar@gmail.com',      role: 'HOD',     department: 'AI&DS' } },

  // ── AIML ─────────────────────────────────────────────────
  'faculty.aiml': { username: 'faculty.aiml', password: 'password', user: { id: 'f_aiml',  name: 'Dr. Sangeetha R',    email: 'ubendirankumar@gmail.com',  role: 'FACULTY', department: 'AIML'  } },
  'hod.aiml':     { username: 'hod.aiml',     password: 'password', user: { id: 'h_aiml',  name: 'Dr. Mohan K',        email: 'ubendirankumar@gmail.com',      role: 'HOD',     department: 'AIML'  } },

  // ── EEE ──────────────────────────────────────────────────
  'faculty.eee':  { username: 'faculty.eee',  password: 'password', user: { id: 'f_eee',   name: 'Dr. Priya M',        email: 'ubendirankumar@gmail.com',   role: 'FACULTY', department: 'EEE'   } },
  'hod.eee':      { username: 'hod.eee',      password: 'password', user: { id: 'h_eee',   name: 'Dr. Vignesh R',      email: 'ubendirankumar@gmail.com',       role: 'HOD',     department: 'EEE'   } },

  // ── Global / Cross-Department Roles ──────────────────────
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

  // Store password as plain or hashed - let's keep existing logic to seed plain text so verifyPassword handles it
  await setDoc(userRef, {
    ...current,
    name: staffUser.name,
    email: String(staffUser.email || '').toLowerCase(),
    role: String(staffUser.role || '').toUpperCase(),
    department: staffUser.department || null,
    password: current.password || password,
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

// ─────────────────────────────────────────────────────────────────
// SECURITY UTILITIES
// ─────────────────────────────────────────────────────────────────

async function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored || plain.toUpperCase() === stored.toUpperCase();
}

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

function getRequestDetails(req) {
  const parser = new UAParser(req.headers['user-agent']);
  const result = parser.getResult();
  return {
    browser: result.browser.name || 'Unknown Browser',
    os: result.os.name || 'Unknown OS',
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Unknown IP',
    date: new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }),
    time: new Date().toLocaleTimeString('en-US', { timeStyle: 'short' })
  };
}

async function logSecurityEvent(userObj, activity, status, reqDetails) {
  await setDoc(doc(collection(db, 'securityLogs')), {
    userId: userObj.id || userObj.email,
    email: userObj.email?.toLowerCase(),
    activity,
    status,
    timestamp: new Date().toISOString(),
    browser: reqDetails.browser,
    os: reqDetails.os,
    ip: reqDetails.ip
  });
}

async function checkLoginRateLimit(email) {
  const attemptsRef = doc(db, 'loginAttempts', email.toLowerCase());
  const attemptDoc = await getDoc(attemptsRef);
  if (attemptDoc.exists()) {
    const data = attemptDoc.data();
    if (data.lockedUntil && new Date(data.lockedUntil) > new Date()) {
      return { locked: true, lockedUntil: data.lockedUntil };
    }
  }
  return { locked: false };
}

async function recordFailedLogin(email, userObj, reqDetails) {
  const emailLower = email.toLowerCase();
  const attemptsRef = doc(db, 'loginAttempts', emailLower);
  const attemptDoc = await getDoc(attemptsRef);
  let failedAttempts = 1;
  let lockedUntil = null;
  
  if (attemptDoc.exists()) {
    const data = attemptDoc.data();
    if (data.lockedUntil && new Date(data.lockedUntil) > new Date()) {
      return { locked: true, lockedUntil: data.lockedUntil };
    }
    failedAttempts = (data.failedAttempts || 0) + 1;
  }
  
  if (failedAttempts >= 5) {
    lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  }
  
  await setDoc(attemptsRef, {
    failedAttempts,
    lockedUntil,
    lastAttempt: new Date().toISOString()
  }, { merge: true });
  
  const targetUser = userObj || { id: 'UNKNOWN', email: emailLower };
  await logSecurityEvent(targetUser, 'Failed Login Attempt', 'FAILURE', reqDetails);
  
  if (lockedUntil && userObj && userObj.email) {
    await logSecurityEvent(targetUser, 'Account Locked', 'WARNING', reqDetails);
    await sendEmail(
      userObj.email,
      'Account Temporarily Locked - Event Management & IQAC Portal',
      emailTemplates.accountLockedTemplate(userObj, reqDetails, 15)
    );
  }
  
  return { locked: !!lockedUntil, lockedUntil };
}

async function handleLoginSuccess(userObj, reqDetails) {
  const emailLower = userObj.email.toLowerCase();
  await setDoc(doc(db, 'loginAttempts', emailLower), { failedAttempts: 0, lockedUntil: null }, { merge: true });
  
  // Detect suspicious login
  const logsQuery = query(collection(db, 'loginLogs'), where('email', '==', emailLower));
  const logsSnapshot = await getDocs(logsQuery);
  let isSuspicious = false;
  
  if (!logsSnapshot.empty) {
    const previousLogs = logsSnapshot.docs.map(d => d.data());
    const matchedDevice = previousLogs.find(l => 
      l.ip === reqDetails.ip || 
      (l.browser === reqDetails.browser && l.os === reqDetails.os)
    );
    if (!matchedDevice) {
      isSuspicious = true;
    }
  }
  
  // Log Login
  await setDoc(doc(collection(db, 'loginLogs')), {
    userId: userObj.id,
    name: userObj.name || '',
    role: userObj.role || '',
    department: userObj.department || '',
    rollNo: userObj.rollNo || userObj.employeeId || '',
    email: emailLower,
    timestamp: new Date().toISOString(),
    browser: reqDetails.browser,
    os: reqDetails.os,
    ip: reqDetails.ip,
    status: 'SUCCESS'
  });
  
  await logSecurityEvent(userObj, 'Successful Login', 'SUCCESS', reqDetails);
  
  if (isSuspicious) {
    await logSecurityEvent(userObj, 'Suspicious Login Detected', 'WARNING', reqDetails);
    await sendEmail(
      userObj.email,
      'Security Alert - New Device Login Detected',
      emailTemplates.suspiciousLoginTemplate(userObj, reqDetails)
    );
  } else {
    // Regular login alert
    await sendEmail(
      userObj.email,
      'New Login Detected - Event Management & IQAC Portal',
      emailTemplates.loginAlertTemplate(userObj, reqDetails)
    );
  }
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
  const reqDetails = getRequestDetails(req);

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  try {
    const rateLimit = await checkLoginRateLimit(email);
    if (rateLimit.locked) {
      const waitMinutes = Math.ceil((new Date(rateLimit.lockedUntil) - new Date()) / 60000);
      return res.status(403).json({ success: false, message: `Account temporarily locked. Try again in ${waitMinutes} minutes.` });
    }

    let foundUserObj = null;
    let foundStoredPassword = null;
    let isStudent = false;
    let studentRefPath = null;

    // ── 1. Check the top-level "users" collection ──────────────────────────
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase())
    );
    const usersSnapshot = await getDocs(usersQuery);

    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      foundStoredPassword = userData.password;
      const { password: _pw, ...safeData } = userData;
      foundUserObj = { id: userDoc.id, ...safeData };
    }

    // ── 2. Check Default staff credentials (fallback) ──────────────────────
    if (!foundUserObj) {
      const matchedStaff = Object.values(STAFF_CREDENTIALS).find(
        (cred) => cred.username.toLowerCase() === String(email).toLowerCase()
      );
      if (matchedStaff) {
        foundStoredPassword = matchedStaff.password;
        foundUserObj = matchedStaff.user;
        // Optionally sync them
        syncStaffUserToFirestore(matchedStaff.user, matchedStaff.password).catch(() => {});
      }
    }

    // ── 3. Fall back to students/{className}/members structure ─────────────
    if (!foundUserObj) {
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
        const membersQuery = query(collection(db, 'students', className, 'members'), where('username', '==', email.toLowerCase()));
        const membersSnapshot = await getDocs(membersQuery);
        if (!membersSnapshot.empty) {
          const memberDoc = membersSnapshot.docs[0];
          const student = memberDoc.data();
          foundStoredPassword = student.password;
          foundUserObj = {
            id: memberDoc.id,
            email: student.email || student.username,
            name: student.name || null,
            role: (student.role || 'STUDENT_GENERAL').toUpperCase(),
            department: student.department || 'CSE',
            rollNo: student.rollNo || student.password,
            isApprovedOrganizer: student.isApprovedOrganizer || false,
            odUsed: student.odUsed || 0,
            odLimit: student.odLimit || 7,
            className,
          };
          isStudent = true;
          studentRefPath = { col1: 'students', doc1: className, col2: 'members', doc2: memberDoc.id };
          break;
        } else {
          // Check by email field
          const emailQuery = query(collection(db, 'students', className, 'members'), where('email', '==', email.toLowerCase()));
          const emailSnapshot = await getDocs(emailQuery);
          if (!emailSnapshot.empty) {
            const memberDoc = emailSnapshot.docs[0];
            const student = memberDoc.data();
            foundStoredPassword = student.password;
            foundUserObj = {
              id: memberDoc.id,
              email: student.email || student.username,
              name: student.name || null,
              role: (student.role || 'STUDENT_GENERAL').toUpperCase(),
              department: student.department || 'CSE',
              rollNo: student.rollNo || student.password,
              isApprovedOrganizer: student.isApprovedOrganizer || false,
              odUsed: student.odUsed || 0,
              odLimit: student.odLimit || 7,
              className,
            };
            isStudent = true;
            studentRefPath = { col1: 'students', doc1: className, col2: 'members', doc2: memberDoc.id };
            break;
          }
        }
      }
    }

    if (!foundUserObj) {
      await recordFailedLogin(email, null, reqDetails);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Verify Password
    const isMatch = await verifyPassword(password, foundStoredPassword);

    if (!isMatch) {
      const lockStatus = await recordFailedLogin(email, foundUserObj, reqDetails);
      if (lockStatus.locked) {
        return res.status(403).json({ success: false, message: 'Account locked due to too many failed attempts.' });
      }
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Login Success
    await handleLoginSuccess(foundUserObj, reqDetails);

    // Optional: Upgrade password to hash if it's currently plain text
    if (foundStoredPassword && !foundStoredPassword.startsWith('$2')) {
      const hashed = await hashPassword(password);
      if (isStudent && studentRefPath) {
        await setDoc(doc(db, studentRefPath.col1, studentRefPath.doc1, studentRefPath.col2, studentRefPath.doc2), { password: hashed }, { merge: true });
      } else {
        await setDoc(doc(db, 'users', foundUserObj.id), { password: hashed }, { merge: true });
      }
    }

    return res.json({
      success: true,
      message: 'Login successful',
      user: foundUserObj,
      token: issueToken(foundUserObj),
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
