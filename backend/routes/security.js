const express = require('express');
const { collection, doc, getDoc, getDocs, query, setDoc, where, deleteDoc, orderBy, limit, db } = require('../firebaseClientWrapper');
const { requireAuth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const UAParser = require('ua-parser-js');
const { sendEmail } = require('../services/emailService');
const emailTemplates = require('../services/emailTemplates');

const router = express.Router();

function validateStrongPassword(password) {
  if (!password || password.length < 7) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
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

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const idLower = identifier.trim().toLowerCase();
  const idUpper = identifier.trim().toUpperCase();
  
  // 1. Check users collection
  const usersQueryEmail = query(collection(db, 'users'), where('email', '==', idLower));
  const usersSnapEmail = await getDocs(usersQueryEmail);
  if (!usersSnapEmail.empty) {
    const docSnap = usersSnapEmail.docs[0];
    return { userObj: { id: docSnap.id, ...docSnap.data(), password: undefined }, storedPassword: docSnap.data().password, type: 'user', ref: doc(db, 'users', docSnap.id) };
  }
  
  const usersQueryId = query(collection(db, 'users'), where('employeeId', '==', idUpper));
  const usersSnapId = await getDocs(usersQueryId);
  if (!usersSnapId.empty) {
    const docSnap = usersSnapId.docs[0];
    return { userObj: { id: docSnap.id, ...docSnap.data(), password: undefined }, storedPassword: docSnap.data().password, type: 'user', ref: doc(db, 'users', docSnap.id) };
  }
  
  // 2. Check students
  const classes = ['CSE-B', 'CSE-D', 'ECE-A', 'ECE-B', 'CCE-A', 'CSBS-A', 'MECH-A', 'CYBER-A', 'EEE-A', 'AIML-A', 'AIDS-A'];
  for (const className of classes) {
    const memQueryEmail = query(collection(db, 'students', className, 'members'), where('email', '==', idLower));
    const memSnapEmail = await getDocs(memQueryEmail);
    if (!memSnapEmail.empty) {
      const docSnap = memSnapEmail.docs[0];
      const data = docSnap.data();
      return { userObj: { id: docSnap.id, ...data, password: undefined, role: data.role || 'STUDENT_GENERAL', department: data.department || 'CSE' }, storedPassword: data.password, type: 'student', ref: doc(db, 'students', className, 'members', docSnap.id) };
    }
    
    const memQueryRoll = query(collection(db, 'students', className, 'members'), where('rollNo', '==', idUpper));
    const memSnapRoll = await getDocs(memQueryRoll);
    if (!memSnapRoll.empty) {
      const docSnap = memSnapRoll.docs[0];
      const data = docSnap.data();
      return { userObj: { id: docSnap.id, ...data, password: undefined, role: data.role || 'STUDENT_GENERAL', department: data.department || 'CSE' }, storedPassword: data.password, type: 'student', ref: doc(db, 'students', className, 'members', docSnap.id) };
    }
  }
  return null;
}

async function findAuthenticatedUser(user) {
  if (!user || !user.id) return null;
  
  // 1. Try to find the exact user by ID in the 'users' collection first (for staff)
  const userDocRef = doc(db, 'users', user.id);
  const userDocSnap = await getDoc(userDocRef);
  if (userDocSnap.exists()) {
    const data = userDocSnap.data();
    return { 
      userObj: { id: userDocSnap.id, ...data, password: undefined }, 
      storedPassword: data.password, 
      type: 'user', 
      ref: userDocRef 
    };
  }
  
  // 2. For students, their email is unique, so fallback to findUserByIdentifier
  return await findUserByIdentifier(user.email);
}

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function verifyPassword(plain, stored) {
  if (!stored) return false;
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored || plain.toUpperCase() === stored.toUpperCase();
}

// ==========================================
// Forgot Password Flow
// ==========================================

router.post('/forgot-password', async (req, res) => {
  const { identifier } = req.body;
  const reqDetails = getRequestDetails(req);
  
  try {
    const found = await findUserByIdentifier(identifier);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Account not found. Please enter a valid College Email, Roll Number, or Employee ID.' });
    }
    
    const actualEmail = found.userObj.email.toLowerCase();
    
    // Check attempts for OTP generation
    const otpRef = doc(db, 'otps', actualEmail);
    const otpDoc = await getDoc(otpRef);
    let attempts = 0;
    if (otpDoc.exists()) {
      const data = otpDoc.data();
      if (data.attempts >= 5 && data.expiresAt > Date.now()) {
        await logSecurityEvent(found.userObj, 'Maximum OTP Attempts Reached', 'FAILURE', reqDetails);
        return res.status(429).json({ success: false, message: 'Too many OTP requests. Please try again later.' });
      }
      attempts = data.attempts || 0;
    }
    
    const otp = generateOtp();
    await setDoc(otpRef, {
      otp,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1 * 60 * 1000,
      attempts: 0,
      maxAttempts: 5,
      used: false,
      type: 'RESET'
    });
    
    logSecurityEvent(found.userObj, 'Password Reset OTP Requested', 'SUCCESS', reqDetails).catch(err => console.error(err));
    
    sendEmail(
      found.userObj.email,
      'Password Reset Verification - Event Management & IQAC Portal',
      emailTemplates.passwordResetOtpTemplate(found.userObj, otp)
    ).catch(err => console.error(err));
    
    const [namePart, domainPart] = actualEmail.split('@');
    let maskedEmail = actualEmail;
    if (namePart && domainPart) {
      if (namePart.length > 2) {
        maskedEmail = `${namePart[0]}*******${namePart[namePart.length - 1]}@${domainPart}`;
      } else {
        maskedEmail = `*@${domainPart}`;
      }
    }
    
    res.json({ success: true, message: 'OTP sent.', maskedEmail });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { identifier, otp, type } = req.body;
  const reqDetails = getRequestDetails(req);
  if (!identifier || !otp || !type) return res.status(400).json({ success: false, message: 'Missing parameters' });
  
  try {
    const found = await findUserByIdentifier(identifier);
    if (!found) return res.status(400).json({ success: false, message: 'Account not found' });
    const email = found.userObj.email.toLowerCase();

    const otpRef = doc(db, 'otps', email);
    const otpDoc = await getDoc(otpRef);
    if (!otpDoc.exists()) return res.status(400).json({ success: false, message: 'OTP expired or not found' });
    
    const data = otpDoc.data();
    
    console.log('--- OTP VERIFICATION DEBUG ---');
    console.log('User Email:', email);
    console.log('Current Time:', new Date().toISOString(), '(', Date.now(), ')');
    console.log('OTP Expiry Time:', new Date(data.expiresAt).toISOString(), '(', data.expiresAt, ')');
    console.log('Stored OTP:', data.otp, '| Type:', typeof data.otp);
    console.log('Entered OTP:', otp, '| Type:', typeof otp);
    console.log('Type Check:', 'Stored:', data.type, '| Received:', type);
    
    if (data.type !== type || data.expiresAt < Date.now()) {
      console.log('Verification Result: FAIL (Expired or Type Mismatch)');
      await logSecurityEvent(found.userObj, 'OTP Expired', 'FAILURE', reqDetails);
      await deleteDoc(otpRef);
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }
    
    const isMatch = String(data.otp).trim() === String(otp).trim();
    console.log('Comparison Result:', isMatch);
    
    if (!isMatch) {
      console.log('Verification Result: FAIL (Invalid OTP)');
      
      const newAttempts = (data.attempts || 0) + 1;
      const maxAttempts = data.maxAttempts || 5;
      
      if (newAttempts >= maxAttempts) {
        await deleteDoc(otpRef);
        await logSecurityEvent(found.userObj, 'Maximum OTP Verification Attempts Reached', 'FAILURE', reqDetails);
        return res.status(400).json({ success: false, message: 'Maximum verification attempts reached. Please request a new OTP.' });
      } else {
        await setDoc(otpRef, { ...data, attempts: newAttempts });
        await logSecurityEvent(found.userObj, 'OTP Verification Failed', 'FAILURE', reqDetails);
        const remaining = maxAttempts - newAttempts;
        return res.status(400).json({ success: false, message: `The OTP entered is incorrect.\nAttempts Remaining: ${remaining}` });
      }
    }
    
    console.log('Verification Result: PASS');
    console.log('------------------------------');
    
    await logSecurityEvent(found.userObj, 'OTP Verified', 'SUCCESS', reqDetails);
    
    await setDoc(otpRef, {
      ...data,
      used: true,
      verifiedAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes to reset password
    });
    
    res.json({ success: true, message: 'OTP verified' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { identifier, otp, newPassword } = req.body;
  const reqDetails = getRequestDetails(req);
  
  if (!identifier || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'Identifier, OTP, and new password are required' });
  }

  if (!validateStrongPassword(newPassword)) {
    return res.status(400).json({ success: false, message: 'Password must be at least 7 characters long, containing uppercase, lowercase, numbers, and special characters.' });
  }
  
  try {
    const found = await findUserByIdentifier(identifier);
    if (!found) return res.status(400).json({ success: false, message: 'Invalid request' });
    
    const email = found.userObj.email.toLowerCase();
    const otpRef = doc(db, 'otps', email);
    const otpDoc = await getDoc(otpRef);
    
    if (!otpDoc.exists()) {
      return res.status(400).json({ success: false, message: 'OTP expired or not found' });
    }
    
    const data = otpDoc.data();
    if (data.type !== 'RESET' || data.expiresAt < Date.now()) {
      await deleteDoc(otpRef);
      return res.status(400).json({ success: false, message: 'Verified session expired' });
    }
    
    if (!data.used) {
      return res.status(400).json({ success: false, message: 'Session not verified' });
    }
    
    if (String(data.otp).trim() !== String(otp).trim()) {
      await logSecurityEvent(found.userObj, 'Password Reset OTP Failed', 'FAILURE', reqDetails);
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    
    // Valid OTP - Reset Password
    const hashed = await hashPassword(newPassword);
    await setDoc(found.ref, { password: hashed, updatedAt: new Date().toISOString() }, { merge: true });
    await deleteDoc(otpRef);
    
    logSecurityEvent(found.userObj, 'Password Reset', 'SUCCESS', reqDetails).catch(err => console.error(err));
    
    sendEmail(
      found.userObj.email,
      'Password Successfully Reset - Event Management & IQAC Portal',
      emailTemplates.passwordResetSuccessTemplate(found.userObj, reqDetails.date, reqDetails.time)
    ).catch(err => console.error(err));
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ==========================================
// Change Password Flow (Authenticated)
// ==========================================

router.post('/change-password/request', requireAuth, async (req, res) => {
  const { currentPassword } = req.body;
  const email = req.user.email;
  const reqDetails = getRequestDetails(req);
  
  try {
    const found = await findAuthenticatedUser(req.user);
    if (!found) return res.status(404).json({ success: false, message: 'User not found' });
    
    const isMatch = await verifyPassword(currentPassword, found.storedPassword);
    if (!isMatch) {
      await logSecurityEvent(found.userObj, 'Change Password Request Failed', 'FAILURE', reqDetails);
      return res.status(401).json({ success: false, message: 'Invalid current password' });
    }
    
    const otpRef = doc(db, 'otps', email.toLowerCase());
    const otpDoc = await getDoc(otpRef);
    let attempts = 0;
    if (otpDoc.exists()) {
      const data = otpDoc.data();
      if (data.attempts >= 5 && data.expiresAt > Date.now()) {
        await logSecurityEvent(found.userObj, 'Maximum OTP Attempts Reached', 'FAILURE', reqDetails);
        return res.status(429).json({ success: false, message: 'Too many OTP requests. Please try again later.' });
      }
      attempts = data.attempts || 0;
    }
    
    const otp = generateOtp();
    await setDoc(otpRef, {
      otp,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1 * 60 * 1000,
      attempts: 0,
      maxAttempts: 5,
      used: false,
      type: 'CHANGE'
    });
    
    logSecurityEvent(found.userObj, 'Password Change OTP Requested', 'SUCCESS', reqDetails).catch(err => console.error(err));
    
    sendEmail(
      found.userObj.email,
      'Password Change Verification - Event Management & IQAC Portal',
      emailTemplates.passwordChangeOtpTemplate(found.userObj, otp)
    ).catch(err => console.error(err));
    
    res.json({ success: true, message: 'OTP sent to your email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/change-password/verify', requireAuth, async (req, res) => {
  const { otp, newPassword } = req.body;
  const email = req.user.email;
  const reqDetails = getRequestDetails(req);

  if (!validateStrongPassword(newPassword)) {
    return res.status(400).json({ success: false, message: 'Password must be at least 7 characters long, containing uppercase, lowercase, numbers, and special characters.' });
  }
  
  try {
    const found = await findAuthenticatedUser(req.user);
    if (!found) return res.status(404).json({ success: false, message: 'User not found' });
    
    const otpRef = doc(db, 'otps', email.toLowerCase());
    const otpDoc = await getDoc(otpRef);
    
    if (!otpDoc.exists()) return res.status(400).json({ success: false, message: 'OTP expired or not found' });
    
    const data = otpDoc.data();
    if (data.type !== 'CHANGE' || data.expiresAt < Date.now()) {
      await deleteDoc(otpRef);
      return res.status(400).json({ success: false, message: 'Verified session expired' });
    }
    
    if (!data.used) {
      return res.status(400).json({ success: false, message: 'Session not verified' });
    }
    
    if (String(data.otp).trim() !== String(otp).trim()) {
      await logSecurityEvent(found.userObj, 'Password Change OTP Failed', 'FAILURE', reqDetails);
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    
    const hashed = await hashPassword(newPassword);
    await setDoc(found.ref, { password: hashed, updatedAt: new Date().toISOString() }, { merge: true });
    await deleteDoc(otpRef);
    
    logSecurityEvent(found.userObj, 'Password Changed', 'SUCCESS', reqDetails).catch(err => console.error(err));
    
    sendEmail(
      found.userObj.email,
      'Password Successfully Changed - Event Management & IQAC Portal',
      emailTemplates.passwordChangeSuccessTemplate(found.userObj, reqDetails.date, reqDetails.time)
    ).catch(err => console.error(err));
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ==========================================
// User History and Logs (Authenticated)
// ==========================================

router.get('/login-history', requireAuth, async (req, res) => {
  try {
    const email = req.user.email.toLowerCase();
    
    // Support legacy frontend format by querying the new auditLogs
    const q = query(collection(db, 'auditLogs'), where('actor.email', '==', email), where('category', '==', 'AUTH'));
    const snapshot = await getDocs(q);
    
    let logs = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        // Legacy mapping
        email: data.actor?.email,
        timestamp: data.timestamp,
        browser: data.userAgent ? data.userAgent.split('-')[1]?.trim() : 'Unknown',
        os: data.userAgent ? data.userAgent.split('-')[0]?.trim() : 'Unknown',
        ip: data.ipAddress,
        status: data.status,
        activity: data.action,
        count: 1
      };
    });
    
    // Since Firebase doesn't allow orderby with equality unless indexed, we sort in memory for now
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, logs: logs.slice(0, 10) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

router.get('/activity-timeline', requireAuth, async (req, res) => {
  try {
    const email = req.user.email.toLowerCase();
    const limitCount = req.query.limit ? parseInt(req.query.limit) : 100;
    
    // Support legacy frontend format by querying the new activityLogs
    const q = query(collection(db, 'activityLogs'), where('actor.userId', '==', email));
    const snapshot = await getDocs(q);
    
    // We also need to get auditLogs that aren't AUTH for full timeline? 
    // Wait, old securityLogs had "email" directly on the root.
    const auditQ = query(collection(db, 'auditLogs'), where('actor.email', '==', email));
    const auditSnapshot = await getDocs(auditQ);
    
    const allLogs = [];
    
    snapshot.docs.forEach(d => {
      const data = d.data();
      allLogs.push({
        id: d.id,
        email: data.actor?.userId,
        timestamp: data.timestamp,
        activity: data.action,
        status: data.status,
        ip: data.ipAddress || '',
        count: 1
      });
    });
    
    auditSnapshot.docs.forEach(d => {
      const data = d.data();
      allLogs.push({
        id: d.id,
        email: data.actor?.email,
        timestamp: data.timestamp,
        activity: data.action,
        status: data.status,
        ip: data.ipAddress || '',
        count: 1
      });
    });
    
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ success: true, logs: allLogs.slice(0, limitCount) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

// ==========================================
// IQAC Audit (Admin Only)
// ==========================================

router.get('/iqac-audit', requireAuth, async (req, res) => {
  if (req.user.role !== 'IQAC_TEAM' && req.user.role !== 'PRINCIPAL' && req.user.role !== 'HOD') {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  try {
    // Return combined logins + audits
    const snapshot = await getDocs(collection(db, 'auditLogs'));
    const logs = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.actor?.userId,
        name: data.actor?.name,
        role: data.actor?.role,
        department: data.details?.department,
        rollNo: data.details?.rollNo,
        email: data.actor?.email,
        timestamp: data.timestamp,
        browser: data.userAgent ? data.userAgent.split('-')[1]?.trim() : 'Unknown',
        os: data.userAgent ? data.userAgent.split('-')[0]?.trim() : 'Unknown',
        ip: data.ipAddress,
        status: data.status
      };
    });
    
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
