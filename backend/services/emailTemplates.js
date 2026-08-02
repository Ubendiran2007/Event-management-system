const SECE_HEADER_IMG = "https://sece.ac.in/wp-content/uploads/2023/10/sece-logo.png"; // Example or placeholder if needed

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const portalLinks = require('../utils/portalLinks');

function buildBaseTemplate({ title, subtitle, headerBg = '#1e293b', headerTextColor = '#ffffff', contentHtml, preheader = '', actionUrl = null, eventReferenceId = null }) {
  const currentYear = new Date().getFullYear();
  
  const actionButtonHtml = actionUrl ? `
    <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
      <a href="${actionUrl}" class="btn" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; text-align: center; transition: background-color 0.2s;">Open in Event Hub</a>
      <p style="margin: 16px 0 0; font-size: 12px; color: #64748b;">
        Can't click the button? Copy and paste this link:<br>
        <a href="${actionUrl}" style="color: #2563eb; text-decoration: underline; word-break: break-all;">${actionUrl}</a>
      </p>
    </div>
  ` : '';

  const refTagHtml = eventReferenceId ? `
    <tr>
      <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 10px 32px; font-size: 13px; color: #475569;">
        <strong>Event Reference ID:</strong> <span style="font-family: monospace; font-weight: 700; color: #0f172a;">${eventReferenceId}</span>
      </td>
    </tr>
  ` : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f1f5f9; padding-bottom: 40px; }
        .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; font-family: sans-serif; color: #334155; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); margin-top: 40px; }
        .header { background: ${headerBg}; padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; color: ${headerTextColor}; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
        .header p { margin: 8px 0 0 0; color: #cbd5e1; font-size: 15px; font-weight: 500; }
        .content { padding: 32px 32px 24px 32px; background-color: #ffffff; }
        .footer { background-color: #0f172a; padding: 24px 32px; text-align: center; border-top: 1px solid #1e293b; color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer p { margin: 0 0 12px 0; }
        .footer .copyright { color: #475569; font-size: 11px; margin: 0; }
        .table-details { width: 100%; border-collapse: collapse; margin: 24px 0; }
        .table-details td { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .table-details td:first-child { font-weight: 600; color: #475569; width: 35%; vertical-align: top; }
        .table-details td:last-child { color: #0f172a; font-weight: 500; }
        .table-details tr:last-child td { border-bottom: none; }
        .btn { display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center; transition: background-color 0.2s; }
        .alert-box { border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid; }
        .alert-info { background-color: #eff6ff; border-color: #3b82f6; color: #1e3a8a; }
        .alert-success { background-color: #f0fdf4; border-color: #10b981; color: #065f46; }
        .alert-error { background-color: #fef2f2; border-color: #ef4444; color: #991b1b; }
        .alert-warning { background-color: #fffbeb; border-color: #f59e0b; color: #92400e; }
        .workflow { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center; }
      </style>
    </head>
    <body>
      <div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>
      <center class="wrapper">
        <table class="main" width="100%">
          <tr>
            <td class="header">
              <h1>${title}</h1>
              ${subtitle ? `<p>${subtitle}</p>` : ''}
            </td>
          </tr>
          ${refTagHtml}
          <tr>
            <td class="content">
              ${contentHtml}
              ${actionButtonHtml}
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p style="font-weight: 500; color: #cbd5e1;">Manage this request directly from the SECE Event Management Portal.</p>
              <p>Open Portal:<br><a href="${actionUrl || FRONTEND_URL}" style="color: #38bdf8; text-decoration: underline; word-break: break-all;">${actionUrl || FRONTEND_URL}</a></p>
              <p style="font-size: 11px; color: #64748b; margin-bottom: 16px;">If the button above does not work, copy and paste the URL into your browser.</p>
              <div style="border-top: 1px solid #1e293b; padding-top: 16px;">
                <p style="margin-bottom: 4px; color: #64748b;">This is an automated email generated by the SECE Event Management System.</p>
                <p style="margin-bottom: 8px; color: #64748b;">Please do not reply to this email.</p>
                <p class="copyright">© ${currentYear} Sri Eshwar College of Engineering, Coimbatore. All rights reserved.</p>
              </div>
            </td>
          </tr>
        </table>
      </center>
    </body>
    </html>
  `;
}

// Helper for empty value fallbacks matching frontend standards
const safeVal = (val, fallback = 'Not Provided') => {
  if (val === null || val === undefined || val === '' || String(val).trim() === '' || String(val).trim() === '-' || String(val).trim() === '*') {
    return fallback;
  }
  return val;
};

// Helper to format event references securely (NO Firebase IDs)
const getEventRef = (event) => safeVal(event.referenceId, 'Pending Reference');

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hh = parseInt(h, 10);
  const suffix = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${m} ${suffix}`;
};

const getEventDetailsHtml = (eventData) => `
  <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 16px;">
    <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
      <h3 style="margin: 0; font-size: 14px; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">📋 Event Details</h3>
    </div>
    <table class="table-details">
      <tr><td>Event Reference ID</td><td style="font-family: monospace; font-weight: 700; color: #0f172a;">${getEventRef(eventData)}</td></tr>
      <tr><td>Event Title</td><td style="font-weight: 700;">${safeVal(eventData.title, 'Not Provided')}</td></tr>
      <tr><td>Department</td><td>${safeVal(eventData.department || eventData.organizingDepartment, 'Not Assigned')}</td></tr>
      <tr><td>Event Type</td><td>${safeVal(eventData.eventType, 'Not Specified')}</td></tr>
      <tr><td>Date</td><td>${safeVal(eventData.date, 'Not Specified')}</td></tr>
      <tr><td>Time</td><td>${eventData.startTime ? formatTime(eventData.startTime) + ' - ' + (eventData.endTime ? formatTime(eventData.endTime) : 'TBD') : 'Not Specified'}</td></tr>
      <tr><td>Venue</td><td>${safeVal(eventData.venue, 'Not Specified')}</td></tr>
      <tr><td>Organizer</td><td>${safeVal(eventData.organizerName, 'Not Provided')}</td></tr>
    </table>
  </div>
`;


module.exports = {
  /* @legacy @disabled (In-App / WhatsApp Only) */
  facultyNotificationTemplate: (eventData) => {
    return buildBaseTemplate({
      title: 'New Event Proposal',
      subtitle: 'Requires Your Review & Approval',
      headerBg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      preheader: `Action Required: Review event proposal '${eventData.title}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; line-height: 1.6; font-size: 15px;">A new event proposal has been submitted and requires your review as the designated <strong>Faculty Coordinator</strong>.</p>
        ${getEventDetailsHtml(eventData)}
        <div class="alert-box alert-info">
          <p style="margin: 0; font-size: 14px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">⚡ Action Required</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Please log into the Event Management Portal to review the requisition and approve or reject this proposal.</p>
        </div>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/approvals/events/${eventData.id || ''}`
    });
  },

  approvalRequestTemplate: (eventData, roleLabel) => {
    return buildBaseTemplate({
      title: 'Approval Required',
      subtitle: `Pending ${roleLabel} Review`,
      headerBg: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
      preheader: `Action Required: '${eventData.title}' is pending ${roleLabel} approval.`,
      contentHtml: `
        <p style="margin: 0 0 16px; line-height: 1.6; font-size: 15px;">The following event has reached the <strong>${roleLabel}</strong> stage and requires your review.</p>
        ${getEventDetailsHtml(eventData)}
        <div style="margin-top: 24px; text-align: center;">
          <p style="margin: 0 0 16px; font-size: 14px; color: #475569;">Please log into the portal to review the complete details and process this request.</p>
        </div>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/approvals/events/${eventData.id || ''}`
    });
  },

  eventStatusTemplate: (eventData, statusInfo, rejectionReason) => {
    const isRejected = statusInfo.title.toLowerCase().includes('reject') || eventData.status === 'REJECTED';
    const headerBg = isRejected ? 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)' : 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)';
    
    let contentHtml = `
      <div class="alert-box ${isRejected ? 'alert-error' : 'alert-info'}">
        <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">${eventData.title}</p>
        <p style="margin: 0; font-size: 14px; line-height: 1.5;">${statusInfo.message}</p>
      </div>
    `;

    if (isRejected) {
      const rejecterName = eventData.rejectedByName || 'Authorized Approver';
      const rejecterRole = eventData.rejectedByRole || 'Approver';
      const rejecterDept = eventData.rejectedByDept || 'N/A';
      const rejectReason = rejectionReason || eventData.rejectionReason || 'No reason provided';
      const rejectDate = eventData.rejectedAt 
        ? new Date(eventData.rejectedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

      contentHtml += `
        <div style="margin-top: 24px; border: 1px solid #fca5a5; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #fef2f2; padding: 12px 16px; border-bottom: 1px solid #fca5a5;">
            <h3 style="margin: 0; font-size: 14px; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">🚫 Rejection Audit Trail</h3>
          </div>
          <table class="table-details" style="margin: 0; width: 100%; text-align: left; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 16px; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #fecaca; font-size: 13px;">Rejected By</td>
              <td style="padding: 10px 16px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #fecaca; font-size: 13px;">${rejecterName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-weight: 600; color: #475569; border-bottom: 1px solid #fecaca; font-size: 13px;">Role / Designation</td>
              <td style="padding: 10px 16px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #fecaca; font-size: 13px;">${rejecterRole}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-weight: 600; color: #475569; border-bottom: 1px solid #fecaca; font-size: 13px;">Department</td>
              <td style="padding: 10px 16px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #fecaca; font-size: 13px;">${rejecterDept}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-weight: 600; color: #475569; border-bottom: 1px solid #fecaca; font-size: 13px;">Rejection Date</td>
              <td style="padding: 10px 16px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #fecaca; font-size: 13px;">${rejectDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-weight: 600; color: #475569; font-size: 13px;">Rejection Reason</td>
              <td style="padding: 10px 16px; color: #b91c1c; font-weight: 600; font-size: 13px; font-style: italic;">"${rejectReason}"</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
          <h4 style="margin: 0 0 12px; color: #0f172a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">💡 Guidance for Resubmission</h4>
          <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.6; color: #334155;">To modify and resubmit your event proposal for re-routing:</p>
          <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #334155;">
            <li style="margin-bottom: 8px;">Log into the <strong>Sri Eshwar Event Management Portal</strong>.</li>
            <li style="margin-bottom: 8px;">Navigate to your <strong>Dashboard</strong> under "My Organized Events".</li>
            <li style="margin-bottom: 8px;">Locate the rejected event and click on it to open details.</li>
            <li style="margin-bottom: 8px;">Click the <strong>Edit & Resubmit</strong> button to modify your details or annexures based on the feedback above.</li>
            <li style="margin-bottom: 0;">Submit the updated proposal to initiate the approval workflow again.</li>
          </ol>
        </div>
      `;
    } else {
      contentHtml += `
        ${getEventDetailsHtml(eventData)}
      `;
    }

    return buildBaseTemplate({
      title: statusInfo.title,
      subtitle: 'Event Status Update',
      headerBg,
      preheader: `Update for '${eventData.title}': ${statusInfo.message}`,
      contentHtml,
      actionUrl: `${FRONTEND_URL}/dashboard/events/${eventData.id || ''}`
    });
  },

  /* @legacy @disabled (In-App / WhatsApp Only) */
  posterRequestTemplate: (eventData) => {
    return buildBaseTemplate({
      title: 'Poster Request',
      subtitle: 'New Design Task Assigned',
      headerBg: 'linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)',
      preheader: `Design Request: Poster needed for '${eventData.title}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; line-height: 1.6; font-size: 15px;">The Media Team has been requested to design a poster for an upcoming event.</p>
        ${getEventDetailsHtml(eventData)}
        <div style="margin-top: 24px; padding: 16px; background-color: #f3f4f6; border-radius: 8px; border: 1px dashed #cbd5e1;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 8px 0; color: #475569; font-weight: 600; width: 40%;">Needed By Date</td><td style="padding: 8px 0; color: #0f172a; font-weight: 700; color: #ef4444;">${eventData.posterWorkflow?.neededByDate || 'TBD'} ${eventData.posterWorkflow?.neededByTime || ''}</td></tr>
          </table>
        </div>
        <p style="margin: 20px 0 0; font-size: 14px; color: #475569; line-height: 1.5;">Please coordinate with the organizer (${eventData.organizerName}) for specific design requirements and upload the completed poster to the portal.</p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/events/${eventData.id || ''}`
    });
  },

  /* @legacy @disabled (In-App / WhatsApp Only) */
  posterReadyTemplate: (eventData) => {
    return buildBaseTemplate({
      title: 'Poster Ready',
      subtitle: 'Media Team has uploaded the design',
      headerBg: 'linear-gradient(135deg, #10b981 0%, #064e3b 100%)',
      preheader: `Poster uploaded for '${eventData.title}'`,
      contentHtml: `
        <div class="alert-box alert-success">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">The poster for your event is ready!</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Your official event poster has been uploaded successfully by the Media Team.</p>
        </div>
        <p style="margin: 20px 0 0; font-size: 14px; color: #475569; line-height: 1.6;">Please log into the portal to review the design and finalize the event details.</p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/events/${eventData.id || ''}`
    });
  },

  /* @legacy @disabled (In-App / WhatsApp Only) */
  studentRegistrationTemplate: (student, eventData, status, isApproved) => {
    const headerBg = isApproved ? 'linear-gradient(135deg, #10b981 0%, #064e3b 100%)' : 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)';
    const rollNo = safeVal(student.rollNo, 'Not Provided');
    const dept = safeVal(student.department, 'Not Assigned');
    const safeName = safeVal(student.name, 'Unknown Student');

    return buildBaseTemplate({
      title: `Registration ${isApproved ? 'Approved' : 'Rejected'}`,
      subtitle: safeVal(eventData.title, 'Not Provided'),
      headerBg,
      preheader: `Your registration for ${safeVal(eventData.title, 'Not Provided')} has been ${status.toLowerCase()}`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 16px; color: #0f172a;">Dear <strong>${safeName}</strong>,</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; width: 35%; color: #475569;">Student Name</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #0f172a; font-weight: 500;">${safeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; color: #475569;">Roll Number</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #0f172a; font-family: monospace; font-size: 14px;">${rollNo}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; color: #475569;">Department/Class</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #0f172a;">${dept}</td>
          </tr>
        </table>
        
        <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.6;">Your registration request for the event <strong>"${safeVal(eventData.title, 'Not Provided')}"</strong> has been <strong style="color: ${isApproved ? '#10b981' : '#ef4444'}">${status.toLowerCase()}</strong>.</p>
        
        ${isApproved ? `
          <div class="alert-box alert-success">
            <p style="margin: 0; font-size: 14px; font-weight: 600; display: flex; align-items: center;">
              ✅ Official OD Permission Letter Attached
            </p>
            <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.5;">Your approved On-Duty (OD) letter is attached to this email as a PDF document. Please download and present it to your class advisor for attendance processing.</p>
          </div>
        ` : `
          <div class="alert-box alert-error">
            <p style="margin: 0; font-size: 14px; font-weight: 600;">Request Not Accommodated</p>
            <p style="margin: 8px 0 0; font-size: 13px; line-height: 1.5;">Unfortunately, your request could not be accommodated at this time. If you have questions, please contact the event organizer.</p>
          </div>
        `}
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/registrations/${student.registrationId || student.id || ''}`
    });
  },

  /* @legacy @disabled (In-App / WhatsApp Only) */
  feedbackRequestTemplate: (student, eventData, feedbackLink) => {
    const rollNo = safeVal(student.rollNo, 'Not Provided');
    const dept = safeVal(student.department, 'Not Assigned');
    const safeName = safeVal(student.name, 'Unknown Student');

    return buildBaseTemplate({
      title: 'Feedback Requested',
      subtitle: 'Help us improve future events',
      headerBg: 'linear-gradient(135deg, #f59e0b 0%, #78350f 100%)',
      preheader: `Please share your feedback for '${safeVal(eventData.title, 'Not Provided')}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 16px; color: #0f172a;">Dear <strong>${safeName}</strong>,</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; width: 35%; color: #475569;">Student Name</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #0f172a; font-weight: 500;">${safeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; color: #475569;">Roll Number</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #0f172a; font-family: monospace; font-size: 14px;">${rollNo}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; color: #475569;">Department/Class</td>
            <td style="padding: 8px; border: 1px solid #e2e8f0; color: #0f172a;">${dept}</td>
          </tr>
        </table>
        
        <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.6;">Thank you for participating in <strong>"${safeVal(eventData.title, 'Not Provided')}"</strong>. We hope you had a great experience!</p>
        <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.6;">To help us improve the quality of future programs, please take a few minutes to share your feedback.</p>
      `,
      actionUrl: feedbackLink || `${FRONTEND_URL}/dashboard`
    });
  },

  iqacSubmissionRequestTemplate: (eventData) => {
    return buildBaseTemplate({
      title: 'IQAC Report Required',
      subtitle: 'Post-Event Submission Process',
      headerBg: 'linear-gradient(135deg, #0ea5e9 0%, #0c4a6e 100%)',
      preheader: `Action Required: Submit IQAC report for '${eventData.title}'`,
      contentHtml: `
        <div class="alert-box alert-info">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Event Completed</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">The event <strong>${eventData.title}</strong> has concluded. It is now mandatory to submit the Post-Event Report to the IQAC.</p>
        </div>
        <p style="margin: 20px 0 0; font-size: 14px; color: #475569; line-height: 1.6;">Please log into the portal to complete the IQAC submission, which includes uploading event photographs and summarizing student feedback.</p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/reports/${eventData.id || ''}`
    });
  },

  /* @legacy @disabled (In-App / WhatsApp Only) */
  iqacReminderTemplate: (eventData, deadlineDate) => {
    return buildBaseTemplate({
      title: 'IQAC Submission Reminder',
      subtitle: 'Deadline Approaching',
      headerBg: 'linear-gradient(135deg, #ea580c 0%, #7c2d12 100%)',
      preheader: `Reminder: IQAC report for '${eventData.title}' is due ${deadlineDate}`,
      contentHtml: `
        <div class="alert-box alert-warning">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Submission Overdue or Approaching</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">The IQAC Post-Event Report for <strong>${eventData.title}</strong> is due by <strong>${deadlineDate}</strong>.</p>
        </div>
        <p style="margin: 20px 0 0; font-size: 14px; color: #475569; line-height: 1.6;">Prompt submission is necessary to maintain compliance. Please complete this requirement immediately via the portal.</p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/reports/${eventData.id || ''}`
    });
  },

  iqacExtensionRequestTemplate: (eventData, reason) => {
    return buildBaseTemplate({
      title: 'IQAC Extension Request',
      subtitle: 'Requires HOD Approval',
      headerBg: 'linear-gradient(135deg, #64748b 0%, #0f172a 100%)',
      preheader: `Review extension request for '${eventData.title}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #475569; line-height: 1.6;">The organizer of the following event has requested an extension for their IQAC Post-Event Report submission.</p>
        ${getEventDetailsHtml(eventData)}
        <div style="margin-top: 20px;">
          <h4 style="margin: 0 0 8px; color: #0f172a; font-size: 14px;">Reason Provided by Organizer:</h4>
          <div style="background-color: #f8fafc; border-left: 4px solid #94a3b8; padding: 12px 16px; color: #334155; font-style: italic; font-size: 14px;">
            "${reason}"
          </div>
        </div>
        <p style="margin: 20px 0 0; font-size: 14px; color: #475569;">Please log into the portal to approve or reject this extension request.</p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/approvals/events/${eventData.id || ''}`
    });
  },

  iqacExtensionStatusTemplate: (eventData, isApproved) => {
    const statusWord = isApproved ? 'Approved' : 'Rejected';
    const headerBg = isApproved ? 'linear-gradient(135deg, #10b981 0%, #064e3b 100%)' : 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)';
    return buildBaseTemplate({
      title: `Extension Request ${statusWord}`,
      subtitle: eventData.title,
      headerBg,
      preheader: `Your IQAC extension request has been ${statusWord.toLowerCase()}`,
      contentHtml: `
        <div class="alert-box ${isApproved ? 'alert-success' : 'alert-error'}">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Decision: ${statusWord}</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Your request for an IQAC Post-Event Report extension for <strong>${eventData.title}</strong> has been <strong>${statusWord.toLowerCase()}</strong> by the HOD.</p>
        </div>
        ${isApproved 
          ? '<p style="margin: 20px 0 0; font-size: 14px; color: #475569;">You may now log into the portal and submit your report within the newly extended window.</p>'
          : '<p style="margin: 20px 0 0; font-size: 14px; color: #475569;">Please ensure that your report is submitted as soon as possible to remain compliant.</p>'}
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/reports/${eventData.id || ''}`
    });
  },

  eventCreationTemplate: (eventData) => {
    return buildBaseTemplate({
      title: 'Event Proposal Submitted',
      subtitle: 'Successfully created and routed for approval',
      headerBg: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)',
      preheader: `Success! Your event '${eventData.title}' has been created.`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">Dear Organizer,</p>
        <p style="margin: 0 0 16px; font-size: 15px; color: #475569; line-height: 1.6;">Your event proposal for <strong>"${eventData.title}"</strong> has been successfully created and submitted to the approval workflow.</p>
        
        ${getEventDetailsHtml(eventData)}

        <div class="alert-box alert-info" style="margin-top: 24px;">
          <p style="margin: 0; font-size: 14px; font-weight: 600; margin-bottom: 8px;">🚀 What's Next?</p>
          <p style="margin: 0; font-size: 13px; line-height: 1.5;">Your proposal is now pending review. You will receive email notifications as it progresses through the designated approvers (Faculty, HOD, Departments, IQAC).</p>
        </div>
        <p style="margin: 20px 0 0; font-size: 14px; color: #475569;">You can track the live approval status at any time from your Dashboard in the Event Management Portal.</p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/events/${eventData.id || ''}`
    });
  },

  // ─────────────────────────────────────────────────────────────────
  // MANAGER ASSIGNMENT WORKFLOW TEMPLATES (#2, #3, #4)
  // ─────────────────────────────────────────────────────────────────

  managerAssignmentTemplate: (eventData, managerName = 'Manager') => {
    return buildBaseTemplate({
      title: 'Manager Assignment',
      subtitle: 'You have been assigned as an Event Manager',
      headerBg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      preheader: `Action Required: You are assigned to manage '${eventData.title}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">Dear ${managerName},</p>
        <p style="margin: 0 0 16px; font-size: 15px; color: #475569; line-height: 1.6;">You have been designated as an Event Manager for the upcoming event <strong>"${eventData.title}"</strong>.</p>
        ${getEventDetailsHtml(eventData)}
        <div class="alert-box alert-info" style="margin-top: 24px;">
          <p style="margin: 0; font-size: 14px; font-weight: 600; margin-bottom: 8px;">📋 Manager Responsibilities</p>
          <p style="margin: 0; font-size: 13px; line-height: 1.5;">Please log into the portal to review the schedule and confirm your acceptance of this assignment.</p>
        </div>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard`
    });
  },

  managerAcceptedTemplate: (eventData, managerEmail) => {
    return buildBaseTemplate({
      title: 'Manager Accepted Assignment',
      subtitle: 'Event Management Team Updated',
      headerBg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      preheader: `Good news! ${managerEmail} accepted management of '${eventData.title}'`,
      contentHtml: `
        <div class="alert-box alert-success">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Assignment Confirmed</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">The assigned manager (<strong>${managerEmail}</strong>) has officially accepted their role for <strong>"${eventData.title}"</strong>.</p>
        </div>
        ${getEventDetailsHtml(eventData)}
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/events/${eventData.id || ''}`
    });
  },

  managerDeclinedTemplate: (eventData, managerEmail) => {
    return buildBaseTemplate({
      title: 'Manager Declined Assignment',
      subtitle: 'Action Required: Reassign Manager',
      headerBg: 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)',
      preheader: `Alert: ${managerEmail} declined management of '${eventData.title}'`,
      contentHtml: `
        <div class="alert-box alert-error">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Assignment Declined</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">The assigned manager (<strong>${managerEmail}</strong>) has declined their role for <strong>"${eventData.title}"</strong>.</p>
        </div>
        ${getEventDetailsHtml(eventData)}
        <p style="margin: 20px 0 0; font-size: 14px; color: #b91c1c; font-weight: bold;">Please log into the portal and assign an alternative manager immediately.</p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/events/${eventData.id || ''}`
    });
  },

  // ─────────────────────────────────────────────────────────────────
  // POSTPONEMENT & CANCELLATION WORKFLOW TEMPLATES (#8 to #15)
  // ─────────────────────────────────────────────────────────────────

  postponementApprovalRequestTemplate: (eventData, reason, newDate) => {
    return buildBaseTemplate({
      title: 'Event Postponement Request',
      subtitle: 'Requires HOD Approval',
      headerBg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
      preheader: `Action Required: Review postponement request for '${eventData.title}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">An event postponement request has been submitted by the organizer and requires your review.</p>
        ${getEventDetailsHtml(eventData)}
        <div style="margin-top: 20px; background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #b45309;">Proposed New Date: ${newDate || 'Not specified'}</p>
          <p style="margin: 0; font-size: 14px; color: #78350f; font-style: italic;">Reason: "${reason || 'No reason provided'}"</p>
        </div>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/approvals/events/${eventData.id || ''}`
    });
  },

  postponementRequestToIQACTemplate: (eventData, reason, newDate) => {
    return buildBaseTemplate({
      title: 'Event Postponement Request',
      subtitle: 'Requires IQAC Final Approval',
      headerBg: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
      preheader: `IQAC Review: Postponement request for '${eventData.title}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">The HOD has approved a postponement request for the following event, which now awaits final IQAC approval.</p>
        ${getEventDetailsHtml(eventData)}
        <div style="margin-top: 20px; background-color: #f0f9ff; border: 1px solid #7dd3fc; border-radius: 8px; padding: 16px;">
          <p style="margin: 0 0 8px; font-weight: 600; color: #0369a1;">Proposed New Date: ${newDate || 'Not specified'}</p>
          <p style="margin: 0; font-size: 14px; color: #0c4a6e; font-style: italic;">Reason: "${reason || 'No reason provided'}"</p>
        </div>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/approvals/events/${eventData.id || ''}`
    });
  },

  postponementApprovedTemplate: (eventData, roleLabel = 'Stakeholder') => {
    return buildBaseTemplate({
      title: 'Event Postponed',
      subtitle: 'Official Institutional Notice',
      headerBg: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
      preheader: `Notice: Event '${eventData.title}' has been officially postponed.`,
      contentHtml: `
        <div class="alert-box alert-warning">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Event Officially Postponed</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Please note that <strong>"${eventData.title}"</strong> has been postponed after institutional review. Previous attendance records have been cleared and will be taken on the new date.</p>
        </div>
        ${getEventDetailsHtml(eventData)}
        <div style="margin-top: 20px; padding: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;">
          <p style="margin: 0; font-size: 13px; color: #334155;"><strong>Reason:</strong> ${eventData.postponementReason || 'Administrative reschedule'}</p>
          <p style="margin: 4px 0 0; font-size: 13px; color: #334155;"><strong>New Schedule:</strong> ${eventData.newDate || eventData.date || 'TBA'}</p>
        </div>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/events/${eventData.id || ''}`
    });
  },

  postponementRejectedTemplate: (eventData, reason) => {
    return buildBaseTemplate({
      title: 'Postponement Request Rejected',
      subtitle: 'Event Schedule Remains Unchanged',
      headerBg: 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)',
      preheader: `Update: Postponement request for '${eventData.title}' was rejected.`,
      contentHtml: `
        <div class="alert-box alert-error">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Postponement Rejected</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Your request to postpone <strong>"${eventData.title}"</strong> could not be accommodated. The event must proceed as originally scheduled.</p>
        </div>
        ${getEventDetailsHtml(eventData)}
        <p style="margin: 16px 0 0; font-size: 14px; color: #b91c1c; font-style: italic;">Rejection Reason: "${reason || 'Administrative decision'}"</p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/events/${eventData.id || ''}`
    });
  },

  cancellationApprovalRequestTemplate: (eventData, reason) => {
    return buildBaseTemplate({
      title: 'Event Cancellation Request',
      subtitle: 'Requires HOD Approval',
      headerBg: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
      preheader: `Action Required: Review cancellation request for '${eventData.title}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">An event cancellation request has been submitted by the organizer and requires your review.</p>
        ${getEventDetailsHtml(eventData)}
        <div style="margin-top: 20px; background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 14px; color: #991b1b; font-style: italic;">Reason: "${reason || 'No reason provided'}"</p>
        </div>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/approvals/events/${eventData.id || ''}`
    });
  },

  cancellationRequestToIQACTemplate: (eventData, reason) => {
    return buildBaseTemplate({
      title: 'Event Cancellation Request',
      subtitle: 'Requires IQAC Final Approval',
      headerBg: 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)',
      preheader: `IQAC Review: Cancellation request for '${eventData.title}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">The HOD has endorsed an event cancellation request, which now awaits final IQAC approval.</p>
        ${getEventDetailsHtml(eventData)}
        <div style="margin-top: 20px; background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; font-size: 14px; color: #991b1b; font-style: italic;">Reason: "${reason || 'No reason provided'}"</p>
        </div>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/approvals/events/${eventData.id || ''}`
    });
  },

  cancellationApprovedTemplate: (eventData, roleLabel = 'Stakeholder') => {
    return buildBaseTemplate({
      title: 'Event Cancelled',
      subtitle: 'Official Institutional Cancellation Notice',
      headerBg: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
      preheader: `Notice: Event '${eventData.title}' has been permanently cancelled.`,
      contentHtml: `
        <div class="alert-box alert-error">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Event Permanently Cancelled</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Please be advised that <strong>"${eventData.title}"</strong> has been officially cancelled after institutional review. All registrations and logistics bookings are voided.</p>
        </div>
        ${getEventDetailsHtml(eventData)}
        <div style="margin-top: 20px; padding: 12px; background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b;"><strong>Cancellation Reason:</strong> ${eventData.cancellationReason || 'Administrative cancellation'}</p>
        </div>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard`
    });
  },

  cancellationRejectedTemplate: (eventData, reason) => {
    return buildBaseTemplate({
      title: 'Cancellation Request Rejected',
      subtitle: 'Event Must Proceed as Scheduled',
      headerBg: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
      preheader: `Update: Cancellation request for '${eventData.title}' was rejected.`,
      contentHtml: `
        <div class="alert-box alert-info">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Cancellation Rejected</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Your request to cancel <strong>"${eventData.title}"</strong> was not approved by institutional approvers. The event remains active.</p>
        </div>
        ${getEventDetailsHtml(eventData)}
        <p style="margin: 16px 0 0; font-size: 14px; color: #334155; font-style: italic;">Rejection Reason: "${reason || 'Administrative decision'}"</p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/events/${eventData.id || ''}`
    });
  },

  // ─────────────────────────────────────────────────────────────────
  // ACCOUNT SECURITY TEMPLATES
  // ─────────────────────────────────────────────────────────────────

  /* @legacy @disabled (In-App / WhatsApp Only) */
  loginAlertTemplate: (user, reqDetails) => {
    return buildBaseTemplate({
      title: 'New Login Detected',
      subtitle: 'Account Security Alert',
      headerBg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      preheader: 'A successful login to your account was detected.',
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">Dear ${safeVal(user.name, 'User')},</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">
          A successful login to your Event Management & IQAC Portal account has been detected.
        </p>

        <h4 style="margin: 24px 0 12px; color: #1e293b; font-size: 14px; text-transform: uppercase;">Account Information</h4>
        <table class="table-details" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; width: 40%;">Name</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.name)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Role</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.role)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Department</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.department)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Roll Number / ID</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${safeVal(user.rollNo || user.employeeId || user.id)}</td></tr>
        </table>

        <h4 style="margin: 24px 0 12px; color: #1e293b; font-size: 14px; text-transform: uppercase;">Login Details</h4>
        <table class="table-details" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; width: 40%;">Date</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reqDetails.date}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Time</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reqDetails.time}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Browser</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reqDetails.browser}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Operating System</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reqDetails.os}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">IP Address</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${reqDetails.ip}</td></tr>
        </table>

        <p style="margin: 20px 0 0; font-size: 14px; color: #b91c1c; font-weight: bold;">
          If this login was not performed by you, immediately change your password and contact IQAC.
        </p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/security`
    });
  },

  passwordChangeOtpTemplate: (user, otp) => {
    return buildBaseTemplate({
      title: 'Password Change Verification',
      subtitle: 'Event Management & IQAC Portal',
      headerBg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
      preheader: 'Your OTP for password change.',
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">Dear ${safeVal(user.name, 'User')},</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">
          A password change request has been received for your account.
        </p>
        <div style="margin: 24px 0; padding: 20px; background-color: #fffbeb; border: 1px dashed #fcd34d; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 14px; font-weight: bold; color: #b45309; text-transform: uppercase; letter-spacing: 1px;">Your OTP Code</p>
          <div style="font-size: 32px; font-weight: 800; color: #d97706; letter-spacing: 4px; font-family: monospace;">${otp}</div>
          <p style="margin: 8px 0 0; font-size: 12px; color: #92400e;">This OTP is valid for 1 minute only.</p>
        </div>
        <p style="margin: 20px 0 0; font-size: 14px; color: #b91c1c; font-weight: bold;">
          If this request was not made by you, contact IQAC immediately.
        </p>
      `
    });
  },

  passwordChangeSuccessTemplate: (user, date, time) => {
    return buildBaseTemplate({
      title: 'Password Successfully Changed',
      subtitle: 'Security Update',
      headerBg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      preheader: 'Your account password has been updated.',
      contentHtml: `
        <div class="alert-box alert-success" style="margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Password Updated</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Your password has been successfully changed.</p>
        </div>
        <table class="table-details" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; width: 40%;">Name</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.name)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Role</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.role)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Department</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.department)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Roll Number / ID</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${safeVal(user.rollNo || user.employeeId || user.id)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Date</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${date}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Time</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${time}</td></tr>
        </table>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/security`
    });
  },

  passwordResetOtpTemplate: (user, otp) => {
    return buildBaseTemplate({
      title: 'Password Reset Verification',
      subtitle: 'Account Recovery',
      headerBg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
      preheader: 'Your OTP for password recovery.',
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">Dear ${safeVal(user.name, 'User')},</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.6;">
          A password reset request has been received for your account.
        </p>
        <div style="margin: 24px 0; padding: 20px; background-color: #eef2ff; border: 1px dashed #c7d2fe; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 14px; font-weight: bold; color: #4338ca; text-transform: uppercase; letter-spacing: 1px;">Your Reset OTP</p>
          <div style="font-size: 32px; font-weight: 800; color: #4f46e5; letter-spacing: 4px; font-family: monospace;">${otp}</div>
          <p style="margin: 8px 0 0; font-size: 12px; color: #3730a3;">This OTP is valid for 1 minute only.</p>
        </div>
        <p style="margin: 20px 0 0; font-size: 14px; color: #b91c1c; font-weight: bold;">
          If you did not initiate this request, contact IQAC immediately.
        </p>
      `
    });
  },

  passwordResetSuccessTemplate: (user, date, time) => {
    return buildBaseTemplate({
      title: 'Password Successfully Reset',
      subtitle: 'Account Recovery Success',
      headerBg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      preheader: 'Your account password has been reset.',
      contentHtml: `
        <div class="alert-box alert-success" style="margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Password Reset</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Your password has been successfully reset.</p>
        </div>
        <table class="table-details" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; width: 40%;">Name</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.name)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Role</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.role)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Department</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.department)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Roll Number / ID</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${safeVal(user.rollNo || user.employeeId || user.id)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Date</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${date}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Time</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${time}</td></tr>
        </table>
      `,
      actionUrl: `${FRONTEND_URL}/login`
    });
  },

  /* @legacy @disabled (In-App / WhatsApp Only) */
  suspiciousLoginTemplate: (user, reqDetails) => {
    return buildBaseTemplate({
      title: 'Security Alert - New Device Login Detected',
      subtitle: 'Action Required',
      headerBg: 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)',
      preheader: 'Login detected from an unrecognized device or environment.',
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">Dear ${safeVal(user.name, 'User')},</p>
        <div class="alert-box alert-error" style="margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Suspicious Login Detected</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">A login has been detected from a device or environment that has not been previously used.</p>
        </div>
        <table class="table-details" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; width: 40%;">Name</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.name)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Role</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.role)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Department</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.department)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Date</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reqDetails.date}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Time</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reqDetails.time}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Browser</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reqDetails.browser}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Operating System</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reqDetails.os}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">IP Address</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${reqDetails.ip}</td></tr>
        </table>
        <p style="margin: 20px 0 0; font-size: 14px; color: #b91c1c; font-weight: bold;">
          If this was not you, immediately change your password and contact IQAC.
        </p>
      `,
      actionUrl: `${FRONTEND_URL}/dashboard/security`
    });
  },

  accountLockedTemplate: (user, reqDetails, lockDuration) => {
    return buildBaseTemplate({
      title: 'Account Temporarily Locked',
      subtitle: 'Security Protection Triggered',
      headerBg: 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)',
      preheader: 'Your account has been locked due to multiple failed logins.',
      contentHtml: `
        <div class="alert-box alert-error" style="margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Account Locked</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Reason: Multiple unsuccessful login attempts detected.</p>
        </div>
        <table class="table-details" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; width: 40%;">Name</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.name)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Role</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.role)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Department</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${safeVal(user.department)}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Date</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reqDetails.date}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Time</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${reqDetails.time}</td></tr>
          <tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Lock Duration</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #b91c1c;">${lockDuration} Minutes</td></tr>
        </table>
        <p style="margin: 20px 0 0; font-size: 14px; color: #475569;">
          Please wait for the lock duration to expire before attempting to log in again. If you continue to face issues, you may use the "Forgot Password" option or contact the ICTS Team.
        </p>
      `,
      actionUrl: `${FRONTEND_URL}/login`
    });
  },

  /* @legacy @disabled (In-App / WhatsApp Only) */
  feedbackReminderTemplate: ({ studentName, eventName, reminderType, link }) => {
    const isUrgent = reminderType === '72h';
    return buildBaseTemplate({
      title: 'Action Required: Event Feedback',
      subtitle: isUrgent ? 'Final Reminder' : 'Reminder',
      headerBg: isUrgent ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
      preheader: `Pending feedback for '${eventName}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a;">Dear ${safeVal(studentName, 'Student')},</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #334155; line-height: 1.6;">
          This is an automated reminder that your feedback for the event <strong>${eventName}</strong> is still pending. 
          As per institutional policy, student feedback is mandatory for all attended events.
        </p>
        <div class="alert-box ${isUrgent ? 'alert-error' : 'alert-warning'}" style="margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">Important Notice</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">
            Until feedback is submitted, your participation certificate and event completion status will remain blocked on the portal.
          </p>
        </div>
        <p style="margin: 20px 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">If you have already submitted your feedback, please disregard this email.</p>
      `,
      actionUrl: link || `${FRONTEND_URL}/dashboard`
    });
  },

  /* @legacy @disabled (In-App / WhatsApp Only) */
  certificateReadyTemplate: (student, eventData, certificateLink) => {
    const studentName = student?.name || 'Student';
    const eventName = eventData?.title || eventData?.eventName || 'Event';
    return baseLayout({
      title: 'Participation Certificate Ready',
      previewText: `Your certificate for ${eventName} is now available!`,
      headerTitle: 'Certificate Available',
      badgeText: 'Certificate Ready',
      badgeColor: '#10b981',
      content: `
        <p style="margin-top: 0;">Dear <strong>${studentName}</strong>,</p>
        <p>Thank you for your active participation in <strong>${eventName}</strong> and for completing the feedback process.</p>
        <p>Your official participation certificate is now ready for download from your student dashboard.</p>
      `,
      actionText: 'Download Certificate',
      actionUrl: certificateLink || `${FRONTEND_URL}/dashboard/certificates`
    });
  },

  studentRegistrationReminderTemplate: (eventData, isApproved, reason = '') => {
    const eventId = eventData?.id || eventData?.eventId || '';
    if (isApproved) {
      return buildBaseTemplate({
        title: 'Event Registration Approved',
        subtitle: 'Starting in 30 Minutes',
        headerBg: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        preheader: `Your registration for ${safeVal(eventData?.title, 'the event')} is approved. Event starts soon!`,
        contentHtml: `
          <p style="margin: 0 0 16px; line-height: 1.6; font-size: 15px;">Your registration for the upcoming event <strong>${safeVal(eventData?.title, 'Event')}</strong> has been <strong>APPROVED</strong>. The event is scheduled to begin in approximately 30 minutes.</p>
          ${getEventDetailsHtml(eventData || {})}
          <div class="alert-box alert-success">
            <p style="margin: 0; font-size: 14px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">🎉 Ready to Attend</p>
            <p style="margin: 0; font-size: 14px; line-height: 1.5;">Please report to the venue on time. Your official On-Duty (OD) letter is now available for download from the portal.</p>
          </div>
        `,
        actionUrl: portalLinks.odLetter(eventId),
        eventReferenceId: eventData?.referenceId || null
      });
    } else {
      return buildBaseTemplate({
        title: 'Event Registration Status',
        subtitle: 'Registration Update',
        headerBg: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
        preheader: `Update regarding your registration for ${safeVal(eventData?.title, 'the event')}.`,
        contentHtml: `
          <p style="margin: 0 0 16px; line-height: 1.6; font-size: 15px;">We regret to inform you that your registration for <strong>${safeVal(eventData?.title, 'Event')}</strong> could not be approved at this time.</p>
          ${reason ? `<div class="alert-box alert-error"><p style="margin: 0; font-weight: 600; margin-bottom: 4px;">Reason for Rejection:</p><p style="margin: 0;">${reason}</p></div>` : ''}
          <p style="margin: 16px 0 0; line-height: 1.6; font-size: 14px;">You may view your registration details or explore other upcoming events on the portal.</p>
        `,
        actionUrl: portalLinks.registration(eventId),
        eventReferenceId: eventData?.referenceId || null
      });
    }
  },

  registrationApprovedFinalizedTemplate: (student, eventData) => {
    const safeName = safeVal(student?.name, 'Student');
    const eventId = eventData?.id || eventData?.eventId || '';
    return buildBaseTemplate({
      title: 'Registration Confirmed',
      subtitle: safeVal(eventData?.title, 'Event'),
      headerBg: 'linear-gradient(135deg, #10b981 0%, #064e3b 100%)',
      preheader: `Congratulations! Your registration for ${safeVal(eventData?.title, 'the event')} has been confirmed.`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 16px; color: #0f172a;">Dear <strong>${safeName}</strong>,</p>
        <div class="alert-box alert-success" style="margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">🎉 Registration Confirmed</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Congratulations! Your registration for the event has been officially approved and finalized.</p>
        </div>
        ${getEventDetailsHtml(eventData || {})}
        <p style="margin: 24px 0 0; line-height: 1.6; font-size: 15px; color: #0f172a; font-weight: 600;">See you there.</p>
      `,
      actionUrl: portalLinks.registration(eventId),
      eventReferenceId: getEventRef(eventData || {})
    });
  },

  registrationRejectedFinalizedTemplate: (student, eventData, customReason) => {
    const safeName = safeVal(student?.name, 'Student');
    const eventId = eventData?.id || eventData?.eventId || '';
    const reason = safeVal(customReason, 'Unfortunately, due to limited seats and the high volume of applications received, your registration could not be accommodated at this time.');
    return buildBaseTemplate({
      title: 'Registration Update',
      subtitle: safeVal(eventData?.title, 'Event'),
      headerBg: 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)',
      preheader: `Update regarding your registration for ${safeVal(eventData?.title, 'the event')}.`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 16px; color: #0f172a;">Dear <strong>${safeName}</strong>,</p>
        <p style="margin: 0 0 24px; line-height: 1.6; font-size: 15px; color: #334155;">We regret to inform you that your registration for <strong>"${safeVal(eventData?.title, 'the event')}"</strong> has not been approved.</p>
        <div class="alert-box alert-error" style="margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px; font-weight: 600; margin-bottom: 8px;">Registration Status Update</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">${reason}</p>
        </div>
        ${getEventDetailsHtml(eventData || {})}
        <p style="margin: 24px 0 0; line-height: 1.6; font-size: 15px; color: #334155;">Thank you for applying. We encourage you to explore other upcoming events on the portal and wish you the best in future opportunities.</p>
      `,
      actionUrl: portalLinks.registration(eventId),
      eventReferenceId: getEventRef(eventData || {})
    });
  },

  registrationWaitlistedFinalizedTemplate: (student, eventData, waitlistPosition) => {
    const safeName = safeVal(student?.name, 'Student');
    const eventId = eventData?.id || eventData?.eventId || '';
    return buildBaseTemplate({
      title: 'Registration Waitlist Update',
      subtitle: safeVal(eventData?.title, 'Event'),
      headerBg: 'linear-gradient(135deg, #f59e0b 0%, #78350f 100%)',
      preheader: `You are on the waitlist for ${safeVal(eventData?.title, 'the event')}.`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 16px; color: #0f172a;">Dear <strong>${safeName}</strong>,</p>
        <div class="alert-box alert-warning" style="margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">📋 You Are on the Waitlist</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">Your current waitlist position is: <strong style="font-size: 18px; color: #92400e;">#${safeVal(waitlistPosition, 'N/A')}</strong></p>
        </div>
        ${getEventDetailsHtml(eventData || {})}
        <p style="margin: 24px 0 0; line-height: 1.6; font-size: 15px; color: #334155;">If a seat opens up due to a cancellation, you will be notified immediately via email. We appreciate your patience and interest in this event.</p>
      `,
      actionUrl: portalLinks.registration(eventId),
      eventReferenceId: getEventRef(eventData || {})
    });
  }
};
