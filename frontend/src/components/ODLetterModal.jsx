import { useState, useEffect } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import seceHeader from '../assets/sece header.jpeg';

const ODLetterModal = ({ odRequest, event, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');

  const formatRollNo = (value) =>
    String(value || '')
      .trim()
      .replace(/^student_/i, '')
      .toUpperCase();

  const formatClassSection = (value) =>
    String(value || '')
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

  const displayRollNo = formatRollNo(odRequest?.rollNo || odRequest?.studentId) || 'N/A';
  const displayClassSection = formatClassSection(odRequest?.class || odRequest?.section) || 'N/A';

  const eventTitle  = odRequest?.eventTitle  || odRequest?.eventName  || 'N/A';
  const eventVenue  = odRequest?.eventVenue  || odRequest?.venue      || 'N/A';
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

  const approvedBy  = odRequest?.approvedBy  || odRequest?.organizerName || 'Event Organizer';
  const hodName     = odRequest?.hodName     || 'Dr. Head of Department';
  const approvedAt  = odRequest?.approvedAt
    ? new Date(odRequest.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const issuedDate  = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const verificationCode = odRequest
    ? `ODV-${(odRequest.id || 'NA').slice(-6).toUpperCase()}-${new Date(odRequest.approvedAt || Date.now()).getTime().toString().slice(-6)}`
    : '';

  // Build QR payload – when scanned shows student + event info
  const qrPayload = odRequest ? [
    `OD VERIFICATION`,
    `Student : ${odRequest.studentName}`,
    `Roll No : ${displayRollNo}`,
    `Class   : ${displayClassSection}`,
    `Event   : ${eventTitle}`,
    `Date    : ${eventDate}`,
    `Venue   : ${eventVenue}`,
    `Status  : APPROVED`,
    `Code    : ${verificationCode}`,
    `Issued  : ${issuedDate}`,
  ].join('\n') : '';

  useEffect(() => {
    if (!qrPayload) return;
    QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      width: 180,
      margin: 1,
      color: { dark: '#1a3a6b', light: '#ffffff' },
    }).then(setQrDataUrl).catch(() => {});
  }, [qrPayload]);

  if (!odRequest) return null;

  const letterHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>OD Letter – ${odRequest.studentName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: #fff; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12.5pt;
      color: #111;
    }
    :root {
      --a4-width: 210mm;
      --a4-height: 297mm;
    }
    .page {
      width: var(--a4-width);
      height: var(--a4-height);
      margin: 6mm auto;
      padding: 10mm 12mm 8mm;
      display: flex;
      flex-direction: column;
      background: #fff;
      box-shadow: 0 0 0 1px #e5e7eb;
      overflow: hidden;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* ── Header ── */
    .header {
      border-bottom: 3px double #1a3a6b;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .header-image-wrap {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    .header-image {
      width: 100%;
      max-height: 86px;
      object-fit: contain;
      display: block;
    }
    .college-name {
      font-size: 16pt;
      font-weight: bold;
      color: #1a3a6b;
      letter-spacing: 0.5px;
    }
    .college-sub {
      font-size: 8.8pt;
      color: #444;
      margin-top: 2px;
      line-height: 1.35;
    }
    .dept-name {
      font-size: 10.5pt;
      font-weight: bold;
      color: #2c5282;
      margin-top: 3px;
    }

    /* ── Title ── */
    .letter-title {
      text-align: center;
      font-size: 12pt;
      font-weight: bold;
      text-decoration: underline;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #1a3a6b;
      margin: 8px 0;
    }

    /* ── Ref / Date row ── */
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 9.8pt;
      margin-bottom: 8px;
      color: #333;
    }

    /* ──  Addressee block ── */
    .addressee {
      font-size: 10.8pt;
      line-height: 1.5;
      margin-bottom: 8px;
    }

    /* ── Subject line ── */
    .subject {
      font-size: 10.8pt;
      line-height: 1.45;
      margin-bottom: 8px;
    }

    /* ── Body paragraphs ── */
    .body-text {
      font-size: 10.8pt;
      line-height: 1.5;
      text-align: justify;
      margin-bottom: 8px;
    }

    /* ── Detail table ── */
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 9.6pt;
    }
    .detail-table tr td {
      padding: 4px 8px;
      border: 1px solid #bcd;
      line-height: 1.25;
      word-break: break-word;
    }
    .detail-table tr td:first-child {
      width: 35%;
      font-weight: bold;
      background: #eef4fb;
      color: #1a3a6b;
    }

    /* ── Closing ── */
    .closing {
      font-size: 10.8pt;
      line-height: 1.45;
      margin-bottom: 2px;
    }

    /* ── E-Signature section ── */
    .sig-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 8px;
      gap: 8px;
    }
    .sig-box { text-align: center; flex: 1; }
    .e-stamp {
      display: inline-block;
      border: 2px solid #1a6b3a;
      border-radius: 6px;
      padding: 4px 7px;
      background: #f0fff4;
      margin-bottom: 4px;
      min-width: 102px;
    }
    .e-stamp .check  { font-size: 14pt; color: #1a6b3a; display: block; line-height: 1.1; }
    .e-stamp .esigned {
      font-size: 7.5pt; font-weight: bold; color: #1a6b3a;
      text-transform: uppercase; letter-spacing: 0.5px; display: block;
    }
    .e-stamp .ename  { font-size: 9pt; font-weight: bold; color: #1a3a6b; display: block; margin-top: 2px; }
    .e-stamp .edate  { font-size: 7.5pt; color: #555; display: block; font-family: 'Courier New', monospace; }
    .sig-label { font-size: 8.8pt; color: #333; margin-top: 2px; line-height: 1.25; }

    /* Student – plain line */
    .sig-student-box { text-align: center; flex: 1; }
    .student-line { border-top: 1.5px solid #333; margin-bottom: 5px; margin-top: 32px; }

    /* ── QR + Verification row ── */
    .bottom-row {
      display: flex;
      gap: 12px;
      margin-top: 8px;
      align-items: flex-start;
    }
    .qr-block { flex-shrink: 0; text-align: center; }
    .qr-block img { width: 76px; height: 76px; border: 1px solid #aac; border-radius: 4px; display: block; }
    .qr-caption { font-size: 7.5pt; color: #666; margin-top: 3px; }
    .verify-block {
      flex: 1;
      border: 1px solid #c9dbf3;
      background: #f5f9ff;
      border-radius: 6px;
      padding: 7px 9px;
      font-size: 8.8pt;
      color: #234;
      line-height: 1.35;
    }
    .verify-code {
      font-family: 'Courier New', monospace;
      font-weight: bold;
      letter-spacing: 0.5px;
      color: #1a3a6b;
      font-size: 9pt;
      margin-top: 5px;
    }

    /* ── Footer ── */
    .footer {
      margin-top: auto;
      border-top: 1px solid #ccc;
      padding-top: 5px;
      font-size: 7.6pt;
      color: #999;
      text-align: center;
    }

    @media print {
      html, body { background: #fff; margin: 0; padding: 0; }
      body {
        width: var(--a4-width);
        height: var(--a4-height);
      }
      .page {
        width: var(--a4-width);
        height: 296mm; /* Slightly less than 297mm to prevent empty 2nd page */
        margin: 0;
        padding: 10mm 12mm 8mm;
        box-shadow: none;
        overflow: hidden;
        page-break-inside: avoid;
        page-break-after: avoid;
        break-inside: avoid;
      }
      @page { size: A4; margin: 0; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- College Header -->
  <div class="header">
    <div class="header-image-wrap">
      <img src="${seceHeader}" alt="Sri Eshwar College Header" class="header-image" />
    </div>
    <div class="dept-name">Department of Computer Science and Engineering</div>
  </div>

  <!-- Title -->
  <div class="letter-title">On Duty (OD) Permission Letter</div>

  <!-- Ref / Date -->
  <div class="meta-row">
    <span>Ref No: CSE/OD/${new Date().getFullYear()}/${odRequest.id?.slice(-6).toUpperCase() || 'XXXXX'}</span>
    <span>Date: ${issuedDate}</span>
  </div>

  <!-- Addressee -->
  <div class="addressee">
    To,<br/>
    <strong>The Class Advisor,</strong><br/>
    Department of Computer Science and Engineering,<br/>
    Sri Eshwar College of Engineering, Coimbatore.
  </div>

  <!-- Subject -->
  <div class="subject">
    <strong>Sub:</strong>&nbsp; Permission for On Duty (OD) – Attendance of Department Event – regarding.
  </div>

  <!-- Salutation + Body -->
  <p class="body-text">Dear Sir / Madam,</p>

  <p class="body-text">
    This is to certify that the student mentioned below has been granted <strong>On Duty (OD)</strong>
    permission to attend the department event organised by the Department of Computer Science and
    Engineering, Sri Eshwar College of Engineering. The registration for this event was duly reviewed
    and <strong>approved by the Event Organizer</strong> on <strong>${approvedAt}</strong> through
    the CSE Event Management Portal.
  </p>

  <p class="body-text">
    Kindly mark the student as <strong>On Duty</strong> in the attendance register for the date(s)
    of the event mentioned below, and grant the necessary permission accordingly.
  </p>

  <!-- Details Table -->
  <table class="detail-table">
    <tr><td>Student Name</td><td>${odRequest.studentName}</td></tr>
    <tr><td>Roll Number</td><td>${displayRollNo}</td></tr>
    <tr><td>Class / Section</td><td>${displayClassSection}</td></tr>
    <tr><td>Email</td><td>${odRequest.email || 'N/A'}</td></tr>
    <tr><td>Event Name</td><td>${eventTitle}</td></tr>
    <tr><td>Event Date</td><td>${eventDate}</td></tr>
    <tr><td>Venue</td><td>${eventVenue}</td></tr>
    <tr><td>Approved By</td><td>${approvedBy}</td></tr>
    <tr><td>OD Status</td><td><strong style="color:#1a6b3a;">&#10004; APPROVED</strong></td></tr>
  </table>

  <!-- Closing -->
  <p class="closing">
    Your kind cooperation in this regard is highly appreciated.
  </p>
  <p class="closing" style="margin-top:6px;">
    Thanking you,<br/>
    Yours faithfully,
  </p>

  <!-- E-Signature Section -->
  <div class="sig-section">

    <!-- Student -->
    <div class="sig-student-box">
      <div class="student-line"></div>
      <div class="sig-label">
        <strong>Student Signature</strong><br/>
        ${odRequest.studentName}<br/>
        ${displayRollNo}
      </div>
    </div>

    <!-- Event Organizer Signature -->
    <div class="sig-student-box">
      <div class="student-line"></div>
      <div class="sig-label">
        <strong>Event Organizer</strong><br/>
        ${approvedBy}
      </div>
    </div>

    <!-- HOD Signature -->
    <div class="sig-student-box">
      <div class="student-line"></div>
      <div class="sig-label">
        <strong>Head of Department</strong><br/>
        ${hodName}
      </div>
    </div>

    <!-- Class Advisor physical signature -->
    <div class="sig-student-box">
      <div class="student-line"></div>
      <div class="sig-label">
        <strong>Class Advisor Signature</strong><br/>
        (To be signed physically)
      </div>
    </div>

  </div>

  <!-- QR + Verification row -->
  <div class="bottom-row">
    <div class="qr-block">
      ${qrDataUrl
        ? `<img src="${qrDataUrl}" alt="OD QR Code"/>`
        : `<div style="width:88px;height:88px;border:1px solid #aac;display:flex;align-items:center;justify-content:center;font-size:8pt;color:#aaa;">QR</div>`}
      <div class="qr-caption">Scan to verify OD</div>
    </div>
    <div class="verify-block">
      <strong>Verification Details</strong><br/>
      This letter is generated via the CSE Event Management Portal.
      Please verify the details below with the physical signatures provided.
      Scanning the QR code will display student and event details for instant on-site verification.
      <div class="verify-code">Verification Code: ${verificationCode}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    This is a system-generated e-letter from the CSE Event Management Portal &middot; Sri Eshwar College of Engineering, Coimbatore
  </div>

</div>
</body>
</html>`;

  const handleDownload = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) {
      alert('Please allow pop-ups to download the OD letter.');
      return;
    }
    printWindow.document.write(letterHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">OD Permission Letter</h2>
              <p className="text-xs text-slate-400">E-signed &amp; verified digital OD letter</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Preview summary */}
        <div className="p-6 space-y-4">
          <div className="flex gap-4">
            {/* Details */}
            <div className="flex-1 bg-slate-50 rounded-xl p-4 space-y-2.5 text-sm">
              {[
                ['Student',    odRequest.studentName],
                ['Roll No',    odRequest.rollNo],
                ['Class',      odRequest.class || 'N/A'],
                ['Event',      eventTitle],
                ['Date',       eventDate],
                ['Venue',      eventVenue],
                ['Approved By',approvedBy],
                ['HOD',        hodName],
                ['Code',       verificationCode],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between items-start gap-4">
                  <span className="text-slate-500 shrink-0 w-24">{label}</span>
                  <span className="font-medium text-slate-800 text-right text-xs">{val}</span>
                </div>
              ))}
            </div>

            {/* QR code preview */}
            <div className="flex flex-col items-center gap-2">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="OD QR Code" className="w-28 h-28 rounded-lg border border-slate-200" />
              ) : (
                <div className="w-28 h-28 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
                  Generating...
                </div>
              )}
              <span className="text-xs text-slate-400 text-center leading-tight">Scan to<br/>verify OD</span>
              {/* E-sign badges */}
              <div className="mt-2 space-y-1 w-28">
                <div className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                  <span>✔</span><span className="font-semibold">Organizer</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                  <span>✔</span><span className="font-semibold">HOD</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
            <strong>E-Letter:</strong> This OD letter carries digital e-signatures from the Event Organizer and HOD. Click <em>Download OD Letter</em> and save as PDF to hand to your class advisor. Scanning the QR code will show your name and event details.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={15} /> Download OD Letter
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ODLetterModal;
