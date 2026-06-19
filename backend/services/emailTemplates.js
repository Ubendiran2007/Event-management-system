const SECE_HEADER_IMG = "https://sece.ac.in/wp-content/uploads/2023/10/sece-logo.png"; // Example or placeholder if needed

function buildBaseTemplate({ title, subtitle, headerBg = '#1e293b', headerTextColor = '#ffffff', contentHtml, preheader = '' }) {
  const currentYear = new Date().getFullYear();
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
        .footer { background-color: #0f172a; padding: 24px 32px; text-align: center; border-top: 1px solid #1e293b; }
        .footer p { margin: 0 0 8px 0; color: #94a3b8; font-size: 12px; line-height: 1.5; }
        .footer .copyright { color: #64748b; font-size: 11px; }
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
          <tr>
            <td class="content">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p>This is an automated email from the Sri Eshwar College of Engineering<br>Event Management & IQAC Portal.</p>
              <p class="copyright">© ${currentYear} Sri Eshwar College of Engineering, Coimbatore. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </center>
    </body>
    </html>
  `;
}

// Helper to format event references securely
const getEventRef = (event) => event.eventReference || event.iqacNumber || event.eventCode || (event.id ? `EVT-${String(event.id).slice(-6).toUpperCase()}` : 'N/A');
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
      <tr><td>Event Reference</td><td style="font-family: monospace;">${getEventRef(eventData)}</td></tr>
      <tr><td>Event Title</td><td style="font-weight: 700;">${eventData.title || 'Not specified'}</td></tr>
      <tr><td>Event Type</td><td>${eventData.eventType || 'Not specified'}</td></tr>
      <tr><td>Date</td><td>${eventData.date || 'Not specified'}</td></tr>
      <tr><td>Time</td><td>${eventData.startTime ? formatTime(eventData.startTime) + ' - ' + (eventData.endTime ? formatTime(eventData.endTime) : 'TBD') : 'Not specified'}</td></tr>
      <tr><td>Venue</td><td>${eventData.venue || 'Not specified'}</td></tr>
      <tr><td>Organizer</td><td>${eventData.organizerName || 'Not specified'} (${eventData.organizingDepartment || 'N/A'})</td></tr>
    </table>
  </div>
`;

module.exports = {
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
      `
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
      `
    });
  },

  eventStatusTemplate: (eventData, statusInfo, rejectionReason) => {
    const isRejected = statusInfo.title.toLowerCase().includes('reject');
    const headerBg = isRejected ? 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)' : 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)';
    return buildBaseTemplate({
      title: statusInfo.title,
      subtitle: 'Event Status Update',
      headerBg,
      preheader: `Update for '${eventData.title}': ${statusInfo.message}`,
      contentHtml: `
        <div class="alert-box ${isRejected ? 'alert-error' : 'alert-info'}">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">${eventData.title}</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">${statusInfo.message}</p>
        </div>
        ${rejectionReason ? `
          <div style="margin-top: 20px;">
            <h4 style="margin: 0 0 8px; color: #0f172a; font-size: 15px;">Reason for Rejection:</h4>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; color: #475569; font-style: italic; font-size: 14px; line-height: 1.6;">
              "${rejectionReason}"
            </div>
            <p style="margin: 16px 0 0; font-size: 14px; color: #475569;">Please review the feedback, make necessary adjustments, and resubmit your proposal.</p>
          </div>
        ` : ''}
      `
    });
  },

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
      `
    });
  },

  posterReadyTemplate: (eventData) => {
    return buildBaseTemplate({
      title: 'Poster Ready',
      subtitle: 'Media Team has uploaded the design',
      headerBg: 'linear-gradient(135deg, #10b981 0%, #064e3b 100%)',
      preheader: `Poster uploaded for '${eventData.title}'`,
      contentHtml: `
        <div class="alert-box alert-success">
          <p style="margin: 0; font-size: 15px; font-weight: 600; margin-bottom: 8px;">The poster for your event is ready!</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">The Media Team has completed and uploaded the poster for <strong>${eventData.title}</strong>.</p>
        </div>
        <p style="margin: 20px 0 0; font-size: 14px; color: #475569; line-height: 1.6;">Please log into the portal to review the design and finalize the event details.</p>
      `
    });
  },

  studentRegistrationTemplate: (studentName, eventData, status, isApproved) => {
    const headerBg = isApproved ? 'linear-gradient(135deg, #10b981 0%, #064e3b 100%)' : 'linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%)';
    return buildBaseTemplate({
      title: `Registration ${isApproved ? 'Approved' : 'Rejected'}`,
      subtitle: eventData.title,
      headerBg,
      preheader: `Your registration for ${eventData.title} has been ${status.toLowerCase()}`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 16px; color: #0f172a;">Dear <strong>${studentName}</strong>,</p>
        <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.6;">Your registration request for the event <strong>"${eventData.title}"</strong> has been <strong style="color: ${isApproved ? '#10b981' : '#ef4444'}">${status.toLowerCase()}</strong>.</p>
        
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
      `
    });
  },

  feedbackRequestTemplate: (studentName, eventData, feedbackLink) => {
    return buildBaseTemplate({
      title: 'Feedback Requested',
      subtitle: 'Help us improve future events',
      headerBg: 'linear-gradient(135deg, #f59e0b 0%, #78350f 100%)',
      preheader: `Please share your feedback for '${eventData.title}'`,
      contentHtml: `
        <p style="margin: 0 0 16px; font-size: 16px; color: #0f172a;">Dear <strong>${studentName}</strong>,</p>
        <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.6;">Thank you for participating in <strong>"${eventData.title}"</strong>. We hope you had a great experience!</p>
        <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.6;">To help us improve the quality of future programs, please take a few minutes to share your feedback.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${feedbackLink}" class="btn" style="background-color: #f59e0b; color: #fff;">Submit Your Feedback</a>
        </div>
      `
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
      `
    });
  },

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
      `
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
      `
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
      `
    });
  }
};
