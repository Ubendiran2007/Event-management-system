/**
 * Send poster request email to media team
 * @param {Object} eventData - Event information
 * @param {string} mediaEmail - Media team email address
 * @returns {Promise<Object>} - Email send result
 */
async function sendPosterRequestEmail(eventData, mediaEmail) {
  if (!mediaEmail) {
    console.warn('[Email Service] No media email provided');
    return { success: false, message: 'Media email not provided' };
  }
  try {
    const eventReference = getEventReference(eventData);
    const mailOptions = {
      from: getSenderAddress(),
      to: mediaEmail,
      subject: `Poster Request – Event: ${eventData.title}`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; max-width: 640px; margin: 0 auto; background-color: #f8fafc; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #0f172a 100%); padding: 32px 28px 24px; text-align: center; border-bottom: 1px solid #1e293b;">
            <h1 style="color: #fff; margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">Poster Request</h1>
            <p style="color: #cbd5e1; margin: 0; font-size: 14px; font-weight: 500;">A new poster is required for the following event.</p>
          </div>
          <div style="padding: 24px 28px 28px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Event Reference</td><td style="padding: 8px 0; color: #0f172a;">${eventReference}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Title</td><td style="padding: 8px 0; color: #0f172a;">${eventData.title}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Type</td><td style="padding: 8px 0; color: #0f172a;">${eventData.eventType || 'Not specified'}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Date</td><td style="padding: 8px 0; color: #0f172a;">${eventData.date || 'Not specified'}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Poster Needed By</td><td style="padding: 8px 0; color: #0f172a;">${eventData.posterWorkflow?.neededByDate || 'TBD'} ${eventData.posterWorkflow?.neededByTime || ''}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Organizer</td><td style="padding: 8px 0; color: #0f172a;">${eventData.organizerName || 'Not specified'} (${eventData.organizerEmail || 'N/A'})</td></tr>
            </table>
            <p style="color: #64748b; font-size: 13px; margin-top: 18px;">Please create and return the poster by the requested date/time. Contact the organizer for clarifications.</p>
          </div>
          <div style="background: #e2e8f0; padding: 16px 28px; border-top: 1px solid #cbd5e1; text-align: center;">
            <p style="color: #475569; font-size: 11px; margin: 0;">This is an automated email from the Event Management System.</p>
          </div>
        </div>
      `,
      text: `Poster Request\n\nEvent Reference: ${eventReference}\nTitle: ${eventData.title}\nType: ${eventData.eventType}\nDate: ${eventData.date}\nPoster Needed By: ${eventData.posterWorkflow?.neededByDate || 'TBD'} ${eventData.posterWorkflow?.neededByTime || ''}\nOrganizer: ${eventData.organizerName} (${eventData.organizerEmail})\n\nPlease create and return the poster by the requested date/time. Contact the organizer for clarifications.\n\n---\nThis is an automated email from the Event Management System.`
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Poster request email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send poster request email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send poster ready email to organizer
 * @param {Object} eventData - Event information
 * @param {string} organizerEmail - Organizer email address
 * @returns {Promise<Object>} - Email send result
 */
async function sendPosterReadyEmail(eventData, organizerEmail) {
  if (!organizerEmail) {
    console.warn('[Email Service] No organizer email provided');
    return { success: false, message: 'Organizer email not provided' };
  }
  try {
    const eventReference = getEventReference(eventData);
    const mailOptions = {
      from: getSenderAddress(),
      to: organizerEmail,
      subject: `Poster Ready – Event: ${eventData.title}`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; max-width: 640px; margin: 0 auto; background-color: #f8fafc; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #22c55e 0%, #0f172a 100%); padding: 32px 28px 24px; text-align: center; border-bottom: 1px solid #1e293b;">
            <h1 style="color: #fff; margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">Poster Ready</h1>
            <p style="color: #cbd5e1; margin: 0; font-size: 14px; font-weight: 500;">The poster for your event is ready for review and upload.</p>
          </div>
          <div style="padding: 24px 28px 28px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Event Reference</td><td style="padding: 8px 0; color: #0f172a;">${eventReference}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Title</td><td style="padding: 8px 0; color: #0f172a;">${eventData.title}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Type</td><td style="padding: 8px 0; color: #0f172a;">${eventData.eventType || 'Not specified'}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Date</td><td style="padding: 8px 0; color: #0f172a;">${eventData.date || 'Not specified'}</td></tr>
              <tr><td style="padding: 8px 0; color: #475569; font-weight: 600;">Media Team</td><td style="padding: 8px 0; color: #0f172a;">${eventData.mediaEmail || 'N/A'}</td></tr>
            </table>
            <p style="color: #64748b; font-size: 13px; margin-top: 18px;">Please review and upload the poster before the event starts. Contact the media team for clarifications.</p>
          </div>
          <div style="background: #e2e8f0; padding: 16px 28px; border-top: 1px solid #cbd5e1; text-align: center;">
            <p style="color: #475569; font-size: 11px; margin: 0;">This is an automated email from the Event Management System.</p>
          </div>
        </div>
      `,
      text: `Poster Ready\n\nEvent Reference: ${eventReference}\nTitle: ${eventData.title}\nType: ${eventData.eventType}\nDate: ${eventData.date}\nMedia Team: ${eventData.mediaEmail}\n\nPlease review and upload the poster before the event starts. Contact the media team for clarifications.\n\n---\nThis is an automated email from the Event Management System.`
    };
    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Poster ready email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send poster ready email:', error);
    return { success: false, error: error.message };
  }
}
const nodemailer = require('nodemailer');

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

