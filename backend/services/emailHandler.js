/**
 * emailHandler.js
 * ──────────────────────────────────────────────────────────────────
 * CENTRALIZED EMAIL HANDLER for the Event Management System.
 *
 * RULES:
 *  - Organizer ALWAYS gets notified on every status change.
 *  - Next approver(s) ALWAYS get notified.
 *  - Every send is individually try/caught and logged.
 *  - No silent failures — every success and error is logged.
 *  - Recipient email is validated before sending.
 * ──────────────────────────────────────────────────────────────────
 */

'use strict';

const normalizeRollNo = (value) =>
  String(value || '')
    .trim()
    .replace(/^student_/i, '')
    .toUpperCase();

const { collection, getDocs, query, where } = require('../firebaseClientWrapper');

const {
  sendEventNotificationToFaculty,
  sendEventStatusNotification,
  sendEventCreationNotification,
  sendApprovalRequestToRole,
  sendPosterRequestEmail,
  sendStudentRegistrationStatusEmail,
  sendPostEventFeedbackEmail,
  sendIQACSubmissionRequestEmail,
  sendIQACExtensionRequestEmail,
  sendIQACExtensionStatusEmail,
} = require('./emailService');

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an email address before sending.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Safely send one email. Logs success/failure. Never throws.
 * @param {string} label       – human-readable description for logging
 * @param {string} recipient   – email address
 * @param {Function} sendFn    – async function that sends the email
 */
async function safeSend(label, recipient, sendFn) {
  if (!isValidEmail(recipient)) {
    console.warn('[EMAIL_SKIP] ' + label + ' — invalid/missing recipient: ' + recipient);
    return;
  }
  try {
    await sendFn();
    console.log('[EMAIL_SENT] ' + label + ' → ' + recipient);
  } catch (err) {
    console.error('[EMAIL_FAIL] ' + label + ' → ' + recipient + ' | Error: ' + err.message);
  }
}

/**
 * Centralized helper to execute any notification function in the background
 * without blocking the HTTP response, while trapping both synchronous and
 * asynchronous exceptions.
 *
 * @param {string} label - A human-readable identifier for logging
 * @param {Function} notifyFn - A function that returns a Promise
 */
function executeBackgroundNotification(label, notifyFn) {
  Promise.resolve()
    .then(() => notifyFn())
    .catch(err => {
      console.error(`[BACKGROUND_EMAIL_FAIL] ${label}`, err);
    });
}

/**
 * Fetch all emails for a given Firestore role.
 * @param {string} role
 * @returns {Promise<string[]>}
 */
async function getEmailsByRole(role, dept = null) {
  if (!role || !db) return [];
  try {
    let q = query(collection(db, 'users'), where('role', '==', role));
    if (dept) q = query(q, where('department', '==', dept));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data().email).filter(isValidEmail);
  } catch (err) {
    console.warn('[EMAIL_HANDLER] Failed to fetch emails for role ' + role + (dept ? ' and dept ' + dept : '') + ': ' + err.message);
    return [];
  }
}

/**
 * Send to all members of a role in parallel.
 */
