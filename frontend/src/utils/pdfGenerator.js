import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import seceHeader from '../assets/sece header.jpeg';
import { formatRollNo, formatEventRef, fallbackValue } from './formatters';

/**
 * Generates an OD Letter PDF and returns it as a Base64 string.
 * This uses a hidden DOM element to render the letter and capture it.
 * Style matches the official ODLetterModal.
 */
export const generateODLetterBase64 = async (odRequest, event) => {
  try {
    const displayRollNo = formatRollNo(odRequest?.rollNo, odRequest?.studentId) || 'N/A';
    const formatClassSection = (value) =>
      String(value || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const displayClassSection = formatClassSection(odRequest?.class || odRequest?.section) || 'N/A';

    const eventTitle = fallbackValue(odRequest?.eventTitle || odRequest?.eventName || event?.title, 'Not Provided');
    const eventVenue = fallbackValue(odRequest?.eventVenue || odRequest?.venue || event?.venue, 'Not Specified');
    const eventRef   = formatEventRef(event);
    const s1 = event?.requisition?.step1;
    
    const formatDate = (dateStr) => {
      if (!dateStr || dateStr === 'N/A') return 'N/A';
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateStr;
    };

    let eventDate = formatDate(odRequest?.eventDate || 'N/A');
    if (s1?.eventStartDate && s1?.eventEndDate && s1.eventStartDate !== s1.eventEndDate) {
      eventDate = `${formatDate(s1.eventStartDate)} - ${formatDate(s1.eventEndDate)}`;
    }

    const approvedBy = odRequest?.approvedBy || odRequest?.organizerName || 'Event Organizer';
    const hodName = odRequest?.hodName || 'Dr. Head of Department';
    const approvedAt = odRequest?.approvedAt
      ? new Date(odRequest.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const issuedDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    
    const verificationCode = odRequest
      ? `ODV-${(odRequest.id || 'NA').slice(-6).toUpperCase()}-${new Date(odRequest.approvedAt || Date.now()).getTime().toString().slice(-6)}`
      : '';

    const isCancelled = odRequest?.status === 'OD_CANCELLED' || odRequest?.status === 'CANCELLED';

    // Build QR payload
    const qrPayload = [
      `OD VERIFICATION`,
      `Student : ${odRequest.studentName}`,
      `Roll No : ${displayRollNo}`,
      `Class   : ${displayClassSection}`,
      `Event   : ${eventTitle}`,
      `Event Ref: ${eventRef}`,
      `Date    : ${eventDate}`,
      `Venue   : ${eventVenue}`,
      `Status  : ${isCancelled ? 'CANCELLED' : 'APPROVED'}`,
      `Code    : ${verificationCode}`,
      `Issued  : ${issuedDate}`,
      isCancelled ? `\nThis OD Letter is no longer valid.` : ''
    ].filter(Boolean).join('\n');

    // Generate QR Data URL
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      width: 180,
      margin: 1,
      color: { dark: '#1a3a6b', light: '#ffffff' },
    });

    // Create a temporary hidden container for the letter
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm'; // A4 width
    container.style.backgroundColor = 'white';
    document.body.appendChild(container);

    // High-quality HTML matching the modal
    container.innerHTML = `
      <div style="width: 210mm; padding: 10mm 15mm; font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.5; background: white;">
        <!-- Header -->
        <div style="border-bottom: 3px double #1a3a6b; padding-bottom: 10px; margin-bottom: 10px; text-align: center;">
          <img src="${seceHeader}" style="width: 100%; max-height: 90px; object-fit: contain; display: block;" />
          <div style="font-size: 11pt; font-weight: bold; color: #2c5282; margin-top: 5px;">Department of Computer Science and Engineering</div>
        </div>

        <!-- Title -->
        <h3 style="text-align: center; text-decoration: underline; margin: 15px 0; font-size: 13pt; color: #1a3a6b; text-transform: uppercase;">ON DUTY (OD) PERMISSION LETTER</h3>

        <!-- Ref / Date -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 10.5pt;">
          <span>Ref No: CSE/OD/${new Date().getFullYear()}/${(odRequest.id || 'XXXXX').slice(-6).toUpperCase()}</span>
          <span>Date: ${issuedDate}</span>
        </div>

        <!-- Addressee -->
        <div style="margin-bottom: 15px; font-size: 11pt;">
          To,<br/>
          <strong>The Class Advisor,</strong><br/>
          Department of Computer Science and Engineering,<br/>
          Sri Eshwar College of Engineering, Coimbatore.
        </div>

        <!-- Subject -->
        <div style="margin-bottom: 15px; font-size: 11pt;">
          <strong>Sub:</strong> Permission for On Duty (OD) – Attendance of Department Event – regarding.
        </div>

        <p style="font-size: 11pt;">Dear Sir / Madam,</p>
        <p style="font-size: 11pt; text-align: justify;">
          This is to certify that the student mentioned below has been granted <strong>On Duty (OD)</strong> 
          permission to attend the department event organised by the Department of Computer Science and 
          Engineering, Sri Eshwar College of Engineering. The registration for this event was duly reviewed 
          and <strong>approved by the Event Organizer</strong> on <strong>${approvedAt}</strong> through 
          the CSE Event Management Portal.
        </p>

        <p style="font-size: 11pt; margin-top: 10px;">
          Kindly mark the student as <strong>On Duty</strong> in the attendance register for the date(s) 
          of the event mentioned below, and grant the necessary permission accordingly.
        </p>

        <!-- Details Table -->
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 10.5pt;">
          <tr><td style="padding: 6px 10px; border: 1px solid #bcd; font-weight: bold; background: #f0f4f8; width: 35%;">Student Name</td><td style="padding: 6px 10px; border: 1px solid #bcd;">${odRequest.studentName}</td></tr>
          <tr><td style="padding: 6px 10px; border: 1px solid #bcd; font-weight: bold; background: #f0f4f8;">Roll Number</td><td style="padding: 6px 10px; border: 1px solid #bcd;">${displayRollNo}</td></tr>
          <tr><td style="padding: 6px 10px; border: 1px solid #bcd; font-weight: bold; background: #f0f4f8;">Class / Section</td><td style="padding: 6px 10px; border: 1px solid #bcd;">${displayClassSection}</td></tr>
          <tr><td style="padding: 6px 10px; border: 1px solid #bcd; font-weight: bold; background: #f0f4f8;">Email</td><td style="padding: 6px 10px; border: 1px solid #bcd;">${fallbackValue(odRequest.email, 'email')}</td></tr>
          <tr><td style="padding: 6px 10px; border: 1px solid #bcd; font-weight: bold; background: #f0f4f8;">Event Name</td><td style="padding: 6px 10px; border: 1px solid #bcd;">${eventTitle}</td></tr>
          <tr><td style="padding: 6px 10px; border: 1px solid #bcd; font-weight: bold; background: #f0f4f8;">Event Ref ID</td><td style="padding: 6px 10px; border: 1px solid #bcd; font-family: monospace;">${eventRef}</td></tr>
          <tr><td style="padding: 6px 10px; border: 1px solid #bcd; font-weight: bold; background: #f0f4f8;">Event Date</td><td style="padding: 6px 10px; border: 1px solid #bcd;">${eventDate}</td></tr>
          <tr><td style="padding: 6px 10px; border: 1px solid #bcd; font-weight: bold; background: #f0f4f8;">Venue</td><td style="padding: 6px 10px; border: 1px solid #bcd;">${eventVenue}</td></tr>
          <tr><td style="padding: 6px 10px; border: 1px solid #bcd; font-weight: bold; background: #f0f4f8;">Approved By</td><td style="padding: 6px 10px; border: 1px solid #bcd;">${approvedBy}</td></tr>
          <tr><td style="padding: 6px 10px; border: 1px solid #bcd; font-weight: bold; background: #f0f4f8;">OD Status</td><td style="padding: 6px 10px; border: 1px solid #bcd; color: ${isCancelled ? '#d9534f' : '#1a6b3a'}; font-weight: bold;">${isCancelled ? '&#10008; CANCELLED' : '&#10004; APPROVED'}</td></tr>
        </table>

        <p style="font-size: 11pt;">Your kind cooperation in this regard is highly appreciated.</p>
        <p style="font-size: 11pt; margin-top: 5px;">Thanking you,<br/>Yours faithfully,</p>

        <!-- Signatures -->
        <div style="margin-top: 50px; display: flex; justify-content: space-between; gap: 10px;">
          <div style="text-align: center; flex: 1;">
            <div style="border-top: 1.5px solid #333; margin-top: 30px; padding-top: 5px; font-size: 9pt;"><strong>Student Signature</strong><br/>${odRequest.studentName}<br/>${displayRollNo}</div>
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="border-top: 1.5px solid #333; margin-top: 30px; padding-top: 5px; font-size: 9pt;"><strong>Class Advisor</strong><br/>(Physical Signature)</div>
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="border-top: 1.5px solid #333; margin-top: 30px; padding-top: 5px; font-size: 9pt;"><strong>Event Organizer</strong><br/>${approvedBy}</div>
          </div>
          <div style="text-align: center; flex: 1;">
            <div style="border-top: 1.5px solid #333; margin-top: 30px; padding-top: 5px; font-size: 9pt;"><strong>HOD / Principal</strong><br/>${hodName}</div>
          </div>
        </div>

        <!-- Verification Row -->
        <div style="margin-top: 25px; display: flex; gap: 15px; align-items: flex-start; padding: 10px; border: 1px solid #c9dbf3; background: #f5f9ff; border-radius: 8px;">
          <div style="flex-shrink: 0;">
            <img src="${qrDataUrl}" style="width: 80px; height: 80px; border: 1px solid #aac; border-radius: 4px;" />
          </div>
          <div style="flex: 1; font-size: 8.5pt; color: #234; line-height: 1.4;">
            <strong>Verification Details</strong><br/>
            This letter is generated via the CSE Event Management Portal. Scanning the QR code will display student and event details for instant on-site verification.
            <div style="margin-top: 5px; font-family: monospace; font-weight: bold; color: #1a3a6b;">Verification Code: ${verificationCode}</div>
          </div>
        </div>

        <div style="margin-top: 20px; font-size: 8pt; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 5px;">
          This is a system-generated e-letter from the CSE Event Management Portal &middot; Sri Eshwar College of Engineering
        </div>
      </div>
    `;

    // Use html2canvas to capture the container
    const canvas = await html2canvas(container, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollY: -window.scrollY,
      windowWidth: container.scrollWidth,
      windowHeight: container.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgRatio = imgProps.width / imgProps.height;
    
    let renderWidth = pdfWidth;
    let renderHeight = pdfWidth / imgRatio;
    
    // If the image is taller than the A4 page, scale it down to fit
    if (renderHeight > pdfHeight) {
      renderHeight = pdfHeight;
      renderWidth = renderHeight * imgRatio;
    }
    
    // Center horizontally if scaled down by height
    const xOffset = (pdfWidth - renderWidth) / 2;
    const yOffset = 0;

    pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderWidth, renderHeight);
    
    document.body.removeChild(container);

    return pdf.output('datauristring');
  } catch (error) {
    console.error('Error generating OD PDF:', error);
    if (document.body.contains(container)) document.body.removeChild(container);
    return null;
  }
};