async function sendMailWithFallback(mailOptions) {
  const useResendOnly = String(process.env.EMAIL_PROVIDER || '').toLowerCase() === 'resend';

  if (useResendOnly) {
    return sendMailViaResend(mailOptions);
  }

  try {
    return await transporter.sendMail(mailOptions);
  } catch (primaryError) {
    if (!isNetworkSmtpError(primaryError)) {
      if (hasResendConfig()) {
        console.warn('[Email Service] SMTP send failed, trying HTTPS provider fallback:', primaryError.message);
        return sendMailViaResend(mailOptions);
      }
      throw primaryError;
    }

    console.warn('[Email Service] Primary SMTP send failed, trying SSL fallback (465):', primaryError.message);
    try {
      const fallbackTransporter = createFallbackTransporter();
      return await fallbackTransporter.sendMail(mailOptions);
    } catch (fallbackError) {
      if (!hasResendConfig()) {
        throw fallbackError;
      }
      console.warn('[Email Service] SMTP SSL fallback failed, trying HTTPS provider fallback:', fallbackError.message);
      return sendMailViaResend(mailOptions);
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
    eventData.eventReference ||
    eventData.requisition?.iqacNumber ||
    eventData.iqacNumber ||
    eventData.referenceNumber ||
    eventData.eventCode ||
    (eventData.id ? `EVT-${String(eventData.id).slice(-6).toUpperCase()}` : 'Not assigned')
  );
}

/**
 * Send event creation notification to faculty
 * @param {Object} eventData - Event information
 * @param {string} facultyEmail - Faculty email address
 * @returns {Promise<Object>} - Email send result
 */
async function sendEventNotificationToFaculty(eventData, facultyEmail) {
  if (!facultyEmail) {
    console.warn('[Email Service] No faculty email provided');
    return { success: false, message: 'Faculty email not provided' };
  }

  try {
    const eventReference = getEventReference(eventData);
    const mailOptions = {
      from: getSenderAddress(),
      to: facultyEmail,
      subject: `New Event Proposal – Requires Your Review: ${eventData.title}`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; max-width: 640px; margin: 0 auto; background-color: #0f172a; border-radius: 16px; overflow: hidden;">
          
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 36px 32px 28px; text-align: center; border-bottom: 1px solid #1e293b;">
            <div style="display: inline-block; background: #2563eb; padding: 10px 14px; border-radius: 12px; margin-bottom: 16px;">
              <span style="color: #ffffff; font-size: 22px;">📋</span>
            </div>
            <h1 style="color: #f1f5f9; margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">New Event Proposal</h1>
            <p style="color: #94a3b8; margin: 0; font-size: 14px; font-weight: 500;">Requires Your Review &amp; Approval</p>
          </div>

          <!-- Body -->
          <div style="padding: 28px 32px 32px;">

            <!-- Intro -->
            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.7; margin: 0 0 24px;">
              A new event proposal has been submitted and requires your review and approval. Please review the event details below.
            </p>

            <!-- Event Details Card -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
              <div style="background: linear-gradient(90deg, #2563eb, #3b82f6); padding: 12px 20px;">
                <h2 style="color: #ffffff; margin: 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">📄 Event Details</h2>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 12px 20px; color: #94a3b8; font-size: 13px; font-weight: 600; width: 140px; vertical-align: top;">Event Reference</td>
                  <td style="padding: 12px 20px; color: #f1f5f9; font-size: 13px; font-family: 'Courier New', monospace;">${eventReference}</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 12px 20px; color: #94a3b8; font-size: 13px; font-weight: 600; vertical-align: top;">Event Title</td>
                  <td style="padding: 12px 20px; color: #f1f5f9; font-size: 14px; font-weight: 600;">${eventData.title}</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 12px 20px; color: #94a3b8; font-size: 13px; font-weight: 600;">Event Type</td>
                  <td style="padding: 12px 20px; color: #f1f5f9; font-size: 13px;">${eventData.eventType || 'Not specified'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 12px 20px; color: #94a3b8; font-size: 13px; font-weight: 600;">Date</td>
                  <td style="padding: 12px 20px; color: #f1f5f9; font-size: 13px;">${eventData.date || 'Not specified'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 12px 20px; color: #94a3b8; font-size: 13px; font-weight: 600;">Time</td>
                  <td style="padding: 12px 20px; color: #f1f5f9; font-size: 13px;">${eventData.startTime ? eventData.startTime + ' – ' + (eventData.endTime || 'TBD') : 'Not specified'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 12px 20px; color: #94a3b8; font-size: 13px; font-weight: 600;">Venue</td>
                  <td style="padding: 12px 20px; color: #f1f5f9; font-size: 13px;">${eventData.venue || 'Not specified'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 12px 20px; color: #94a3b8; font-size: 13px; font-weight: 600;">Organizer</td>
                  <td style="padding: 12px 20px; color: #f1f5f9; font-size: 13px;">${eventData.organizerName || 'Not specified'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #334155;">
                  <td style="padding: 12px 20px; color: #94a3b8; font-size: 13px; font-weight: 600;">Department</td>
                  <td style="padding: 12px 20px; color: #f1f5f9; font-size: 13px;">${eventData.organizingDepartment || 'Not specified'}</td>
                </tr>
                ${eventData.description ? '<tr><td style="padding: 12px 20px; color: #94a3b8; font-size: 13px; font-weight: 600; vertical-align: top;">Description</td><td style="padding: 12px 20px; color: #cbd5e1; font-size: 13px; line-height: 1.6;">' + eventData.description + '</td></tr>' : ''}
              </table>
            </div>

            <!-- Next Step -->
            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #172554 100%); border: 1px solid #2563eb; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; text-align: center;">
              <p style="color: #93c5fd; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; margin: 0 0 8px;">⚡ Action Required</p>
              <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6; margin: 0;">
                Please log into the <strong style="color: #ffffff;">Event Management Portal</strong> to review and approve this event proposal.
              </p>
            </div>

            <!-- Approval Workflow -->
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px;">🔗 Approval Workflow</p>
              <table style="width: 100%; text-align: center;">
                <tr>
                  <td style="padding: 0 4px;">
                    <div style="background: #2563eb; border-radius: 8px; padding: 10px 8px;">
                      <p style="color: #ffffff; font-size: 12px; font-weight: 700; margin: 0;">Faculty</p>
                      <p style="color: #93c5fd; font-size: 10px; margin: 4px 0 0; font-weight: 500;">Step 1</p>
                    </div>
                  </td>
                  <td style="color: #475569; font-size: 18px; padding: 0 2px;">→</td>
                  <td style="padding: 0 4px;">
                    <div style="background: #334155; border-radius: 8px; padding: 10px 8px;">
                      <p style="color: #94a3b8; font-size: 12px; font-weight: 700; margin: 0;">HOD</p>
                      <p style="color: #64748b; font-size: 10px; margin: 4px 0 0; font-weight: 500;">Step 2</p>
                    </div>
                  </td>
                  <td style="color: #475569; font-size: 18px; padding: 0 2px;">→</td>
                  <td style="padding: 0 4px;">
                    <div style="background: #334155; border-radius: 8px; padding: 10px 8px;">
                      <p style="color: #94a3b8; font-size: 12px; font-weight: 700; margin: 0;">Principal</p>
                      <p style="color: #64748b; font-size: 10px; margin: 4px 0 0; font-weight: 500;">Step 3</p>
                    </div>
                  </td>
                </tr>
              </table>
            </div>

          </div>

          <!-- Footer -->
          <div style="background: #0b1120; padding: 20px 32px; border-top: 1px solid #1e293b; text-align: center;">
            <p style="color: #64748b; font-size: 11px; margin: 0 0 6px; line-height: 1.5;">
              This is an automated email generated by the CSE Event Management System. Please do not reply to this email.
            </p>
            <p style="color: #475569; font-size: 11px; margin: 0;">
              © ${new Date().getFullYear()} Sri Eshwar College of Engineering, Coimbatore
            </p>
          </div>

        </div>
      `,
      text: `
New Event Proposal – Requires Your Review

A new event proposal has been submitted and requires your review and approval.

Event Details:
- Event Reference: ${eventReference}
- Title: ${eventData.title}
- Type: ${eventData.eventType || 'Not specified'}
- Date: ${eventData.date || 'Not specified'}
- Time: ${eventData.startTime || 'Not specified'} - ${eventData.endTime || 'Not specified'}
- Venue: ${eventData.venue || 'Not specified'}
- Organizer: ${eventData.organizerName || 'Not specified'}
- Department: ${eventData.organizingDepartment || 'Not specified'}
- Description: ${eventData.description || 'No description provided'}

Action Required: Please log into the Event Management Portal to review and approve this event proposal.

Approval Workflow: Faculty → HOD → Principal

---
This is an automated email generated by the CSE Event Management System. Please do not reply to this email.
© ${new Date().getFullYear()} Sri Eshwar College of Engineering, Coimbatore
      `,
    };

    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Event notification sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send approval request notification to next approver role
 * @param {Object} eventData - Event information
 * @param {string} approverEmail - Next approver email address
 * @param {string} approverRole - Next approver role label (HOD/PRINCIPAL)
 * @returns {Promise<Object>} - Email send result
 */
async function sendApprovalRequestToRole(eventData, approverEmail, approverRole) {
  if (!approverEmail) {
    console.warn('[Email Service] No approver email provided');
    return { success: false, message: 'Approver email not provided' };
  }

  try {
    const roleLabel = String(approverRole || 'Approver').toUpperCase();
    const eventReference = getEventReference(eventData);

    const mailOptions = {
      from: getSenderAddress(),
      to: approverEmail,
      subject: `Event Requires ${roleLabel} Approval – ${eventData.title}`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background: #0f172a; padding: 20px 24px;">
            <h2 style="margin: 0; color: #f8fafc; font-size: 20px;">Approval Required</h2>
            <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px;">This event is now pending ${roleLabel} review.</p>
          </div>
          <div style="padding: 20px 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr><td style="padding: 8px 0; color: #64748b; width: 140px; font-weight: 600;">Event Reference</td><td style="padding: 8px 0; color: #0f172a; font-family: 'Courier New', monospace;">${eventReference}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Event Title</td><td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${eventData.title || 'Not specified'}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Date</td><td style="padding: 8px 0; color: #0f172a;">${eventData.date || 'Not specified'}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Time</td><td style="padding: 8px 0; color: #0f172a;">${eventData.startTime ? eventData.startTime + ' – ' + (eventData.endTime || 'TBD') : 'Not specified'}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Venue</td><td style="padding: 8px 0; color: #0f172a;">${eventData.venue || 'Not specified'}</td></tr>
              <tr><td style="padding: 8px 0; color: #64748b; font-weight: 600;">Organizer</td><td style="padding: 8px 0; color: #0f172a;">${eventData.organizerName || 'Not specified'}</td></tr>
            </table>
            <div style="margin-top: 14px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 14px; color: #1e3a8a; font-size: 13px; line-height: 1.6;">
              Please log in to the Event Management Portal and process this request.
            </div>
          </div>
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; color: #64748b; font-size: 11px;">
            This is an automated email from the CSE Event Management System.
          </div>
        </div>
      `,
      text: `
Approval Required

This event is now pending ${roleLabel} review.

Event Reference: ${eventReference}
Event Title: ${eventData.title || 'Not specified'}
Date: ${eventData.date || 'Not specified'}
Time: ${eventData.startTime ? eventData.startTime + ' - ' + (eventData.endTime || 'TBD') : 'Not specified'}
Venue: ${eventData.venue || 'Not specified'}
Organizer: ${eventData.organizerName || 'Not specified'}

Please log in to the Event Management Portal and process this request.
      `,
    };

    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Approval request notification sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send approval request email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send event approval notification to event organizer
 * @param {string} organizerEmail - Event organizer email
 * @param {Object} eventData - Event information
 * @param {string} status - New event status
 * @returns {Promise<Object>} - Email send result
 */
async function sendEventStatusNotification(organizerEmail, eventData, status) {
  if (!organizerEmail) {
    console.warn('[Email Service] No organizer email provided');
    return { success: false, message: 'Organizer email not provided' };
  }

  const statusMessages = {
    PENDING_HOD: { title: 'Event Approved by Faculty', message: 'Your event has been approved by the faculty and is now pending HOD approval.' },
    PENDING_PRINCIPAL: { title: 'Event Approved by HOD', message: 'Your event has been approved by the HOD and is now pending Principal approval.' },
    POSTED: { title: 'Event Approved', message: 'Your event has been approved and is now posted for student registration.' },
    REJECTED: { title: 'Event Rejected', message: 'Your event proposal has been rejected. Please review the feedback and resubmit.' },
  };

  const statusInfo = statusMessages[status] || { title: 'Event Status Updated', message: 'Your event status has been updated.' };
  const rejectionReason = status === 'REJECTED'
    ? String(eventData?.rejectionReason || '').trim()
    : '';

  try {
    const mailOptions = {
      from: getSenderAddress(),
      to: organizerEmail,
      subject: statusInfo.title,
      html: `
        <div style="font-family: Poppins, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
          <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px;">
              <h1 style="color: #0f172a; margin: 0; font-size: 24px;">${statusInfo.title}</h1>
            </div>

            <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
              <p style="margin: 0; color: #0f172a; font-size: 14px;">
                <strong>Event:</strong> ${eventData.title}
              </p>
              <p style="margin: 10px 0 0 0; color: #475569; font-size: 14px;">
                ${statusInfo.message}
              </p>
            </div>

            ${rejectionReason ? `
            <div style="background-color: #fff1f2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
              <p style="margin: 0; color: #991b1b; font-size: 13px; font-weight: 700;">Rejection Reason</p>
              <p style="margin: 8px 0 0 0; color: #7f1d1d; font-size: 13px; line-height: 1.6;">${rejectionReason}</p>
            </div>
            ` : ''}

            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                This is an automated email from the CSE Event Management Portal. Please do not reply to this email.
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0 0;">
                © ${new Date().getFullYear()} Sri Eshwar College of Engineering
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
    ${statusInfo.title}

    Event: ${eventData.title || 'Not specified'}
    ${statusInfo.message}
    ${rejectionReason ? `\nRejection Reason: ${rejectionReason}` : ''}

    This is an automated email from the CSE Event Management Portal. Please do not reply to this email.
      `,
    };

    const result = await sendMailWithFallback(mailOptions);
    console.log('[Email Service] Status notification sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEventNotificationToFaculty,
  sendEventStatusNotification,
  sendApprovalRequestToRole,
};