async function notifyRole(role, eventData, dept = null) {
  const emails = await getEmailsByRole(role, dept);
  if (emails.length === 0) {
    console.warn('[EMAIL_HANDLER] No emails found for role: ' + role + (dept ? ' in dept: ' + dept : ''));
    return;
  }
  await Promise.allSettled(
    emails.map(email =>
      safeSend('Approval request [' + role + ']', email, () =>
        sendApprovalRequestToRole(eventData, email, role)
      )
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: handleEventStatusChange
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Central email dispatcher — call this every time an event status changes.
 *
 * @param {Object} eventData      – Full event document (must include id, title, organizerEmail, etc.)
 * @param {string} previousStatus – Status BEFORE the change (e.g. 'PENDING_HOD')
 * @param {string} newStatus      – Status AFTER the change  (e.g. 'PENDING_DEPARTMENTS')
 */
async function handleEventStatusChange(eventData, previousStatus, newStatus) {
  const eventId = eventData.id || '(unknown)';

  console.log(
    '\n[EMAIL_TRIGGER] ─────────────────────────────────────────\n' +
    '  Event   : ' + eventId + ' — ' + (eventData.title || '(no title)') + '\n' +
    '  Organizer: ' + (eventData.organizerEmail || '(none)') + '\n' +
    '  Transition: ' + previousStatus + ' → ' + newStatus + '\n' +
    '──────────────────────────────────────────────────────────'
  );

  // ── Always notify organizer on any status change ─────────
  if (isValidEmail(eventData.organizerEmail)) {
    if (previousStatus === null) {
      // It's a new event creation
      await safeSend(
        'Event creation confirmation to organizer',
        eventData.organizerEmail,
        () => sendEventCreationNotification(eventData.organizerEmail, eventData)
      );
    } else if (newStatus !== 'PENDING_FACULTY') {
      await safeSend(
        'Status update to organizer [' + newStatus + ']',
        eventData.organizerEmail,
        () => sendEventStatusNotification(eventData.organizerEmail, eventData, newStatus)
      );
    }
  }

  // ── Per-transition logic ───────────────────────────────────────────────────

  // EVENT CREATED → notify Faculty
  if (newStatus === 'PENDING_FACULTY') {
    let facultyEmail = eventData.coordinator?.facultyEmail ||
                         eventData.coordinator?.faculty_email ||
                         eventData.facultyEmail || null;
    
    const eventDept = eventData.department || eventData.organizerDept || null;

    if (!isValidEmail(facultyEmail) && eventDept) {
      const deptFaculty = await getEmailsByRole('FACULTY', eventDept);
      if (deptFaculty.length > 0) facultyEmail = deptFaculty[0]; // Take first as primary
    }

    await safeSend(
      'New event notification to Faculty',
      facultyEmail,
      () => sendEventNotificationToFaculty(eventData, facultyEmail)
    );
    return;
  }

  // EVENT CREATED (student-created, goes direct to PENDING_HOD) or FACULTY APPROVED → notify HOD
  if (newStatus === 'PENDING_HOD') {
    const eventDept = eventData.department || eventData.organizerDept || null;
    await notifyRole('HOD', eventData, eventDept);

    // Poster: if HOD is the first approver and poster was requested, notify media now
    if (previousStatus === 'PENDING_FACULTY' && eventData.posterWorkflow?.requested && eventData.posterStatus !== 'UPLOADED') {
      await _notifyMediaForPoster(eventData);
    }
    return;
  }

  // HOD APPROVED → PENDING_DEPARTMENTS or PENDING_IQAC
  if (previousStatus === 'PENDING_HOD' &&
      (newStatus === 'PENDING_DEPARTMENTS' || newStatus === 'PENDING_IQAC')) {

    // Notify media team for poster if requested and not already uploaded
    if (eventData.posterWorkflow?.requested && eventData.posterStatus !== 'UPLOADED') {
      await _notifyMediaForPoster(eventData);
    }

    if (newStatus === 'PENDING_DEPARTMENTS') {
      await _notifyRequiredDepartments(eventData);
    } else {
      // Auto-advanced past departments → go straight to IQAC
      await notifyRole('IQAC_TEAM', eventData);
    }
    return;
  }

  // DEPARTMENT APPROVED (Intermediate)
  if (newStatus === 'DEPARTMENT_APPROVED') {
    // Organizer is already notified by the top block.
    return;
  }

  // ALL DEPARTMENTS APPROVED → notify IQAC
  if (newStatus === 'PENDING_IQAC' && (previousStatus === 'PENDING_DEPARTMENTS' || previousStatus === 'DEPARTMENT_APPROVED')) {
    await notifyRole('IQAC_TEAM', eventData);
    return;
  }

  // IQAC APPROVED → POSTED
  if (newStatus === 'POSTED') {
    // Organizer already notified above — nothing extra needed here
    return;
  }

  // EVENT COMPLETED → notify organizer for IQAC report + students for feedback
  if (newStatus === 'COMPLETED') {
    await safeSend(
      'IQAC submission request to organizer',
      eventData.organizerEmail,
      () => sendIQACSubmissionRequestEmail(eventData.organizerEmail, eventData)
    );
    await _sendFeedbackToStudents(eventData);
    return;
  }

  // REJECTED at any stage
  if (newStatus === 'REJECTED') {
    // Organizer already notified via the generic notifier at the top
    return;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private sub-handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify the Media team to create a poster for this event.
 */
async function _notifyMediaForPoster(eventData) {
  const mediaEmails = await getEmailsByRole('MEDIA');
  if (mediaEmails.length === 0) {
    console.warn('[EMAIL_HANDLER] No MEDIA emails found for poster request.');
    return;
  }
  await Promise.allSettled(
    mediaEmails.map(email =>
      safeSend('Poster request to Media', email, () => sendPosterRequestEmail(eventData, email))
    )
  );
}

/**
 * Notify all required department teams based on event logistics.
 */
async function _notifyRequiredDepartments(eventData) {
  const reqs = eventData.requisition?.step1?.requirements || {};
  const isRequired = (k) => reqs[k] ?? eventData[k] ?? false;

  const rolesToNotify = [];
  if (isRequired('venueRequired'))     rolesToNotify.push('HR_TEAM');        // venue via HR
  if (isRequired('audioRequired'))     rolesToNotify.push('AUDIO_TEAM');
  if (isRequired('ictsRequired'))      rolesToNotify.push('SYSTEM_ADMIN');
  if (isRequired('transportRequired')) rolesToNotify.push('TRANSPORT_TEAM');
  if (isRequired('mediaRequired'))     rolesToNotify.push('MEDIA');

  // Accommodation → warden(s)
  if (isRequired('accommodationDiningRequired') || isRequired('accommodationRequired')) {
    const accom = eventData.requisition?.annexureV_accommodation || {};
    const males   = Number(accom.maleGuests   || 0);
    const females = Number(accom.femaleGuests  || 0);
    if (males   > 0) rolesToNotify.push('BOYS_WARDEN');
    if (females > 0) rolesToNotify.push('GIRLS_WARDEN');
    if (males === 0 && females === 0) rolesToNotify.push('BOYS_WARDEN'); // fallback
  }

  if (rolesToNotify.length === 0) {
    console.log('[EMAIL_HANDLER] No department teams required for event ' + (eventData.id || ''));
    return;
  }

  console.log('[EMAIL_HANDLER] Notifying departments: ' + rolesToNotify.join(', '));
  for (const role of rolesToNotify) {
    await notifyRole(role, eventData);
  }
}

/**
 * Send post-event feedback emails to all approved students.
 */
async function _sendFeedbackToStudents(eventData) {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, 'odRequests'));
    const approved = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.eventId === eventData.id && r.status === 'APPROVED' && isValidEmail(r.email));

    if (approved.length === 0) {
      console.log('[EMAIL_HANDLER] No approved students found for feedback: ' + (eventData.id || ''));
      return;
    }

    const feedbackLink = (process.env.FRONTEND_URL || 'http://localhost:5173') + '/dashboard';
    await Promise.allSettled(
      approved.map(student =>
        safeSend(
          'Post-event feedback to student ' + (student.studentName || student.email),
          student.email,
          () => sendPostEventFeedbackEmail(
            student.email, 
            { name: student.studentName, rollNo: normalizeRollNo(student.rollNo || student.id), department: student.department || student.class }, 
            eventData, 
            feedbackLink
          )
        )
      )
    );
  } catch (err) {
    console.error('[EMAIL_HANDLER] Failed to send feedback emails: ' + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OD / Registration email handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handle student OD registration status change.
 *
 * @param {Object} odRequest   – OD request document data
 * @param {string} newStatus   – 'APPROVED' | 'REJECTED'
 * @param {string|null} odLetterBase64 – Base64 PDF data if approved
 */
async function handleODStatusChange(odRequest, newStatus, odLetterBase64 = null) {
  const studentEmail = odRequest.email;
  const studentInfo  = {
    name: odRequest.studentName || 'Student',
    rollNo: normalizeRollNo(odRequest.rollNo || odRequest.studentId),
    department: odRequest.department || odRequest.class || 'N/A'
  };
  const eventData    = {
    id:    odRequest.eventId,
    title: odRequest.eventTitle || 'Event',
  };

  console.log(
    '\n[EMAIL_TRIGGER] OD Status ─────────────────────────────────\n' +
    '  OD ID   : ' + (odRequest.id || '(unknown)') + '\n' +
    '  Student : ' + studentInfo.name + ' <' + studentEmail + '>\n' +
    '  Event   : ' + eventData.title + '\n' +
    '  Status  : → ' + newStatus + '\n' +
    '  OD PDF  : ' + (odLetterBase64 ? 'YES (attached)' : 'NO') + '\n' +
    '──────────────────────────────────────────────────────────'
  );

  await safeSend(
    'OD registration ' + newStatus + ' to student',
    studentEmail,
    () => sendStudentRegistrationStatusEmail(
      studentEmail,
      studentInfo,
      eventData,
      newStatus,
      newStatus === 'APPROVED' ? odLetterBase64 : null
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IQAC extension handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notify all HODs that an organizer has requested an IQAC extension.
 */
async function handleIQACExtensionRequest(eventData, reason) {
  console.log('[EMAIL_TRIGGER] IQAC extension requested — Event: ' + (eventData.id || ''));
  const hodEmails = await getEmailsByRole('HOD');
  await Promise.allSettled(
    hodEmails.map(email =>
      safeSend('IQAC extension request to HOD', email, () =>
        sendIQACExtensionRequestEmail(email, eventData, reason)
      )
    )
  );
}

/**
 * Notify organizer of HOD's decision on IQAC extension.
 */
async function handleIQACExtensionDecision(eventData, isApproved) {
  const label = isApproved ? 'APPROVED' : 'REJECTED';
  console.log('[EMAIL_TRIGGER] IQAC extension ' + label + ' — Event: ' + (eventData.id || ''));
  await safeSend(
    'IQAC extension ' + label + ' to organizer',
    eventData.organizerEmail,
    () => sendIQACExtensionStatusEmail(eventData.organizerEmail, eventData, isApproved)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Emergency Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleEventCancelled(eventData) {
  const eventId = eventData.id || '(unknown)';
  console.log('[EMAIL_TRIGGER] Event CANCELLED: ' + eventId);

  // 1. Fetch only APPROVED students
  const studentMap = new Map();
  try {
    const snap = await getDocs(query(collection(db, 'odRequests'), where('eventId', '==', eventId), where('status', '==', 'APPROVED')));
    snap.docs.forEach(d => {
      const student = d.data();
      if (isValidEmail(student.email)) {
        studentMap.set(student.email, {
          email: student.email,
          name: student.studentName || 'Student',
          rollNo: normalizeRollNo(student.rollNo || student.studentId),
          department: student.department || student.class || 'N/A'
        });
      }
    });
  } catch (err) {
    console.warn('[EMAIL_HANDLER] Could not fetch OD requests for cancellation emails', err.message);
  }

  const { sendEmail } = require('./emailService');
  const subject = `Event Cancellation Notice – ${eventData.title}`;
  
  const organizerName = eventData.organizerName || 'Organizer';
  const eventDept = eventData.department || 'GEN';
  const originalDate = eventData.requisition?.step1?.eventStartDate || eventData.date || 'N/A';
  const originalTime = eventData.requisition?.step1?.eventStartTime || eventData.startTime || 'N/A';
  const venue = (eventData.venue && !['n/a','na','null','undefined','tba','to be allocated','not specified','not available','nil','—','-',''].includes(String(eventData.venue).toLowerCase().trim())) ? eventData.venue : 'No Venue Assigned';
  const reason = eventData.cancellationReason || 'No reason provided';
  const referenceId = eventData.referenceId || 'N/A';

  // Send personalized emails to students
  const studentPromises = Array.from(studentMap.values()).map(student => {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #dc2626;">Event Cancellation Notice</h2>
        <p>Dear ${student.name},</p>
        <p>The event <strong>${eventData.title}</strong> has been officially cancelled after the institutional approval process.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Student Name</td><td style="padding: 8px; border: 1px solid #ddd;">${student.name}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Roll Number</td><td style="padding: 8px; border: 1px solid #ddd;">${student.rollNo}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Event Name</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.title}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Event Reference</td><td style="padding: 8px; border: 1px solid #ddd;">${referenceId}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Original Event Date</td><td style="padding: 8px; border: 1px solid #ddd;">${originalDate}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Original Event Time</td><td style="padding: 8px; border: 1px solid #ddd;">${originalTime}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Venue</td><td style="padding: 8px; border: 1px solid #ddd;">${venue}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Cancellation Reason</td><td style="padding: 8px; border: 1px solid #ddd;">${reason}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Organizer Name</td><td style="padding: 8px; border: 1px solid #ddd;">${organizerName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Department</td><td style="padding: 8px; border: 1px solid #ddd;">${eventDept}</td></tr>
        </table>
        <p style="margin-top: 20px; font-size: 0.9em; color: #666;">This is an automated email from the Event Management System.</p>
      </div>
    `;
    return safeSend('Cancellation Notice to student ' + student.email, student.email, () => sendEmail(student.email, subject, html));
  });

  await Promise.allSettled(studentPromises);

  // 2. Notify Staff (Organizer, HOD, IQAC, etc)
  const staffEmails = new Set();
  if (isValidEmail(eventData.organizerEmail)) staffEmails.add(eventData.organizerEmail);
  const facultyEmail = eventData.coordinator?.facultyEmail || eventData.facultyEmail;
  if (isValidEmail(facultyEmail)) staffEmails.add(facultyEmail);

  const rolesToNotify = ['FACULTY', 'HOD', 'IQAC_TEAM'];
  const reqs = eventData.requisition?.step1?.requirements || {};
  const isRequired = (k) => reqs[k] ?? eventData[k] ?? false;
  
  if (isRequired('venueRequired'))     rolesToNotify.push('HR_TEAM');
  if (isRequired('audioRequired'))     rolesToNotify.push('AUDIO_TEAM');
  if (isRequired('ictsRequired'))      rolesToNotify.push('SYSTEM_ADMIN');
  if (isRequired('transportRequired')) rolesToNotify.push('TRANSPORT_TEAM');
  if (isRequired('mediaRequired'))     rolesToNotify.push('MEDIA');
  if (isRequired('accommodationDiningRequired') || isRequired('accommodationRequired')) {
    const accom = eventData.requisition?.annexureV_accommodation || {};
    const males   = Number(accom.maleGuests   || 0);
    const females = Number(accom.femaleGuests  || 0);
    if (males > 0) rolesToNotify.push('BOYS_WARDEN');
    if (females > 0) rolesToNotify.push('GIRLS_WARDEN');
    if (males === 0 && females === 0) rolesToNotify.push('BOYS_WARDEN');
  }

  for (const role of rolesToNotify) {
    const roleEmails = await getEmailsByRole(role);
    roleEmails.forEach(e => staffEmails.add(e));
  }

  const genericHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #dc2626;">Event Cancelled</h2>
      <p>The following event has been permanently cancelled.</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Event Name</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.title}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Event Reference ID</td><td style="padding: 8px; border: 1px solid #ddd;">${referenceId}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Cancelled By</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.cancelledBy || 'Organizer'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reason</td><td style="padding: 8px; border: 1px solid #ddd;">${reason}</td></tr>
      </table>
      <p style="margin-top: 20px; font-size: 0.9em; color: #666;">This is an automated email from the Event Management System.</p>
    </div>
  `;
  
  await Promise.allSettled(Array.from(staffEmails).map(email => 
    safeSend('Cancellation Notice to staff ' + email, email, () => sendEmail(email, subject, genericHtml))
  ));
}

async function handleEventPostponed(eventData) {
  const eventId = eventData.id || '(unknown)';
  console.log('[EMAIL_TRIGGER] Event POSTPONED: ' + eventId);

  // 1. Fetch only APPROVED students
  const studentMap = new Map();
  try {
    const snap = await getDocs(query(collection(db, 'odRequests'), where('eventId', '==', eventId), where('status', '==', 'APPROVED')));
    snap.docs.forEach(d => {
      const student = d.data();
      if (isValidEmail(student.email)) {
        studentMap.set(student.email, {
          email: student.email,
          name: student.studentName || 'Student',
          rollNo: normalizeRollNo(student.rollNo || student.studentId),
          department: student.department || student.class || 'N/A'
        });
      }
    });
  } catch (err) {
    console.warn('[EMAIL_HANDLER] Could not fetch OD requests for postponement emails', err.message);
  }

  const { sendEmail } = require('./emailService');
  const subject = `Event Postponement Notice – ${eventData.title}`;
  
  const organizerName = eventData.organizerName || 'Organizer';
  const eventDept = eventData.department || 'GEN';
  const venue = (eventData.venue && !['n/a','na','null','undefined','tba','to be allocated','not specified','not available','nil','—','-',''].includes(String(eventData.venue).toLowerCase().trim())) ? eventData.venue : 'No Venue Assigned';
  const reason = eventData.postponementReason || 'No reason provided';
  const referenceId = eventData.referenceId || 'N/A';

  // Send personalized emails to students
  const studentPromises = Array.from(studentMap.values()).map(student => {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #d97706;">Event Postponement Notice</h2>
        <p>Dear ${student.name},</p>
        <p>The event <strong>${eventData.title}</strong> has been postponed. Previous attendance records have been cleared. Attendance will be recorded again on the new event date.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Student Name</td><td style="padding: 8px; border: 1px solid #ddd;">${student.name}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Roll Number</td><td style="padding: 8px; border: 1px solid #ddd;">${student.rollNo}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Event Name</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.title}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Event Reference</td><td style="padding: 8px; border: 1px solid #ddd;">${referenceId}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Previous Event Date</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.oldDate || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Previous Start Time</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.oldStartTime || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Previous End Time</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.oldEndTime || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">New Event Date</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.newDate || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">New Start Time</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.newStartTime || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">New End Time</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.newEndTime || 'N/A'}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Venue (Latest)</td><td style="padding: 8px; border: 1px solid #ddd;">${venue}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Postponement Reason</td><td style="padding: 8px; border: 1px solid #ddd;">${reason}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Organizer Name</td><td style="padding: 8px; border: 1px solid #ddd;">${organizerName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Department</td><td style="padding: 8px; border: 1px solid #ddd;">${eventDept}</td></tr>
        </table>
        <p style="margin-top: 20px; font-weight: bold;">Note: Your registration and OD permission (if applicable) remain valid for the new date. No further action is required.</p>
        <p style="margin-top: 20px; font-size: 0.9em; color: #666;">This is an automated email from the Event Management System.</p>
      </div>
    `;
    return safeSend('Postponement Notice to student ' + student.email, student.email, () => sendEmail(student.email, subject, html));
  });

  await Promise.allSettled(studentPromises);

  // 2. Notify Staff (Organizer, HOD, IQAC, etc)
  const staffEmails = new Set();
  if (isValidEmail(eventData.organizerEmail)) staffEmails.add(eventData.organizerEmail);
  const facultyEmail = eventData.coordinator?.facultyEmail || eventData.facultyEmail;
  if (isValidEmail(facultyEmail)) staffEmails.add(facultyEmail);

  const rolesToNotify = ['FACULTY', 'HOD', 'IQAC_TEAM'];
  const reqs = eventData.requisition?.step1?.requirements || {};
  const isRequired = (k) => reqs[k] ?? eventData[k] ?? false;
  
  if (isRequired('venueRequired'))     rolesToNotify.push('HR_TEAM');
  if (isRequired('audioRequired'))     rolesToNotify.push('AUDIO_TEAM');
  if (isRequired('ictsRequired'))      rolesToNotify.push('SYSTEM_ADMIN');
  if (isRequired('transportRequired')) rolesToNotify.push('TRANSPORT_TEAM');
  if (isRequired('mediaRequired'))     rolesToNotify.push('MEDIA');
  if (isRequired('accommodationDiningRequired') || isRequired('accommodationRequired')) {
    const accom = eventData.requisition?.annexureV_accommodation || {};
    const males   = Number(accom.maleGuests   || 0);
    const females = Number(accom.femaleGuests  || 0);
    if (males > 0) rolesToNotify.push('BOYS_WARDEN');
    if (females > 0) rolesToNotify.push('GIRLS_WARDEN');
    if (males === 0 && females === 0) rolesToNotify.push('BOYS_WARDEN');
  }

  for (const role of rolesToNotify) {
    const roleEmails = await getEmailsByRole(role);
    roleEmails.forEach(e => staffEmails.add(e));
  }

  const genericHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #d97706;">Event Postponed</h2>
      <p>The following event has been officially postponed.</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Event Name</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.title}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Old Date</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.oldDate || 'N/A'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">New Date</td><td style="padding: 8px; border: 1px solid #ddd;">${eventData.newDate || 'N/A'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reason</td><td style="padding: 8px; border: 1px solid #ddd;">${reason}</td></tr>
      </table>
      <p style="margin-top: 20px; font-size: 0.9em; color: #666;">This is an automated email from the Event Management System.</p>
    </div>
  `;
  
  await Promise.allSettled(Array.from(staffEmails).map(email => 
    safeSend('Postponement Notice to staff ' + email, email, () => sendEmail(email, subject, genericHtml))
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  handleEventStatusChange,
  handleODStatusChange,
  handleIQACExtensionRequest,
  handleIQACExtensionDecision,
  handleEventCancelled,
  handleEventPostponed,
  isValidEmail,
  getEmailsByRole,
  executeBackgroundNotification,
};
