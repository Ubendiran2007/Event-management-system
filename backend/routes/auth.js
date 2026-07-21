const express = require('express');
const {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  deleteDoc,
  limit,
  db
} = require('../firebaseClientWrapper');
const { issueToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const UAParser = require('ua-parser-js');
const { sendEmail } = require('../services/emailService');
const emailTemplates = require('../services/emailTemplates');
const { logAudit } = require('../utils/logger');
const crypto = require('crypto');

const router = express.Router();

const STAFF_CREDENTIALS = {
  // ── CSE ──────────────────────────────────────────────────
  'faculty.cse.seeded1': { username: 'csefaculty1', password: 'password', user: { id: 'fac_cse_mock_1', name: 'CSE Faculty 1', email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'CSE', assignedClasses: [] } },
  'faculty.cse.seeded2': { username: 'csefaculty2', password: 'password', user: { id: 'fac_cse_mock_2', name: 'CSE Faculty 2', email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'CSE', assignedClasses: [] } },
  'faculty.cse.seeded3': { username: 'csefaculty3', password: 'password', user: { id: 'fac_cse_mock_3', name: 'CSE Faculty 3', email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'CSE', assignedClasses: [] } },
  'faculty.cse.seeded4': { username: 'csefaculty4', password: 'password', user: { id: 'fac_cse_mock_4', name: 'CSE Faculty 4', email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'CSE', assignedClasses: [] } },
  'faculty.cse.seeded5': { username: 'csefaculty5', password: 'password', user: { id: 'fac_cse_mock_5', name: 'CSE Faculty 5', email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'CSE', assignedClasses: [] } },
  'faculty.cse.seeded6': { username: 'csefaculty6', password: 'password', user: { id: 'fac_cse_mock_6', name: 'CSE Faculty 6', email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'CSE', assignedClasses: [] } },
  'faculty.cse.seeded7': { username: 'csefaculty7', password: 'password', user: { id: 'fac_cse_mock_7', name: 'CSE Faculty 7', email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'CSE', assignedClasses: [] } },
  'faculty.cse.seeded8': { username: 'csefaculty8', password: 'password', user: { id: 'fac_cse_mock_8', name: 'CSE Faculty 8', email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'CSE', assignedClasses: [] } },
  'faculty.cse.seeded9': { username: 'csefaculty9', password: 'password', user: { id: 'fac_cse_mock_9', name: 'CSE Faculty 9', email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'CSE', assignedClasses: [] } },
  'faculty.cse.seeded10': { username: 'csefaculty10', password: 'password', user: { id: 'fac_cse_mock_10', name: 'CSE Faculty 10', email: 'ubendirankumar@gmail.com', role: 'FACULTY', department: 'CSE', assignedClasses: [] } },
  'faculty.cse':  { username: 'faculty.cse',  password: 'password', user: { id: 'f_cse',   name: 'Dr. Arul Kumar',     email: 'ubendirankumar@gmail.com',   role: 'FACULTY', department: 'CSE', assignedClasses: ['CSE B', 'CSE D'] } },
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
    assignedClasses: (current.assignedClasses !== undefined && Array.isArray(current.assignedClasses)) 
      ? current.assignedClasses 
      : (staffUser.assignedClasses || []),
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
  // Deprecated: Migrating to logAudit
  // logAudit handles this natively now, this function is preserved to avoid breaking refs until fully migrated
  logAudit({
    category: 'AUTH',
    action: activity.toUpperCase().replace(/\s+/g, '_'),
    status: status,
    actor: {
      userId: userObj.id || userObj.email,
      name: userObj.name || userObj.email,
      role: userObj.role || 'UNKNOWN'
    },
    ipAddress: reqDetails.ip,
    userAgent: reqDetails.browser
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
  
  // Log Login using Unified Logger
  logAudit({
    category: 'AUTH',
    action: 'LOGIN_SUCCESS',
    status: 'SUCCESS',
    correlationId: crypto.randomUUID(), // New request tracking
    actor: {
      userId: userObj.id,
      name: userObj.name || '',
      role: userObj.role || '',
      email: emailLower
    },
    details: {
      department: userObj.department || '',
      rollNo: userObj.rollNo || userObj.employeeId || '',
      isSuspicious
    },
    ipAddress: reqDetails.ip,
    userAgent: `${reqDetails.os} - ${reqDetails.browser}`
  });
  
  // Keep legacy writing to `loginLogs` strictly for the frontend /login-history backward compatibility, 
  // but we will also update frontend /login-history to query auditLogs instead later in this module.
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

    // ── 1. Check the top-level "users" collection (Module 2 Architecture) ──
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', email.toLowerCase()),
      limit(1)
    );
    const usersSnapshot = await getDocs(usersQuery);

    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      
      // Lifecycle check
      if (userData.status && userData.status !== 'ACTIVE' && userData.status !== 'GRADUATED') {
         return res.status(403).json({ success: false, message: `Account is ${userData.status}` });
      }

      foundStoredPassword = userData.password;
      const { password: _pw, ...safeData } = userData;
      foundUserObj = { id: userDoc.id, ...safeData };

      // Fetch Profile Data (Student or Staff)
      if (userData.role && userData.role.includes('STUDENT')) {
         const profileSnap = await getDoc(doc(db, 'students', userDoc.id));
         if (profileSnap.exists()) {
             const profileData = profileSnap.data();
             foundUserObj = { 
                ...foundUserObj, 
                ...profileData,
                className: profileData.sectionId || profileData.className // Ensure backwards compatibility for UI
             };
         }
         isStudent = true;
      } else {
         const profileSnap = await getDoc(doc(db, 'staff', userDoc.id));
         if (profileSnap.exists()) {
             foundUserObj = { ...foundUserObj, ...profileSnap.data() };
         }
      }
    }

    // ── 2. Check Default staff credentials (fallback) ──────────────────────
    if (!foundUserObj) {
      const matchedStaff = Object.values(STAFF_CREDENTIALS).find(
        (cred) => cred.username.toLowerCase() === String(email).toLowerCase()
      );
      if (matchedStaff) {
        foundStoredPassword = matchedStaff.password;
        
        // Try to get their LIVE data from Firestore to catch any HOD assignments
        try {
          const liveDoc = await getDoc(doc(db, 'users', matchedStaff.user.id));
          if (liveDoc.exists()) {
            const liveData = liveDoc.data();
            const { password: _pw, ...safeData } = liveData;
            foundUserObj = { 
               ...matchedStaff.user, // fallback for any missing critical fields
               ...safeData,
               role: safeData.role || matchedStaff.user.role // ensure role is never lost
            };
          } else {
            foundUserObj = matchedStaff.user;
          }
        } catch (e) {
          foundUserObj = matchedStaff.user;
        }

        // Optionally sync them
        syncStaffUserToFirestore(matchedStaff.user, matchedStaff.password).catch(() => {});
      }
    }

    // ── 3. Fall back to students/{className}/members structure ─────────────
    if (!foundUserObj) {

      const lowerEmail = email.toLowerCase();
      const membersGroup = collectionGroup(db, 'members');
      
      const membersQuery = query(membersGroup, where('username', '==', lowerEmail), limit(1));
      const emailQuery = query(membersGroup, where('email', '==', lowerEmail), limit(1));
      
      const [membersSnapshot, emailSnapshot] = await Promise.all([
        getDocs(membersQuery),
        getDocs(emailQuery)
      ]);

      let foundResult = null;

      if (!membersSnapshot.empty) {
        foundResult = { memberDoc: membersSnapshot.docs[0], className: membersSnapshot.docs[0].ref.parent.parent.id };
      } else if (!emailSnapshot.empty) {
        foundResult = { memberDoc: emailSnapshot.docs[0], className: emailSnapshot.docs[0].ref.parent.parent.id };
      }

      if (foundResult) {
        const { memberDoc, className } = foundResult;
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
      }
    }

    if (!foundUserObj) {
      recordFailedLogin(email, null, reqDetails).catch(err => console.error('[auth] Failed login record error:', err));
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Verify Password
    const isMatch = await verifyPassword(password, foundStoredPassword);

    if (!isMatch) {
      recordFailedLogin(email, foundUserObj, reqDetails).catch(err => console.error('[auth] Failed login record error:', err));
      // We return generic 401 immediately for speed. If they are locked out, 
      // the rate limit check at the top will block their next attempt.
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Login Success - run heavy tasks in the background to speed up response
    handleLoginSuccess(foundUserObj, reqDetails).catch(err => console.error('[auth] Login success handler error:', err));

    // Optional: Upgrade password to hash if it's currently plain text (in background)
    if (foundStoredPassword && !foundStoredPassword.startsWith('$2')) {
      hashPassword(password)
        .then(async (hashed) => {
          if (isStudent && studentRefPath) {
            await setDoc(doc(db, studentRefPath.col1, studentRefPath.doc1, studentRefPath.col2, studentRefPath.doc2), { password: hashed }, { merge: true });
          } else {
            await setDoc(doc(db, 'users', foundUserObj.id), { password: hashed }, { merge: true });
          }
        })
        .catch(err => console.error('[auth] Password upgrade error:', err));
    }

    // Removed DATA CONSISTENCY CHECK to ensure login remains read-only for admin fields

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
