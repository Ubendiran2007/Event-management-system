const nodemailer = require('nodemailer');
const templates = require('./emailTemplates');
const { db } = require('../firebase');
const { collection, addDoc } = require('firebase/firestore');

const RESEND_API_URL = 'https://api.resend.com/emails';

function getSenderAddress() {
  return process.env.RESEND_FROM_EMAIL || process.env.GMAIL_USER;
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY) && Boolean(getSenderAddress());
}

// Configure SMTP transporter with Gmail credentials
// dnsOptions family:4 forces IPv4 resolution to avoid ENETUNREACH on IPv6-only networks
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true' ? true : false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  dnsOptions: { family: 4 },
});

function createFallbackTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    dnsOptions: { family: 4 },
  });
}

function isNetworkSmtpError(error) {
  const msg = String(error?.message || '');
  const code = String(error?.code || '');
  return (
    /ETIMEDOUT|ECONNECTION|ESOCKET|ENOTFOUND|EHOSTUNREACH|ENETUNREACH/i.test(msg) ||
    /ETIMEDOUT|ECONNECTION|ESOCKET|ENOTFOUND|EHOSTUNREACH|ENETUNREACH/i.test(code)
  );
}

function isAuthSmtpError(error) {
  const code = String(error?.code || '');
  const responseCode = error?.responseCode;
  return code === 'EAUTH' || responseCode === 535 || responseCode === 530 || responseCode === 534;
}

async function logEmailAudit(mailOptions, status, errorMessage = '', smtpResponse = '') {
  try {
    if (!db) return;
    await addDoc(collection(db, 'emailLogs'), {
      recipient: Array.isArray(mailOptions.to) ? mailOptions.to.join(',') : mailOptions.to,
      // When test mode redirected the email, record who was the intended recipient
      originalRecipient: mailOptions._originalTo || null,
      testModeActive: process.env.EMAIL_TEST_MODE === 'true',
      subject: mailOptions.subject || '',
      status,
      timestamp: new Date().toISOString(),
      smtpResponse,
      errorMessage,
      emailType: mailOptions.emailType || 'GENERAL',
      eventId: mailOptions.eventId || null,
      eventTitle: mailOptions.eventTitle || null
    });
  } catch (err) {
    console.error('[Email Service] Failed to log email audit:', err.message);
  }
}

async function sendMailWithFallback(mailOptions) {
  // Deduplicate recipients
  if (Array.isArray(mailOptions.to)) {
    mailOptions.to = [...new Set(mailOptions.to)];
  } else if (typeof mailOptions.to === 'string') {
    mailOptions.to = [...new Set(mailOptions.to.split(',').map(e => e.trim()).filter(Boolean))].join(', ');
  }

  // ── Test Mode Email Redirection ──────────────────────────────────────────────
  // When EMAIL_TEST_MODE=true  → all emails are intercepted and sent to EMAIL_TEST_RECIPIENT
  // When EMAIL_TEST_MODE=false → emails are delivered to actual recipients (production mode)
  if (process.env.EMAIL_TEST_MODE === 'true') {
    const testRecipient = process.env.EMAIL_TEST_RECIPIENT || 'ubendirankumar@gmail.com';
    console.log(`[Email Service] ⚠️  TEST MODE: Redirecting email for "${mailOptions.to}" → ${testRecipient}`);
    mailOptions._originalTo = mailOptions.to; // preserve for audit log
    mailOptions.to = testRecipient;
  } else {
    console.log(`[Email Service] 📧 PRODUCTION: Sending email to "${mailOptions.to}"`);
  }


  const useResendOnly = String(process.env.EMAIL_PROVIDER || '').toLowerCase() === 'resend';

  if (useResendOnly) {
    try {
      const res = await sendMailViaResend(mailOptions);
      await logEmailAudit(mailOptions, 'SUCCESS', '', 'Resend API');
      return res;
    } catch (err) {
      await logEmailAudit(mailOptions, 'FAILED', err.message);
      throw err;
    }
  }

  try {
    const res = await transporter.sendMail(mailOptions);
    await logEmailAudit(mailOptions, 'SUCCESS', '', res.response);
    return res;
  } catch (primaryError) {
    // Auth failures (bad credentials) should NOT retry SSL — credentials will fail
    // there too. Skip straight to Resend or throw.
    if (isAuthSmtpError(primaryError)) {
      console.error('[Email Service] SMTP authentication failed — credentials may be invalid or revoked. Check GMAIL_APP_PASSWORD in .env');
      if (hasResendConfig()) {
        console.warn('[Email Service] Falling back to Resend API...');
        try {
          const res = await sendMailViaResend(mailOptions);
          await logEmailAudit(mailOptions, 'SUCCESS', '', 'Resend API (Fallback)');
          return res;
        } catch (err) {
          await logEmailAudit(mailOptions, 'FAILED', err.message);
          throw err;
        }
      }
      await logEmailAudit(mailOptions, 'FAILED', primaryError.message);
      throw primaryError;
    }

    // Non-network, non-auth errors (e.g. message rejected) → try Resend directly
    if (!isNetworkSmtpError(primaryError)) {
      if (hasResendConfig()) {
        console.warn('[Email Service] SMTP send failed, trying HTTPS provider fallback:', primaryError.message);
        try {
          const res = await sendMailViaResend(mailOptions);
          await logEmailAudit(mailOptions, 'SUCCESS', '', 'Resend API (Fallback)');
          return res;
        } catch (err) {
          await logEmailAudit(mailOptions, 'FAILED', err.message);
          throw err;
        }
      }
      await logEmailAudit(mailOptions, 'FAILED', primaryError.message);
      throw primaryError;
    }

    // Network errors → retry on SSL port 465, then Resend
    console.warn('[Email Service] Primary SMTP send failed, trying SSL fallback (465):', primaryError.message);
    try {
      const fallbackTransporter = createFallbackTransporter();
      const res = await fallbackTransporter.sendMail(mailOptions);
      await logEmailAudit(mailOptions, 'SUCCESS', '', res.response);
      return res;
    } catch (fallbackError) {
      if (!hasResendConfig()) {
        await logEmailAudit(mailOptions, 'FAILED', fallbackError.message);
        throw fallbackError;
      }
      console.warn('[Email Service] SMTP SSL fallback failed, trying HTTPS provider fallback:', fallbackError.message);
      try {
        const res = await sendMailViaResend(mailOptions);
        await logEmailAudit(mailOptions, 'SUCCESS', '', 'Resend API (Fallback)');
        return res;
      } catch (err) {
        await logEmailAudit(mailOptions, 'FAILED', err.message);
        throw err;
      }
    }
  }
}

