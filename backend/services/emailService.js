const nodemailer = require('nodemailer');
const templates = require('./emailTemplates');

const { collection, addDoc, db } = require('../firebaseClientWrapper');
const net = require('net');
const { logEmail } = require('../utils/logger');
const crypto = require('crypto');
require('dotenv').config();

function getSenderAddress() {
  return process.env.EMAIL_FROM || process.env.EMAIL_USER;
}

// 6. Verify Runtime Configuration
console.log('--- VERIFY RUNTIME CONFIGURATION ---');
console.log('SMTP_HOST:', process.env.SMTP_HOST || 'smtp-relay.brevo.com');
console.log('SMTP_PORT:', process.env.SMTP_PORT || '587');
console.log('SMTP_SECURE:', process.env.SMTP_SECURE || 'false');
console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER);
console.log('------------------------------------');

// Configure SMTP transporter with credentials and timeouts
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true' ? true : false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  dnsOptions: { family: 4 },
  // 2. Configure Transport Timeouts
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  // 3. Enable Nodemailer Debugging
  logger: true,
  debug: true
});

// 4. TCP Connectivity Test & 5. Promise Timeout for Verify
(async () => {
  const host = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  
  console.log('[Email Service] TCP Connectivity Test: Starting raw connection test...');
  await new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(10000);
    
    socket.on('lookup', (err, address, family, host) => {
      console.log(`[Email Service] TCP: DNS lookup resolved to IP ${address} (IPv${family})`);
    });
    
    socket.on('connect', () => {
      console.log('[Email Service] TCP: Socket Connected');
      socket.destroy();
    });
    
    socket.on('timeout', () => {
      console.log('[Email Service] TCP: Socket Timeout');
      socket.destroy();
    });
    
    socket.on('error', (err) => {
      console.log('[Email Service] TCP: Socket Error -', err.message);
    });
    
    socket.on('close', () => {
      console.log('[Email Service] TCP: Socket Closed');
      resolve();
    });
    
    socket.connect(port, host);
  });

  console.log('[Email Service] Running transporter.verify() with 15s timeout limit...');
  try {
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TRANSPORTER_VERIFY_TIMEOUT_15S')), 15000)
    );
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log('[Email Service] SMTP connection verified successfully');
  } catch (error) {
    console.error('[Email Service] SMTP connection verification failed:', error.message);
  }
})();

async function logEmailAudit(mailOptions, status, errorMessage = '', smtpResponse = '') {
  const isTestMode = process.env.EMAIL_TEST_MODE === 'true';
  const recipient = Array.isArray(mailOptions.to) ? mailOptions.to.join(',') : mailOptions.to;
  
  logEmail({
    action: `SEND_${mailOptions.emailType || 'GENERAL'}_EMAIL`,
    status: status,
    correlationId: mailOptions.eventId || null, // Using eventId to correlate
    requestId: crypto.randomUUID(),
    target: {
      entityType: 'USER_EMAIL',
      entityId: isTestMode ? mailOptions._originalTo : recipient
    },
    details: {
      subject: mailOptions.subject || '',
      smtpResponse,
      errorMessage,
      testModeActive: isTestMode,
      eventTitle: mailOptions.eventTitle || null
    }
  });
}

async function sendMailWithFallback(mailOptions) {
  if (Array.isArray(mailOptions.to)) {
    mailOptions.to = [...new Set(mailOptions.to)];
  } else if (typeof mailOptions.to === 'string') {
    mailOptions.to = [...new Set(mailOptions.to.split(',').map(e => e.trim()).filter(Boolean))].join(', ');
  }

  if (process.env.EMAIL_TEST_MODE === 'true') {
    const testRecipient = process.env.EMAIL_TEST_RECIPIENT || 'ubendirankumar@gmail.com';
    console.log(`[Email Service] ⚠️  TEST MODE: Redirecting email for "${mailOptions.to}" → ${testRecipient}`);
    mailOptions._originalTo = mailOptions.to;
    mailOptions.to = testRecipient;
  } else {
    console.log(`[Email Service] 📧 PRODUCTION: Sending email to "${mailOptions.to}"`);
  }

  try {
    console.log('Calling transporter.sendMail()');
    
    const sendPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TRANSPORTER_SEND_TIMEOUT_15S')), 15000)
    );
    
    const res = await Promise.race([sendPromise, timeoutPromise]);
    
    console.log('Email sent successfully');
    console.log('[Email Service] Provider Result:', JSON.stringify({
      messageId: res.messageId,
      accepted: res.accepted,
      rejected: res.rejected,
      response: res.response
    }, null, 2));
    
    await logEmailAudit(mailOptions, 'SUCCESS', '', res.response);
    return res;
  } catch (error) {
    console.error('[Email Service] sendMail() threw an error!');
    console.error('error.name:', error.name);
    console.error('error.code:', error.code);
    console.error('error.command:', error.command);
    console.error('error.response:', error.response);
    console.error('error.responseCode:', error.responseCode);
    console.error('error.message:', error.message);
    console.error('stack trace:', error.stack);
    
    await logEmailAudit(mailOptions, 'FAILED', error.message);
    throw error; // Never swallow exceptions
  }
}

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
      console.error('[Email Service] Generic send failed:', error.message);
      return { success: false, error: error.message };
    }
  }
};
