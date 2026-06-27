import { useState, useEffect } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import seceHeader from '../assets/sece header.jpeg';
import { formatRollNo, formatEventRef, fallbackValue, formatVenue, getAttendanceMode } from '../utils/formatters';
import { Loader2 } from 'lucide-react';

const ODLetterModal = ({ odRequest, event, onClose }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const formatClassSection = (value) =>
    String(value || '')
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
  const displayRollNo = formatRollNo(odRequest?.rollNo, odRequest?.studentId) || 'N/A';
  const displayClassSection = formatClassSection(odRequest?.class || odRequest?.section) || 'N/A';
  const eventRef = formatEventRef(event);

  const s1 = event?.requisition?.step1;
  const isHistorical = event?.status === 'COMPLETED' || event?.status === 'CANCELLED';

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  let eventTitle = 'N/A';
  let eventVenue = 'N/A';
  let eventDate = 'N/A';

  if (isHistorical) {
    eventTitle = fallbackValue(odRequest?.eventTitle || odRequest?.eventName || event?.title, 'Not Provided');
    eventVenue = formatVenue(odRequest?.eventVenue, odRequest?.venue, event?.venue);
    eventDate = formatDate(odRequest?.eventDate || event?.date || s1?.eventStartDate || 'N/A');
    if (odRequest?.eventDate && odRequest.eventDate.includes('-') && odRequest.eventDate.length > 10) {
       eventDate = odRequest.eventDate;
    } else if (!odRequest?.eventDate && s1?.eventStartDate && s1?.eventEndDate && s1.eventStartDate !== s1.eventEndDate) {
       eventDate = `${formatDate(s1.eventStartDate)} - ${formatDate(s1.eventEndDate)}`;
    }
  } else {
    eventTitle = fallbackValue(event?.title || s1?.eventName || odRequest?.eventTitle || odRequest?.eventName, 'Not Provided');
    eventVenue = formatVenue(event?.venue, odRequest?.eventVenue, odRequest?.venue);
    eventDate = formatDate(event?.date || s1?.eventStartDate || odRequest?.eventDate || 'N/A');
    if (s1?.eventStartDate && s1?.eventEndDate && s1.eventStartDate !== s1.eventEndDate) {
      eventDate = `${formatDate(s1.eventStartDate)} - ${formatDate(s1.eventEndDate)}`;
    }
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

  const qrPayload = odRequest ? JSON.stringify({
    eventId: event?.id || 'N/A',
    registrationId: odRequest?.id || 'N/A',
    studentName: odRequest.studentName || 'N/A',
    rollNo: displayRollNo
  }) : '';

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



  const handleDownload = () => {
    setIsDownloading(true);
    try {
      const displayDepartment = odRequest?.department || 'General';
      const eventTime = `${event?.startTime || s1?.eventStartTime || '09:00'} - ${event?.endTime || s1?.eventEndTime || '16:00'}`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OD Permission Letter - ${displayRollNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { 
      size: A4 portrait; 
      margin: 0; 
    }
    body { 
      font-family: 'Times New Roman', Times, serif; 
      color: #1a202c; 
      background: #eee; 
      -webkit-print-color-adjust: exact;
    }
    .page-container {
      width: 210mm;
      min-height: 297mm;
      background: white;
      margin: 0 auto;
      padding: 15mm 20mm;
      position: relative;
    }
    @media print {
      body { background: white !important; }
      .page-container { margin: 0 !important; padding: 15mm 20mm !important; box-shadow: none !important; }
    }
    .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #1a3a6b; padding-bottom: 20px; }
    .header-image { width: 100%; max-height: 100px; object-fit: contain; margin-bottom: 15px; }
    .inst-name { font-size: 16pt; font-weight: bold; color: #1a3a6b; text-transform: uppercase; }
    .inst-sub { font-size: 12pt; font-weight: bold; color: #475569; margin-bottom: 15px; }
    .doc-title { font-size: 16pt; font-weight: bold; color: #1a3a6b; text-decoration: underline; text-transform: uppercase; margin-bottom: 5px; }
    .ref-code { font-size: 10pt; color: #64748b; font-family: monospace; }
    
    .section { margin-bottom: 25px; }
    .section-title { font-size: 12pt; font-weight: bold; background: #f1f5f9; padding: 8px 12px; border-left: 4px solid #1a3a6b; margin-bottom: 12px; color: #1e293b; text-transform: uppercase; }
    
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; }
    .info-row { display: flex; font-size: 11pt; line-height: 1.5; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
    .info-label { font-weight: bold; width: 130px; color: #475569; flex-shrink: 0; }
    .info-value { color: #0f172a; font-weight: 500; }
    
    .auth-statement { font-size: 11pt; line-height: 1.6; color: #334155; text-align: justify; margin: 30px 0; padding: 20px; border: 1px solid #cbd5e0; background: #f8fafc; border-radius: 8px; }
    
    .bottom-section { display: flex; flex-direction: column; gap: 40px; margin-top: 30px; }
    
    .qr-container { display: flex; flex-direction: column; align-items: flex-start; }
    .qr-image { width: 100px; height: 100px; border: 1px solid #cbd5e0; padding: 4px; background: white; border-radius: 6px; margin-bottom: 4px; }
    .qr-label { font-size: 8pt; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    
    .signatures { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 20px; width: 100%; }
    .sig-block { text-align: center; flex: 1 1 20%; min-width: 140px; }
    .sig-title { font-size: 10pt; font-weight: bold; color: #1a3a6b; margin-bottom: 40px; }
    .sig-line { border-top: 1px solid #1e293b; margin-bottom: 5px; padding-top: 4px; }
    .sig-name { font-size: 10pt; font-weight: bold; color: #1e293b; }
    .sig-role { font-size: 9pt; color: #64748b; }
    
    .footer { position: absolute; bottom: 15px; left: 0; width: 100%; text-align: center; font-size: 10pt; color: #64748b; font-weight: bold; }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="header">
      <img src="${seceHeader}" alt="SECE Header" class="header-image" />
      <div class="inst-name">Sri Eshwar College of Engineering</div>
      <div class="inst-sub">An Autonomous Institution</div>
      <div class="doc-title">Official OD Permission Letter</div>
      <div class="ref-code">Ref: ${eventRef}</div>
    </div>
    
    <div class="section">
      <div class="section-title">Student Information</div>
      <div class="grid-2">
        <div class="info-row"><span class="info-label">Student Name:</span><span class="info-value">${odRequest.studentName}</span></div>
        <div class="info-row"><span class="info-label">Roll Number:</span><span class="info-value">${displayRollNo}</span></div>
        <div class="info-row"><span class="info-label">Department:</span><span class="info-value">${displayDepartment}</span></div>
        <div class="info-row"><span class="info-label">Class:</span><span class="info-value">${displayClassSection}</span></div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-title">Event Information</div>
      <div class="grid-2">
        <div class="info-row"><span class="info-label">Event Name:</span><span class="info-value">${eventTitle}</span></div>
        <div class="info-row"><span class="info-label">Event Ref:</span><span class="info-value">${eventRef}</span></div>
        <div class="info-row"><span class="info-label">Event Date:</span><span class="info-value">${eventDate}</span></div>
        <div class="info-row"><span class="info-label">Start Time:</span><span class="info-value">${event?.startTime || s1?.eventStartTime || '09:00'}</span></div>
        <div class="info-row"><span class="info-label">End Time:</span><span class="info-value">${event?.endTime || s1?.eventEndTime || '16:00'}</span></div>
        <div class="info-row"><span class="info-label">Venue:</span><span class="info-value">${eventVenue}</span></div>
      </div>
    </div>
    
    <div class="auth-statement">
      This On-Duty Permission Letter has been officially approved through the SECE Event Hub workflow. The QR Code may be used to verify the authenticity of this permission letter and retrieve the latest event information.
      <br/><br/>
      <strong>Verification Code:</strong> <span style="font-family: monospace; font-size: 12pt; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${verificationCode}</span>
    </div>
    
    <div class="bottom-section">
      <div class="qr-container">
        <img src="${qrDataUrl}" alt="QR Code" class="qr-image" />
        <div class="qr-label">Scan to Verify OD</div>
      </div>
      
      <div class="signatures">
        <div class="sig-block">
          <div class="sig-title">Participant</div>
          <div class="sig-line"></div>
          <div class="sig-role">(Student Signature)</div>
        </div>
        <div class="sig-block">
          <div class="sig-title">Class Advisor</div>
          <div class="sig-line"></div>
          <div class="sig-role">(Class Advisor Signature)</div>
        </div>
        <div class="sig-block">
          <div class="sig-title">Event Organizer</div>
          <div class="sig-line"></div>
          <div class="sig-name">${approvedBy}</div>
          <div class="sig-role">(Event Organizer)</div>
        </div>
        <div class="sig-block">
          <div class="sig-title">Head of Department</div>
          <div class="sig-line"></div>
          <div class="sig-name">${hodName}</div>
          <div class="sig-role">(HOD Signature)</div>
        </div>
      </div>
    </div>
    
    <div class="footer">Page 1 of 1</div>
  </div>
</body>
</html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        console.error('Pop-ups might be blocked.');
      }
    } catch (err) {
      console.error('Download failed', err);
    } finally {
      setIsDownloading(false);
    }
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
              <p className="text-xs text-slate-400">Official digital OD authorization</p>
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
                ['Roll No',    displayRollNo],
                ['Class',      fallbackValue(odRequest.class, 'general')],
                ['Event',      eventTitle],
                ['Event Ref',  eventRef],
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
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
            <strong>Official OD Authorization:</strong> This OD request has been approved through the SECE Event Hub workflow. Use the QR code to verify your registration and retrieve the latest event information. Any updates to the event schedule, venue, or attendance status will automatically be reflected here.
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
            disabled={isDownloading}
            className={`flex-1 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
              isDownloading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isDownloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {isDownloading ? 'Generating...' : 'Download OD Letter'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ODLetterModal;
