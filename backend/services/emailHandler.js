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

const { collection, getDocs, query, where } = require('firebase/firestore');
const { db } = require('../firebase');
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
          () => sendPostEventFeedbackEmail(student.email, student.studentName, eventData, feedbackLink)
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
  const studentName  = odRequest.studentName || 'Student';
  const eventData    = {
    id:    odRequest.eventId,
    title: odRequest.eventTitle || 'Event',
  };

  console.log(
    '\n[EMAIL_TRIGGER] OD Status ─────────────────────────────────\n' +
    '  OD ID   : ' + (odRequest.id || '(unknown)') + '\n' +
    '  Student : ' + studentName + ' <' + studentEmail + '>\n' +
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
      studentName,
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
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  handleEventStatusChange,
  handleODStatusChange,
  handleIQACExtensionRequest,
  handleIQACExtensionDecision,
  isValidEmail,
  getEmailsByRole,
};
