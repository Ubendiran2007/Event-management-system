import { useState, useEffect } from 'react';
import { X, Download, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import seceHeader from '../assets/sece header.jpeg';
import { formatRollNo, formatEventRef, fallbackValue, formatVenue, getAttendanceMode } from '../utils/formatters';
import { Loader2 } from 'lucide-react';
import { generateODLetterBase64 } from '../utils/pdfGenerator';

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



  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const dataUri = await generateODLetterBase64(odRequest, event);
      if (dataUri) {
        const a = document.createElement('a');
        a.href = dataUri;
        a.download = `OD_Letter_${displayRollNo}_${event?.title || 'Event'}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        console.error('Failed to generate OD Letter PDF');
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