async function sendMailViaResend(mailOptions) {
  if (!hasResendConfig()) {
    throw new Error('Resend fallback is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.');
  }

  const payload = {
    from: getSenderAddress(),
    to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
    subject: mailOptions.subject,
    html: mailOptions.html,
    text: mailOptions.text,
  };

  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    payload.attachments = mailOptions.attachments.map(att => ({
      filename: att.filename,
      content: att.content // Resend expects base64 content here if it is base64 encoded
    }));
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(`Resend API failed: ${reason}`);
  }

  return { messageId: data?.id || 'resend-message' };
}

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error('[Email Service] SMTP connection failed:', error);
  } else {
    console.log('[Email Service] SMTP connection verified');
  }
});

function getEventReference(eventData = {}) {
  return (
    eventData.referenceId ||
    eventData.eventReference ||
    eventData.requisition?.iqacNumber ||
    eventData.iqacNumber ||
    eventData.referenceNumber ||
    eventData.eventCode ||
    (eventData.id ? `EVT-${String(eventData.id).slice(-6).toUpperCase()}` : 'Not assigned')
  );
}

async function sendPosterRequestEmail(eventData, mediaEmail) {
  if (!mediaEmail) return { success: false, message: 'Media email not provided' };
  try {
    const html = templates.posterRequestTemplate(eventData);
    const mailOptions = {
      from: getSenderAddress(),
      to: mediaEmail,
      subject: `Poster Request – Event: ${eventData.title}`,
      html,
      text: `Poster Request\n\nEvent: ${eventData.title}\nPlease design a poster for this event.\n\n---\nThis is an automated email.`
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Poster request email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send poster request email:', error);
    return { success: false, error: error.message };
  }
}

async function sendPosterReadyEmail(eventData, organizerEmail) {
  if (!organizerEmail) return { success: false, message: 'Organizer email not provided' };
  try {
    const html = templates.posterReadyTemplate(eventData);
    const mailOptions = {
      from: getSenderAddress(),
      to: organizerEmail,
      subject: `Poster Ready – Event: ${eventData.title}`,
      html,
      text: `Poster Ready\n\nEvent: ${eventData.title}\nYour poster is ready for review.\n\n---\nThis is an automated email.`
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Poster ready email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send poster ready email:', error);
    return { success: false, error: error.message };
  }
}

async function sendEventNotificationToFaculty(eventData, facultyEmail) {
  if (!facultyEmail) return { success: false, message: 'Faculty email not provided' };
  try {
    const html = templates.facultyNotificationTemplate(eventData);
    const mailOptions = {
      from: getSenderAddress(),
      to: facultyEmail,
      subject: `New Event Proposal – Requires Your Review: ${eventData.title}`,
      html,
      text: `New Event Proposal\n\nEvent: ${eventData.title}\nRequires your review.\n\n---\nThis is an automated email.`
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Event notification sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

async function sendApprovalRequestToRole(eventData, approverEmail, approverRole) {
  if (!approverEmail) return { success: false, message: 'Approver email not provided' };
  try {
    const roleLabel = String(approverRole || 'Approver').toUpperCase();
    const html = templates.approvalRequestTemplate(eventData, roleLabel);
    const mailOptions = {
      from: getSenderAddress(),
      to: approverEmail,
      subject: `Event Requires ${roleLabel} Approval – ${eventData.title}`,
      html,
      text: `Approval Required\n\nEvent: ${eventData.title}\nPending ${roleLabel} review.\n\n---\nThis is an automated email.`
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Approval request notification sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send approval request email:', error);
    return { success: false, error: error.message };
  }
}

async function sendEventStatusNotification(organizerEmail, eventData, status) {
  if (!organizerEmail) return { success: false, message: 'Organizer email not provided' };

  const statusMessages = {
    PENDING_HOD: { title: 'Event Approved by Faculty', message: 'Your event has been approved by the faculty and is now pending HOD approval.' },
    PENDING_PRINCIPAL: { title: 'Event Approved by HOD', message: 'Your event has been approved by the HOD and is now pending Principal approval.' },
    POSTED: { title: 'Event Approved', message: 'Your event has been approved and is now posted for student registration.' },
    REJECTED: { title: 'Event Rejected', message: 'Your event proposal has been rejected. Please review the feedback and resubmit.' },
    DEPARTMENT_APPROVED: { title: 'Department Approval Received', message: `The ${String(eventData?.lastApprovedDept || 'a').toUpperCase()} department has approved your event requisitions.` },
    PENDING_IQAC: { title: 'All Departments Approved', message: `Your event has received all required department approvals (Final approval by ${String(eventData?.lastApprovedDept || 'last department').toUpperCase()}) and is now pending IQAC review.` },
    IQAC_SUBMITTED: { title: 'IQAC Report Submitted', message: 'Your IQAC post-event report has been submitted successfully.' },
  };

  const statusInfo = statusMessages[status] || { title: 'Event Status Updated', message: 'Your event status has been updated.' };
  const rejectionReason = status === 'REJECTED' ? String(eventData?.rejectionReason || '').trim() : '';

  try {
    const html = templates.eventStatusTemplate(eventData, statusInfo, rejectionReason);
    const mailOptions = {
      from: getSenderAddress(),
      to: organizerEmail,
      subject: statusInfo.title,
      html,
      text: `${statusInfo.title}\n\nEvent: ${eventData.title}\n${statusInfo.message}\n${rejectionReason ? 'Reason: ' + rejectionReason : ''}\n\n---\nThis is an automated email.`
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Status notification sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

async function sendEventCreationNotification(organizerEmail, eventData) {
  if (!organizerEmail) return { success: false, message: 'Organizer email not provided' };

  try {
    const html = templates.eventCreationTemplate(eventData);
    const mailOptions = {
      from: getSenderAddress(),
      to: organizerEmail,
      subject: `Event Proposal Submitted: ${eventData.title}`,
      html,
      text: `Event Proposal Submitted\n\nEvent: ${eventData.title}\nYour event proposal has been successfully created and submitted.\n\n---\nThis is an automated email.`
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Event creation notification sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send event creation email:', error);
    return { success: false, error: error.message };
  }
}

async function sendStudentRegistrationStatusEmail(studentEmail, student, eventData, status, odLetterBase64) {
  if (!studentEmail) return { success: false, message: 'Student email not provided' };
  try {
    const isApproved = status === 'APPROVED';
    const html = templates.studentRegistrationTemplate(student, eventData, status, isApproved);
    
    const mailOptions = {
      from: getSenderAddress(),
      to: studentEmail,
      subject: isApproved ? 'Registration Approved - ' + eventData.title : 'Registration Update - ' + eventData.title,
      html,
      text: `Registration ${status}\n\nDear ${student.name},\nYour registration for "${eventData.title}" has been ${status.toLowerCase()}.\n---\nThis is an automated email.`,
    };

    if (isApproved && odLetterBase64) {
      mailOptions.attachments = [{
        filename: 'OD_Letter.pdf',
        content: odLetterBase64.split('base64,').pop(),
        encoding: 'base64',
        contentType: 'application/pdf',
      }];
    }

    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Registration status email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send registration email:', error);
    return { success: false, error: error.message };
  }
}

async function sendPostEventFeedbackEmail(studentEmail, student, eventData, feedbackLink) {
  if (!studentEmail) return { success: false };
  try {
    const html = templates.feedbackRequestTemplate(student, eventData, feedbackLink);
    const mailOptions = {
      from: getSenderAddress(),
      to: studentEmail,
      subject: 'Feedback Requested - ' + eventData.title,
      html,
      text: `Feedback Requested\n\nDear ${student.name},\nPlease submit your feedback here: ${feedbackLink}\n\n---\nThis is an automated email.`,
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Feedback request email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send feedback email:', error);
    return { success: false, error: error.message };
  }
}

async function sendIQACSubmissionRequestEmail(organizerEmail, eventData) {
  if (!organizerEmail) return { success: false };
  try {
    const html = templates.iqacSubmissionRequestTemplate(eventData);
    const mailOptions = {
      from: getSenderAddress(),
      to: organizerEmail,
      subject: 'Action Required: IQAC Submission for ' + eventData.title,
      html,
      text: `IQAC Report Submission Required\n\nThe event "${eventData.title}" has been completed. Please submit the IQAC Post-Event Report.\n\n---\nThis is an automated email.`,
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] IQAC submission request email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send IQAC submission email:', error);
    return { success: false, error: error.message };
  }
}

async function sendIQACReminderEmail(organizerEmail, eventData, deadlineDate) {
  if (!organizerEmail) return { success: false };
  try {
    const html = templates.iqacReminderTemplate(eventData, deadlineDate);
    const mailOptions = {
      from: getSenderAddress(),
      to: organizerEmail,
      subject: 'Reminder: Pending IQAC Submission for ' + eventData.title,
      html,
      text: `IQAC Submission Reminder\n\nThe IQAC Post-Event Report for "${eventData.title}" is due by ${deadlineDate}.\n\n---\nThis is an automated email.`,
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] IQAC reminder email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send IQAC reminder email:', error);
    return { success: false, error: error.message };
  }
}

async function sendIQACExtensionRequestEmail(hodEmail, eventData, reason) {
  if (!hodEmail) return { success: false };
  try {
    const html = templates.iqacExtensionRequestTemplate(eventData, reason);
    const mailOptions = {
      from: getSenderAddress(),
      to: hodEmail,
      subject: 'IQAC Extension Request - ' + eventData.title,
      html,
      text: `IQAC Extension Request\n\nEvent: ${eventData.title}\nReason: ${reason}\n\nPlease log in to approve or reject.\n\n---\nThis is an automated email.`,
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] IQAC extension request email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send IQAC extension request email:', error);
    return { success: false, error: error.message };
  }
}

async function sendIQACExtensionStatusEmail(organizerEmail, eventData, isApproved) {
  if (!organizerEmail) return { success: false };
  try {
    const statusWord = isApproved ? 'Approved' : 'Rejected';
    const html = templates.iqacExtensionStatusTemplate(eventData, isApproved);
    const mailOptions = {
      from: getSenderAddress(),
      to: organizerEmail,
      subject: 'IQAC Extension Request ' + statusWord + ' - ' + eventData.title,
      html,
      text: `IQAC Extension ${statusWord}\n\nYour IQAC extension request for "${eventData.title}" has been ${statusWord.toLowerCase()}.\n\n---\nThis is an automated email.`,
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] IQAC extension status email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send IQAC extension status email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEventNotificationToFaculty,
  sendEventStatusNotification,
  sendEventCreationNotification,
  sendApprovalRequestToRole,
  sendPosterRequestEmail,
  sendPosterReadyEmail,
  sendStudentRegistrationStatusEmail,
  sendPostEventFeedbackEmail,
  sendIQACSubmissionRequestEmail,
  sendIQACReminderEmail,
  sendIQACExtensionRequestEmail,
  sendIQACExtensionStatusEmail,
  sendEmail: async (optionsOrTo, subject, html) => {
    try {
      let mailOptions;
      if (typeof optionsOrTo === 'object' && optionsOrTo !== null) {
        mailOptions = {
          from: getSenderAddress(),
          to: optionsOrTo.to,
          subject: optionsOrTo.subject,
          text: optionsOrTo.text,
          html: optionsOrTo.html || (optionsOrTo.text ? optionsOrTo.text.replace(/\n/g, '<br/>') : '')
        };
      } else {
        mailOptions = {
          from: getSenderAddress(),
          to: optionsOrTo,
          subject: subject,
          text: html ? html.replace(/<[^>]*>?/gm, '') : '',
          html: html
        };
      }
      
      const result = await sendMailWithFallback(mailOptions);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('[Email Service] Generic send failed:', error);
      return { success: false, error: error.message };
    }
  }
};
