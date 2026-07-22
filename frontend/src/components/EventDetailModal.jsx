import {
  X, Calendar, MapPin, Clock, FileText, User,
  ChevronRight, Building2, Mic2, MonitorSmartphone,
  Car, Hotel, Camera, CheckCircle2, Award,
  ArrowRight, FileCheck, ExternalLink, Trash2,
  Star, AlertTriangle, Clock3,
  XCircle, Loader2, ClipboardList, Eye, Download, Users, Edit3, Save, PlayCircle, Plus, GraduationCap, Share2, Upload, MessageSquare
} from 'lucide-react';
import { uploadFileToStorage, deleteFileFromStorage, validateFile } from '../utils/storageService';

const formatTime12 = (t24) => {
  if (!t24) return "-";
  try {
    const [h, m] = String(t24).split(':');
    const hh = parseInt(h, 10);
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${m} ${suffix}`;
  } catch (e) {
    return t24;
  }
};
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { EventStatus, UserRole } from '../types';
import StatusBadge from './StatusBadge';
import TimePicker from './TimePicker';
import FeedbackModal from './FeedbackModal';
import AttendanceTab from './AttendanceTab';
import RegistrationsTab from './RegistrationsTab';
import { formatRollNo, formatStudentNameWithRoll, formatEventRef, fallbackValue, getEventStatus } from '../utils/formatters';
import { validateUpload } from '../utils/fileValidation';
import { getRolePath } from '../utils/routeUtils';


const InfoSection = ({ title, icon: Icon, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
      {Icon && <Icon size={18} className="text-cse-accent" />}
      {title}
    </h3>
    {children}
  </section>
);

const InfoRow = ({ label, value, fullWidth = false }) => (
  <div className={`rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 ${fullWidth ? 'col-span-2' : ''}`}>
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
    <p className="text-sm font-medium text-slate-900">{value || 'Not specified'}</p>
  </div>
);

const compressImageToDataUrl = (file, maxWidth = 1200, quality = 0.82) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    const img = new window.Image();
    img.src = e.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scaleSize = maxWidth / img.width;
      if (scaleSize < 1) {
        canvas.width = maxWidth;
        canvas.height = img.height * scaleSize;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image for compression.'));
  };
  reader.onerror = () => reject(new Error('Failed to read file.'));
});

const EventDetailModal = ({ event, onClose }) => {
  const { currentUser, odRequests = [], handleApproval, handleDepartmentApproval, setSelectedEvent } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [posterUploadError, setPosterUploadError] = useState('');
  const [posterUploadSuccess, setPosterUploadSuccess] = useState('');
  const [isRequestingExtension, setIsRequestingExtension] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancelConfirmation, setCancelConfirmation] = useState('');
  const [cancelError, setCancelError] = useState(null);
  const [postponeReason, setPostponeReason] = useState('');
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeEndDate, setPostponeEndDate] = useState('');
  const [postponeStartTime, setPostponeStartTime] = useState('');
  const [postponeEndTime, setPostponeEndTime] = useState('');
  const [postponeError, setPostponeError] = useState(null);
  
  const [activeTab, setActiveTab] = useState('Overview');

  const fileInputRef = useRef(null);

  if (!event) return null;

  const r = event.requisition;
  const s1 = r?.step1;

  // Initialize postpone state when modal opens
  if (!postponeDate && (s1?.eventStartDate || event?.date)) {
    setPostponeDate(s1?.eventStartDate || event?.date);
    setPostponeEndDate(s1?.eventEndDate || s1?.eventStartDate || event?.date);
    setPostponeStartTime(s1?.eventStartTime || event?.startTime || '00:00');
    setPostponeEndTime(s1?.eventEndTime || event?.endTime || '00:00');
  }

  useEffect(() => {
    if (showPostponeModal) setPostponeError(null);
  }, [showPostponeModal]);

  useEffect(() => {
    if (showCancelModal) setCancelError(null);
  }, [showCancelModal]);

  // ── IQAC Submission Eligibility ────────────────────────────────────────────
  // Organizer can submit IQAC report if:
  //   1. Event is POSTED (not yet completed/submitted)
  //   2. They are the organizer
  //   3. Either within 7 days of event end OR faculty has granted an extension
  const isOrganizer = (currentUser?.id && (event.organizerId === currentUser.id || event.organizerEmail === currentUser?.email)) || currentUser?.role === UserRole.FACULTY;
  const iqacAlreadySubmitted = Boolean(event.iqacSubmittedAt);
  const isPostedForIqac = event.status === EventStatus.POSTED || event.status === EventStatus.COMPLETED || event.status === 'POSTPONED' || event.status === EventStatus.APPROVED;

  const getIqacSubmissionStatus = () => {
    if (!isOrganizer || !isPostedForIqac || iqacAlreadySubmitted) return null;

    // Compute event end datetime
    const endDateStr = s1?.eventEndDate || s1?.eventStartDate || event.date;
    const endTimeStr = s1?.eventEndTime || event.endTime || '23:59';
    if (!endDateStr) return { eligible: false, reason: 'no-date' };

    const [eh, emm] = String(endTimeStr).split(':').map(Number);
    let eventEnd;
    const dateParts = String(endDateStr).split('-');
    if (dateParts.length === 3) {
      if (dateParts[0].length === 4) {
        eventEnd = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), eh, emm, 0);
      } else {
        eventEnd = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]), eh, emm, 0);
      }
    } else {
      eventEnd = new Date(endDateStr);
      if (!isNaN(eventEnd.getTime())) {
        eventEnd.setHours(eh, emm, 0, 0);
      }
    }
    if (!eventEnd || isNaN(eventEnd.getTime())) return { eligible: false, reason: 'no-date' };

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const windowEnd = new Date(eventEnd.getTime() + sevenDaysMs);
    const now = new Date();

    if (now < eventEnd) return { eligible: false, reason: 'not-started' }; // event not over yet
    
    // 1. Check if we have a HOD-approved end date
    if (event.iqacWindowExtended && event.iqacExtensionEndDate) {
      const extEndStr = event.iqacExtensionEndDate;
      const [exy, exm, exd] = extEndStr.split('-').map(Number);
      const extEnd = new Date(exy, exm - 1, exd, 23, 59, 59); // inclusive of end date
      if (now <= extEnd) {
        return { 
          eligible: true, 
          reason: 'extended', 
          extendedBy: event.iqacWindowExtendedBy, 
          daysLeft: Math.ceil((extEnd - now) / (1000 * 60 * 60 * 24)) 
        };
      }
    }

    // 2. Check standard 7-day window
    if (now <= windowEnd) return { eligible: true, reason: 'in-window', daysLeft: Math.ceil((windowEnd - now) / (1000 * 60 * 60 * 24)) };

    // 3. Fallback for legacy extensions (those without explicit end date but have extended flag)
    if (event.iqacWindowExtended && !event.iqacExtensionEndDate) {
        // Assume 2 days from when it was extended if available, otherwise just grant access
        if (event.iqacWindowExtendedAt) {
           const extAt = new Date(event.iqacWindowExtendedAt);
           const extLimit = new Date(extAt.getTime() + (2 * 1440 * 60 * 1000));
           if (now <= extLimit) return { eligible: true, reason: 'extended', extendedBy: event.iqacWindowExtendedBy };
        } else {
           return { eligible: true, reason: 'extended', extendedBy: event.iqacWindowExtendedBy };
        }
    }

    // 4. Check for pending request
    if (event.iqacExtensionRequest?.status === 'PENDING') {
      return { eligible: false, reason: 'requested', request: event.iqacExtensionRequest };
    }

    return { eligible: false, reason: 'expired' };
  };

  const iqacStatus = getIqacSubmissionStatus();
  const venueAnnex = r?.annexureI_venue;
  const audioAnnex = r?.annexureII_audio;
  const ictsAnnex = r?.annexureIII_icts;
  const transportAnnex = r?.annexureIV_transport;
  const accomAnnex = r?.annexureV_accommodation;
  const mediaAnnex = r?.annexureVI_media;
  const createdOn = event?.createdAt ? new Date(event.createdAt).toLocaleDateString() : 'Not available';
  const isMultiDay = s1?.eventStartDate && s1?.eventEndDate && s1.eventStartDate !== s1.eventEndDate;
  const eventDateRange = s1?.eventStartDate && s1?.eventEndDate
    ? (s1.eventStartDate === s1.eventEndDate ? s1.eventStartDate : `${s1.eventStartDate} to ${s1.eventEndDate}`)
    : (event?.date || 'Not specified');
  const enabledRequirementCount = Object.values(s1?.requirements || {}).filter(Boolean).length;
  const eventPosterSrc = event?.posterStorage?.downloadURL || event?.posterDataUrl || event?.posterUrl || null;

  const isMedia = currentUser?.role === UserRole.MEDIA;
  const isMediaUploadAllowed = isMedia && (
    ['REQUESTED', 'REWORK_REQUESTED', 'UPLOADED', 'COMPLETED'].includes(String(event.posterWorkflow?.status || '').toUpperCase()) ||
    event.status === 'REJECTED'
  );
  const canFinalizePoster = isMediaUploadAllowed && (eventPosterSrc || posterUploadSuccess) && String(event.posterWorkflow?.status || '').toUpperCase() !== 'COMPLETED';

  const handleRemovePoster = async () => {
    setIsUploadingPoster(true);
    setPosterUploadError('');
    try {
      if (event?.posterStorage?.storagePath) {
        await deleteFileFromStorage(event.posterStorage.storagePath);
      }

      const patchRes = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${event.id}/poster`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', updatedBy: currentUser.name })
      });
      if (!patchRes.ok) throw new Error('Failed to remove poster.');
      
      setPosterUploadSuccess('');
      if (setSelectedEvent) {
          setSelectedEvent(prev => prev ? ({ 
            ...prev, 
            posterDataUrl: null, 
            posterUrl: null,
            posterStorage: null,
            posterWorkflow: { ...(prev.posterWorkflow || {}), status: 'REQUESTED' }
          }) : null);
      }
    } catch (err) {
      setPosterUploadError(err.message || 'Error removing poster.');
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const handleCancelEvent = async () => {
    if (cancelConfirmation !== 'CANCEL EVENT') {
      setCancelError('Please type CANCEL EVENT exactly to confirm.');
      return;
    }
    if (!cancellationReason.trim()) {
      setCancelError('Cancellation reason is required.');
      return;
    }
    setIsProcessing(true);
    setCancelError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${event.id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({ cancellationReason, confirmationText: cancelConfirmation })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to cancel event');
      }
      setTimeout(() => { onClose(); }, 300);
    } catch (err) {
      setCancelError(err.message);
      setIsProcessing(false);
    }
  };

  const handlePostponeEvent = async () => {
    if (!postponeReason.trim() || !postponeDate || !postponeEndDate || !postponeStartTime || !postponeEndTime) {
      setPostponeError('All fields are required.');
      return;
    }
    if (postponeDate > postponeEndDate) {
      setPostponeError('End date must be after or equal to start date.');
      return;
    }
    if (postponeDate === postponeEndDate && postponeStartTime >= postponeEndTime) {
      setPostponeError('End time must be after start time on the same day.');
      return;
    }
    setIsProcessing(true);
    setPostponeError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${event.id}/postpone`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({ reason: postponeReason, newDate: postponeDate, newEndDate: postponeEndDate, newStartTime: postponeStartTime, newEndTime: postponeEndTime })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to postpone event');
      }
      setTimeout(() => { 
        onClose(); 
      }, 300);
    } catch (err) {
      setPostponeError(err.message);
      setIsProcessing(false);
    }
  };

  const handlePosterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Centralized security validation
    const validationError = validateFile(file, 'IMAGE', 5 * 1024 * 1024);
    if (validationError) {
      setPosterUploadError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploadingPoster(true);
    setPosterUploadError('');
    setPosterUploadSuccess('');

    try {
      if (event?.posterStorage?.storagePath) {
        await deleteFileFromStorage(event.posterStorage.storagePath);
      }

      const metadata = await uploadFileToStorage(file, `events/${event.id}/poster_${Date.now()}.jpg`);

      const patchRes = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${event.id}/poster`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          posterStorage: metadata,
          posterFileName: file.name,
          posterMimeType: file.type,
          updatedBy: currentUser.name
        })
      });

      if (!patchRes.ok) throw new Error('Failed to upload poster data.');
      
      setPosterUploadSuccess('Poster uploaded! Review it above and click "Approve" to finalize.');
      
      // Reset file input so onChange fires even if same file is selected again
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Update local event object if possible to show the new image immediately
      if (setSelectedEvent) {
          setSelectedEvent(prev => prev ? ({ 
            ...prev, 
            posterDataUrl: null, // Clear legacy
            posterStorage: metadata,
            posterWorkflow: { ...(prev.posterWorkflow || {}), status: 'UPLOADED' }
          }) : null);
      }

    } catch (err) {
      console.error(err);
      setPosterUploadError(err.message || 'An error occurred during upload.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const handleFinalizePoster = async () => {
    setIsProcessing(true);
    setPosterUploadError('');
    try {
      const wfRes = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${event.id}/poster-workflow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          finalUploadedBy: currentUser.name,
          finalUploadedAt: new Date().toISOString()
        })
      });

      if (!wfRes.ok) throw new Error('Failed to finalize poster workflow.');

      setPosterUploadSuccess('Poster approved successfully! Moving forward...');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setPosterUploadError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestExtension = async () => {
    if (!extensionReason.trim()) {
      setApprovalError('Please provide a reason for the extension.');
      return;
    }

    setIsRequestingExtension(true);
    setApprovalError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${event.id}/request-iqac-extension`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reason: extensionReason,
          requestedBy: currentUser.name
        })
      });

      if (!res.ok) throw new Error('Failed to request extension');
      
      const data = await res.json();
      if (data.success) {
        setPosterUploadSuccess('Extension request sent to HOD.');
        setTimeout(() => { onClose(); }, 1500);
      }
    } catch (err) {
      console.error(err);
      setApprovalError(err.message || 'Error requesting extension');
    } finally {
      setIsRequestingExtension(false);
    }
  };

  const canApprove = () => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.FACULTY && event.status === EventStatus.PENDING_FACULTY) return true;
    if (currentUser.role === UserRole.HOD && event.status === EventStatus.PENDING_HOD) return true;
    if (currentUser.role === UserRole.IQAC_TEAM && event.status === EventStatus.PENDING_IQAC) return true;
    return false;
  };

  // Department-level approvals (only visible when event is PENDING_DEPARTMENTS)
  const isDeptPending = event.status === EventStatus.PENDING_DEPARTMENTS;
  const reqs = event.requisition?.step1?.requirements || {};
  const isReq = (key) => reqs[key] ?? event[key] ?? false;
  const depts = event.departmentApprovals || {};

  const canApproveVenue = currentUser?.role === UserRole.HR_TEAM && isDeptPending && isReq('venueRequired') && depts.venue?.status !== 'APPROVED';
  const canApproveMedia = currentUser?.role === UserRole.HR_TEAM && isDeptPending && isReq('mediaRequired') && depts.media?.status !== 'APPROVED';
  const canApproveAudio = currentUser?.role === UserRole.AUDIO_TEAM && isDeptPending && isReq('audioRequired') && depts.audio?.status !== 'APPROVED';
  const canApproveICTS = currentUser?.role === UserRole.SYSTEM_ADMIN && isDeptPending && isReq('ictsRequired') && depts.icts?.status !== 'APPROVED';
  const canApproveTransport = currentUser?.role === UserRole.TRANSPORT_TEAM && isDeptPending && isReq('transportRequired') && depts.transport?.status !== 'APPROVED';

  const maleGuests = Number(event.requisition?.annexureV_accommodation?.maleGuests || 0);
  const femaleGuests = Number(event.requisition?.annexureV_accommodation?.femaleGuests || 0);
  const isAccomReq = isReq('accommodationDiningRequired') || isReq('accommodationRequired');

  const canApproveBoysAccommodation = currentUser?.role === UserRole.BOYS_WARDEN && isDeptPending && isAccomReq && depts.boysAccommodation?.status !== 'APPROVED' && (maleGuests > 0 || (maleGuests === 0 && femaleGuests === 0));
  const canApproveGirlsAccommodation = currentUser?.role === UserRole.GIRLS_WARDEN && isDeptPending && isAccomReq && depts.girlsAccommodation?.status !== 'APPROVED' && femaleGuests > 0;

  const hasAnyDeptApproval = canApproveVenue || canApproveMedia || canApproveAudio || canApproveICTS || canApproveTransport || canApproveBoysAccommodation || canApproveGirlsAccommodation;

  const handleDeptApprove = async (department) => {
    setIsProcessing(true);
    setApprovalError('');
    try {
      await handleDepartmentApproval(event.id, department);
      setTimeout(() => { onClose(); }, 300);
    } catch (error) {
      console.error('Error approving department:', error);
      setApprovalError('Approval failed. Check your connection or permissions and try again.');
      setIsProcessing(false);
    }
  };

  const handleHRApproveBoth = async () => {
    setIsProcessing(true);
    setApprovalError('');
    try {
      if (canApproveVenue) await handleDepartmentApproval(event.id, 'venue');
      if (canApproveMedia) await handleDepartmentApproval(event.id, 'media');
      setTimeout(() => { onClose(); }, 300);
    } catch (error) {
      console.error('Error approving HR both:', error);
      setApprovalError('Approval failed.');
      setIsProcessing(false);
    }
  };

  const handleDeptReject = async (department) => {
    const reason = String(rejectionReason || '').trim();
    if (!reason) {
      setApprovalError('Please enter a rejection reason before rejecting this requirement.');
      return;
    }

    setIsProcessing(true);
    setApprovalError('');
    try {
      await handleDepartmentApproval(event.id, department, 'REJECTED', reason);
      setTimeout(() => { onClose(); }, 300);
    } catch (error) {
      console.error('Error rejecting department:', error);
      setApprovalError('Rejection failed. Check your connection or permissions and try again.');
      setIsProcessing(false);
    }
  };

  const handleHRRejectBoth = async () => {
    const reason = String(rejectionReason || '').trim();
    if (!reason) {
      setApprovalError('Please enter a rejection reason before rejecting these requirements.');
      return;
    }

    setIsProcessing(true);
    setApprovalError('');
    try {
      if (canApproveVenue) await handleDepartmentApproval(event.id, 'venue', 'REJECTED', reason);
      if (canApproveMedia) await handleDepartmentApproval(event.id, 'media', 'REJECTED', reason);
      setTimeout(() => { onClose(); }, 300);
    } catch (error) {
      console.error('Error rejecting HR both:', error);
      setApprovalError('Rejection failed.');
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    setApprovalError('');
    try {
      await handleApproval(event.id, true);
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      if (error.message === 'GHOST_EVENT') {
        setApprovalError('This event was never saved to the database (caused by an earlier permissions issue). It has been removed from your queue — please create a new event.');
        setTimeout(() => onClose(), 4000);
      } else {
        console.error('Error approving event:', error);
        setApprovalError('Approval failed. Check your connection or Firestore permissions and try again.');
      }
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    const reason = String(rejectionReason || '').trim();
    if (!reason) {
      setApprovalError('Please enter a rejection reason before rejecting this event.');
      return;
    }

    setIsProcessing(true);
    setApprovalError('');
    try {
      await handleApproval(event.id, false, reason);
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      if (error.message === 'GHOST_EVENT') {
        setApprovalError('This event was never saved to the database (caused by an earlier permissions issue). It has been removed from your queue — please create a new event.');
        setTimeout(() => onClose(), 4000);
      } else {
        console.error('Error rejecting event:', error);
        setApprovalError('Action failed. Check your connection or Firestore permissions and try again.');
      }
      setIsProcessing(false);
    }
  };

  const getNextApprover = () => {
    const reqsObj = event.requisition?.step1?.requirements || {};
    const checkReq = (key) => reqsObj[key] ?? event[key] ?? false;
    const hasDeptReqs = checkReq('venueRequired') || 
                        checkReq('mediaRequired') || 
                        checkReq('audioRequired') || 
                        checkReq('ictsRequired') || 
                        checkReq('transportRequired') || 
                        checkReq('accommodationDiningRequired') || 
                        checkReq('accommodationRequired');

    switch (event.status) {
      case EventStatus.PENDING_FACULTY:
        return 'HOD Approval';
      case EventStatus.PENDING_HOD:
        return hasDeptReqs ? 'Department Approvals' : 'IQAC Review';
      case EventStatus.PENDING_DEPARTMENTS:
        return 'IQAC Review';
      case EventStatus.PENDING_IQAC:
        return 'Posted for all students';
      default:
        return '';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 z-10 relative">
            <div className="pr-10">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 pr-2">{event.title}</h2>
              <p className="text-sm text-slate-500 mt-1">Approval review workspace</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 border border-blue-200">{eventDateRange}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 border border-emerald-200">{enabledRequirementCount} requirements enabled</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pr-10 sm:pr-0">
              {(currentUser?.role === UserRole.STUDENT_ORGANIZER || currentUser?.role === UserRole.FACULTY) && (event.organizerId === currentUser.id || event.organizerEmail === currentUser?.email) && event.status !== 'COMPLETED' && event.status !== 'CANCELLED' && getEventStatus(event) !== 'completed' && (
                <>
                  <button onClick={() => { setShowPostponeModal(true); setApprovalError(''); }} className="px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg shrink-0">Postpone Event</button>
                  <button onClick={() => { setShowCancelModal(true); setApprovalError(''); }} className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg shrink-0">Cancel Event</button>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Tab Navigation for Organizers */}
          {isOrganizer && (event.status === 'POSTED' || event.status === 'COMPLETED' || event.status === 'POSTPONED') && (
            <div className="px-6 border-b border-slate-200 bg-white flex gap-6 overflow-x-auto shrink-0 z-10">
              {['Overview', 'Registration', 'Attendance'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto">
            
            {activeTab === 'Registration' && <RegistrationsTab event={event} odRequests={odRequests} />}
            {activeTab === 'Attendance' && <AttendanceTab event={event} />}

            {activeTab === 'Overview' && (
              <>
                {/* Emergency Status Banners */}
                {event.status === 'CANCELLED' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle size={20} className="shrink-0" />
                  <span className="font-extrabold text-sm uppercase tracking-wider">⚠ EVENT CANCELLED</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-2">
                  <div><span className="font-bold text-red-900">Reason:</span> <span className="text-red-800">{event.cancellationReason}</span></div>
                  <div><span className="font-bold text-red-900">Cancelled By:</span> <span className="text-red-800">{event.cancelledBy}</span></div>
                  <div className="md:col-span-2"><span className="font-bold text-red-900">Cancelled On:</span> <span className="text-red-800">{event.cancelledAt ? new Date(event.cancelledAt).toLocaleString() : ''}</span></div>
                </div>
              </div>
            )}

            {(event.status === 'POSTPONED' || event.isPostponed) && getEventStatus(event) === 'upcoming' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-800">
                  <Clock3 size={20} className="shrink-0" />
                  <span className="font-extrabold text-sm uppercase tracking-wider">⏳ EVENT POSTPONED</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-2">
                  <div><span className="font-bold text-amber-900">Old Date:</span> <span className="text-amber-800">{event.oldDate}</span></div>
                  <div><span className="font-bold text-amber-900">New Date:</span> <span className="text-amber-800">{event.newDate}</span></div>
                  <div className="md:col-span-2"><span className="font-bold text-amber-900">Reason:</span> <span className="text-amber-800">{event.postponementReason}</span></div>
                  <div className="md:col-span-2"><span className="font-bold text-amber-900">Postponed By:</span> <span className="text-amber-800">{event.postponedBy}</span></div>
                </div>
              </div>
            )}

            {/* Status & Meta Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Current Status</p>
                <StatusBadge status={event.status} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Submitted By</p>
                <p className="text-sm font-semibold text-slate-900">{event.organizerName || 'Not specified'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Created On</p>
                <p className="text-sm font-semibold text-slate-900">{createdOn}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Next Stage</p>
                <p className="text-sm font-semibold text-cse-accent">{getNextApprover() || 'Finalized'}</p>
              </div>
            </div>

            {/* Approval Workflow & Timeline (Visible to organizer and staff only) */}
            {(isOrganizer || currentUser.role !== UserRole.STUDENT) && (
              <>
                <div className="glass-panel p-4 rounded-xl">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-3">Approval Workflow</p>
                  
                  {(() => {
                    const isDeptRejection = event.status === EventStatus.REJECTED && ['HR', 'AUDIO', 'ICTS', 'TRANSPORT', 'WARDEN', 'BOYS_WARDEN', 'GIRLS_WARDEN', 'SYSTEM_ADMIN', 'HR_TEAM', 'AUDIO_TEAM', 'TRANSPORT_TEAM', 'DEPARTMENT OFFICER'].includes(String(event.rejectedByRole).toUpperCase());

                    const isFacultyActive = event.status === EventStatus.PENDING_FACULTY;
                    const isFacultyRejected = event.status === EventStatus.REJECTED && String(event.rejectedByRole).toUpperCase() === 'FACULTY';
                    const isFacultyApproved = !isFacultyActive && !isFacultyRejected && event.status !== EventStatus.PENDING_FACULTY;

                    const isHodActive = event.status === EventStatus.PENDING_HOD;
                    const isHodRejected = event.status === EventStatus.REJECTED && String(event.rejectedByRole).toUpperCase() === 'HOD';
                    const isHodApproved = ['PENDING_DEPARTMENTS', 'PENDING_IQAC', 'APPROVED', 'POSTED', 'COMPLETED'].includes(event.status) || (event.status === EventStatus.REJECTED && !isFacultyRejected && !isHodRejected);

                    const isDeptActive = event.status === EventStatus.PENDING_DEPARTMENTS;
                    const isDeptRejected = event.status === EventStatus.REJECTED && isDeptRejection;
                    const isDeptApproved = ['PENDING_IQAC', 'APPROVED', 'POSTED', 'COMPLETED'].includes(event.status) || (event.status === EventStatus.REJECTED && !isFacultyRejected && !isHodRejected && !isDeptRejected);

                    const isIqacActive = event.status === EventStatus.PENDING_IQAC;
                    const isIqacRejected = event.status === EventStatus.REJECTED && String(event.rejectedByRole).toUpperCase() === 'IQAC';
                    const isIqacApproved = ['POSTED', 'COMPLETED'].includes(event.status);

                    return (
                      <>
                        <div className="flex items-center gap-2 flex-wrap mb-4">
                          {event.creatorType !== 'FACULTY' && (
                            <>
                              <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                                isFacultyActive ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                isFacultyRejected ? 'bg-red-100 text-red-700 border border-red-200' :
                                isFacultyApproved ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                'bg-slate-100 text-slate-400 border border-slate-200'
                              }`}>
                                {isFacultyActive ? '⏳ Faculty Review' :
                                 isFacultyRejected ? '✗ Faculty Rejected' :
                                 isFacultyApproved ? '✓ Faculty Approved' :
                                 'Faculty Review'}
                              </div>
                              <ArrowRight size={14} className="text-slate-300" />
                            </>
                          )}
                          <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                            isHodActive ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                            isHodRejected ? 'bg-red-100 text-red-700 border border-red-200' :
                            isHodApproved ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                            'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}>
                            {isHodActive ? '⏳ HOD Review' :
                             isHodRejected ? '✗ HOD Rejected' :
                             isHodApproved ? '✓ HOD Approved' :
                             'HOD Review'}
                          </div>
                          <ArrowRight size={14} className="text-slate-300" />
                          <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                            isDeptActive ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                            isDeptRejected ? 'bg-red-100 text-red-700 border border-red-200' :
                            isDeptApproved ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                            'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}>
                            {isDeptActive ? '⏳ Dept Review' :
                             isDeptRejected ? '✗ Dept Rejected' :
                             isDeptApproved ? '✓ Depts Approved' :
                             'Dept Review'}
                          </div>
                          <ArrowRight size={14} className="text-slate-300" />
                          <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                            isIqacActive ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                            isIqacRejected ? 'bg-red-100 text-red-700 border border-red-200' :
                            isIqacApproved ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                            'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}>
                            {isIqacActive ? '⏳ IQAC Review' :
                             isIqacRejected ? '✗ IQAC Rejected' :
                             isIqacApproved ? '✓ IQAC Approved' :
                             'IQAC Review'}
                          </div>
                        </div>

                        {/* Detailed Timeline — globally visible to all roles */}
                        {true && (
                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Approval Timeline Details</p>
                            
                            {[
                              { label: 'Faculty', done: isFacultyApproved, rejected: isFacultyRejected, approvedAt: event.facultyApprovedAt, approvedBy: event.facultyApprovedBy },
                              { label: 'HOD', done: isHodApproved, rejected: isHodRejected, approvedAt: event.hodApprovedAt, approvedBy: event.hodApprovedBy },
                            ].map(step => (
                              <div key={step.label} className={`flex items-center gap-3 text-xs ${step.done ? 'text-emerald-700' : step.rejected ? (step.customRejectText ? 'text-amber-700' : 'text-red-700') : 'text-slate-400'}`}>
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${step.done ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : step.rejected ? (step.customRejectText ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]') : 'bg-slate-200'}`} />
                                <span className="font-bold min-w-[70px]">{step.label}</span>
                                {step.done
                                  ? <span className="text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                      {step.approvedAt ? new Date(step.approvedAt).toLocaleString() : (step.customDoneText || 'Approved')}
                                      {step.approvedBy ? ` · ${step.approvedBy}` : ''}
                                    </span>
                                  : step.rejected
                                  ? <span className={`text-[10px] px-2 py-0.5 rounded-md border ${step.customRejectText ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                                      {step.customRejectText || `Rejected by ${event.rejectedByName || 'Approver'} ${event.rejectedAt ? ` · ${new Date(event.rejectedAt).toLocaleString()}` : ''}`}
                                    </span>
                                  : <span className="italic text-slate-300">Pending</span>}
                              </div>
                            ))}

                            {(isHodApproved || event.posterRequired || event.posterWorkflow?.requested) && (() => {
                              const dApprovals = event.departmentApprovals || {};
                              const reqList = event.requisition?.step1?.requirements || {};
                              const isR = k => reqList[k] ?? event[k] ?? false;
                              const accom = event.requisition?.annexureV_accommodation || {};
                              const hasMales = Number(accom.maleGuests || 0) > 0;
                              const hasFemales = Number(accom.femaleGuests || 0) > 0;
                              const isAcc = isR('accommodationDiningRequired') || isR('accommodationRequired');

                              const itemsToShow = [];
                              
                              if (event.posterRequired || event.posterWorkflow?.requested) {
                                const pDone = ['UPLOADED', 'COMPLETED'].includes(String(event.posterWorkflow?.status || '').toUpperCase());
                                const pRej = String(event.posterWorkflow?.status || '').toUpperCase() === 'REWORK_REQUESTED';
                                itemsToShow.push({
                                  key: 'poster',
                                  label: 'Media Poster',
                                  isApp: pDone,
                                  isRej: pRej,
                                  isCustomRej: pRej,
                                  customDoneText: 'Uploaded',
                                  customRejText: 'Rework Requested',
                                  approvedAt: event.posterWorkflow?.finalUploadedAt,
                                  approvedBy: event.posterWorkflow?.finalUploadedBy || 'Media Team',
                                });
                              }

                              if (isHodApproved) {
                                if (isR('venueRequired')) itemsToShow.push({ key: 'venue', label: 'Venue (HR)' });
                                if (isR('audioRequired')) itemsToShow.push({ key: 'audio', label: 'Audio' });
                                if (isR('ictsRequired')) itemsToShow.push({ key: 'icts', label: 'ICTS' });
                                if (isR('transportRequired')) itemsToShow.push({ key: 'transport', label: 'Transport' });
                                if (isAcc && (hasMales || (!hasMales && !hasFemales))) itemsToShow.push({ key: 'boysAccommodation', label: 'Boys Accom.' });
                                if (isAcc && hasFemales) itemsToShow.push({ key: 'girlsAccommodation', label: 'Girls Accom.' });
                                if (isR('mediaRequired')) itemsToShow.push({ key: 'media', label: 'Media (HR)' });
                              }

                              if (!itemsToShow.length) return null;
                              return (
                                <div className="ml-1.5 pl-3 border-l-2 border-slate-100 mt-2 space-y-2">
                                  {itemsToShow.map(d => {
                                    const info = d.key === 'poster' ? d : (dApprovals[d.key] || {});
                                    const isApp = d.key === 'poster' ? d.isApp : info?.status === 'APPROVED';
                                    const isRej = d.key === 'poster' ? d.isRej : info?.status === 'REJECTED';
                                    const isCustomRej = d.isCustomRej;
                                    return (
                                      <div key={d.key} className={`flex items-center gap-3 text-xs ${isApp ? 'text-emerald-700' : isRej ? (isCustomRej ? 'text-amber-700' : 'text-red-700') : 'text-slate-400'}`}>
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isApp ? 'bg-emerald-400' : isRej ? (isCustomRej ? 'bg-amber-400' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]') : 'bg-slate-200'}`} />
                                        <span className="font-medium min-w-[100px]">{d.label}</span>
                                        {isApp
                                          ? <span className="text-[10px] bg-emerald-50/50 px-1.5 py-0.5 rounded border border-emerald-100/50 italic">
                                              {d.customDoneText ? `${d.customDoneText} ` : 'Approved '}
                                              {info.approvedAt ? new Date(info.approvedAt).toLocaleString() : ''}
                                              {info.approvedBy && d.key === 'poster' ? ` · ${info.approvedBy}` : ''}
                                            </span>
                                          : isRej 
                                          ? <span className={`text-[10px] px-1.5 py-0.5 rounded border italic ${isCustomRej ? 'bg-amber-50/80 border-amber-100' : 'bg-red-50/80 border-red-100'}`}>
                                              {d.customRejText || `Rejected by ${info.rejectedBy || 'Approver'} ${info.rejectedAt ? ` · ${new Date(info.rejectedAt).toLocaleString()}` : ''}`}
                                            </span>
                                          : <span className="text-[10px] text-slate-300">Pending</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            <div className={`flex items-center gap-3 text-xs ${isIqacApproved ? 'text-blue-700' : isIqacRejected ? 'text-red-700' : isIqacActive ? 'text-amber-600 font-bold' : 'text-slate-300'}`}>
                              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isIqacApproved ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' : isIqacRejected ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : isIqacActive ? 'bg-amber-400 animate-pulse' : 'bg-slate-200'}`} />
                              <span className="font-bold min-w-[60px]">IQAC / Posting</span>
                              {isIqacApproved
                                ? <span className="text-[10px] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                    Finalized & Posted {event.iqacApprovedAt ? ` · ${new Date(event.iqacApprovedAt).toLocaleString()}` : ''}
                                    {event.iqacApprovedBy ? ` · ${event.iqacApprovedBy}` : ''}
                                  </span>
                                : isIqacRejected 
                                ? <span className="text-[10px] bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                                    Rejected by IQAC {event.rejectedByName ? ` · ${event.rejectedByName}` : ''} {event.rejectedAt ? ` · ${new Date(event.rejectedAt).toLocaleString()}` : ''}
                                  </span>
                                : isIqacActive ? <span className="italic">Reviewing...</span> : <span className="text-[10px]">Waiting</span>}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Rejection Audit Trail Banner */}
                  {event.status === EventStatus.REJECTED && (isOrganizer || currentUser.role !== UserRole.STUDENT) && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-red-800">
                        <XCircle size={18} className="shrink-0" />
                        <span className="font-extrabold text-sm uppercase tracking-wider">Event Rejection Audit Trail</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-white/80 p-2.5 rounded-lg border border-red-100">
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Rejected By</p>
                          <p className="font-semibold text-slate-900">{event.rejectedByName || 'Authorized Approver'}</p>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-lg border border-red-100">
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Role / Department</p>
                          <p className="font-semibold text-slate-900">
                            {event.rejectedByRole || 'Approver'} 
                            {event.rejectedByDept && event.rejectedByDept !== 'N/A' ? ` (${event.rejectedByDept})` : ''}
                          </p>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-lg border border-red-100">
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Timestamp</p>
                          <p className="font-semibold text-slate-900">
                            {event.rejectedAt ? new Date(event.rejectedAt).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-lg border border-red-100 md:col-span-2">
                          <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Reason for Rejection</p>
                          <p className="font-bold text-red-800 italic">"{event.rejectionReason || 'No reason specified'}"</p>
                        </div>
                      </div>

                      <div className="text-[11px] text-red-700 bg-red-100/50 p-2.5 rounded-lg border border-red-100 font-medium leading-relaxed">
                        💡 <strong>Resubmission Guidance:</strong> You can edit this proposal to address the feedback. Locate this event in your Dashboard, click <strong>Edit & Resubmit</strong>, adjust the required parameters, and submit for re-routing.
                      </div>
                    </div>
                  )}
                </div>

            {/* 1. Event Basic Information */}
            <InfoSection title="1. Event Basic Information" icon={FileText}>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Event Reference ID" value={<span className="font-mono font-bold text-slate-800 tracking-wider">{formatEventRef(event)}</span>} fullWidth />
                <InfoRow label="Event Name" value={s1?.eventName} fullWidth />
                <InfoRow label="Event Type" value={s1?.eventType} />
                <InfoRow label="IIC Activity" value={s1?.isIIC} />
                {s1?.professionalSocieties?.length > 0 && (
                  <InfoRow label="Professional Societies" value={s1.professionalSocieties.join(', ')} fullWidth />
                )}
                {s1?.eventStartDate === s1?.eventEndDate ? (
                  <InfoRow label="Event Date" value={s1?.eventStartDate} />
                ) : (
                  <>
                    <InfoRow label="Start Date" value={s1?.eventStartDate} />
                    <InfoRow label="End Date" value={s1?.eventEndDate} />
                  </>
                )}
                <InfoRow label="Number of Days" value={s1?.numberOfDays} />
                <InfoRow label="Start Time" value={formatTime12(s1?.eventStartTime)} />
                <InfoRow label="End Time" value={formatTime12(s1?.eventEndTime)} />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Organizer Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Organizer Name" value={s1?.organizerDetails?.organizerName} />
                  <InfoRow label="Department" value={event.department || s1?.organizerDetails?.department} />
                  <InfoRow label="Mobile Number" value={s1?.organizerDetails?.mobileNumber} />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Participants</p>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Internal Participants" value={s1?.participants?.internalParticipants} />
                  <InfoRow label="External Participants" value={s1?.participants?.externalParticipants} />
                </div>
              </div>

              {(() => {
                const endDateStr = event.requisition?.step1?.eventEndDate || event.date;
                const endTimeStr = event.requisition?.step1?.eventEndTime || event.endTime || '23:59';
                if (!endDateStr) return null;
                
                const eDP = endDateStr.split('-');
                const eTP = endTimeStr.split(':');
                const eventEnd = new Date(parseInt(eDP[0]), parseInt(eDP[1])-1, parseInt(eDP[2]), parseInt(eTP[0]), parseInt(eTP[1]));
                
                const isIQAC = currentUser?.role === UserRole.IQAC_TEAM;
                const isWithinLimit = !isNaN(eventEnd.getTime()) && Date.now() <= (eventEnd.getTime() + 2 * 24 * 60 * 60 * 1000);
                const isPastEvent = (!isNaN(eventEnd.getTime()) && Date.now() >= eventEnd.getTime() && isWithinLimit) || isIQAC;
                
                // Hide if no link OR feedback already submitted by this student
                // 1. User must have an APPROVED participation request
                const odReq = (odRequests || []).find(r => r && r.eventId === event.id && r.studentId === currentUser?.id);
                
                // Hide if not past event, no link, participation NOT approved, or feedback already submitted
                if (!isPastEvent || !event.studentFeedbackLink || odReq?.status !== 'APPROVED' || odReq?.feedback) return null;

                return (
                  <div className="mt-4 pt-4 border-t border-slate-100 italic">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 
                      Feedback Form (Accessible Now)
                    </p>
                    <div className="grid grid-cols-1 gap-4">
                      {event.studentFeedbackLink && (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2.5">
                          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Student Feedback</p>
                          <button 
                            onClick={() => setShowFeedbackModal(true)}
                            className="text-sm font-bold text-blue-700 hover:underline flex items-center gap-1.5 truncate text-left w-full"
                          >
                            <ExternalLink size={14} className="flex-shrink-0" />
                            Open Feedback Link / Form
                          </button>
                        </div>
                      )}
                    </div>

                    {showFeedbackModal && (
                      <FeedbackModal
                        odRequestId={odReq?.id}
                        eventTitle={event.title || event.requisition?.step1?.eventName || 'Event'}
                        googleFormLink={event.studentFeedbackLink}
                        onClose={() => setShowFeedbackModal(false)}
                      />
                    )}
                  </div>
                );
              })()}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Guest Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Number of Guests" value={s1?.guestDetails?.numberOfGuests} />
                  <InfoRow label="Guest Designation" value={s1?.guestDetails?.guestDesignation} />
                  <InfoRow label="Guest Names" value={s1?.guestDetails?.guestNames} fullWidth />
                  <InfoRow label="Organization / Industry" value={s1?.guestDetails?.organizationIndustry} fullWidth />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Requirements</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['Venue', s1?.requirements?.venueRequired],
                    ['Audio', s1?.requirements?.audioRequired],
                    ['ICTS', s1?.requirements?.ictsRequired],
                    ['Transport', s1?.requirements?.transportRequired],
                    ['Accommodation / Dining', s1?.requirements?.accommodationDiningRequired],
                    ['Media', s1?.requirements?.mediaRequired],
                    ['Financial', s1?.requirements?.financialRequired],
                  ].map(([lbl, req]) => (
                    <span key={lbl} className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      req ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {req ? '✓' : '✗'} {lbl}
                    </span>
                  ))}
                </div>
              </div>
              {(s1?.otherRequirements?.gifts?.selected || s1?.otherRequirements?.trophy?.selected || s1?.otherRequirements?.bouquet?.selected) && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-3">Other Requirements</p>
                  <div className="grid grid-cols-3 gap-4">
                    {s1?.otherRequirements?.gifts?.selected && (
                      <InfoRow label="Gifts" value={`Qty: ${s1.otherRequirements.gifts.qty}`} />
                    )}
                    {s1?.otherRequirements?.trophy?.selected && (
                      <InfoRow label="Trophy" value={`Qty: ${s1.otherRequirements.trophy.qty}`} />
                    )}
                    {s1?.otherRequirements?.bouquet?.selected && (
                      <InfoRow label="Bouquet" value={`Qty: ${s1.otherRequirements.bouquet.qty}`} />
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Event Poster</p>
                {(() => {
                  const posterWorkflow = event.posterWorkflow || {};
                  const isPosterRequired = posterWorkflow.requested === true;
                  
                  // Scenario 3: Media uploaded a poster (or organizer manually uploaded)
                  if (eventPosterSrc) {
                    return (
                      <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                        <img
                          src={eventPosterSrc}
                          alt={`${event.title} poster`}
                          className="w-full max-h-[420px] object-contain bg-slate-100"
                          referrerPolicy="no-referrer"
                        />
                        <div className="px-4 py-3 flex items-center justify-between bg-white border-t border-slate-200">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Uploaded By</span>
                            <span className="text-xs font-medium text-slate-700">
                              {posterWorkflow.finalUploadedBy || event.posterUploadedBy || 'Media Team'} 
                              <span className="text-slate-400 ml-1 font-normal">
                                {posterWorkflow.finalUploadedAt || event.posterUploadedAt ? `on ${new Date(posterWorkflow.finalUploadedAt || event.posterUploadedAt).toLocaleDateString()}` : ''}
                              </span>
                            </span>
                          </div>
                          <a
                            href={eventPosterSrc}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 bg-cse-accent text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                          >
                            <ExternalLink size={14} /> Download / View Full
                          </a>
                        </div>
                      </div>
                    );
                  }

                  // Scenario 2: Poster requested but not uploaded yet
                  if (isPosterRequired) {
                    return (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 bg-white border-b border-blue-100 flex items-center gap-2">
                          <span className="text-xl">🎨</span>
                          <span className="font-bold text-sm text-slate-800">Poster Requested from Media Team</span>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold uppercase tracking-wider animate-pulse">Status</span>
                            <span className="text-sm font-semibold text-slate-700">Awaiting Media Upload</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed max-w-lg">
                            The organizer has requested the Media Team to create and upload the official event poster. The poster will appear here once available.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // Scenario 1: Not required and no poster uploaded manually
                  return (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 flex items-center justify-center italic">
                      Poster not required for this event.
                    </div>
                  );
                })()}
              </div>
            </InfoSection>

            {/* Event Schedule Section */}
            {(s1?.schedule?.length > 0 || event?.schedule?.length > 0) && (
              <InfoSection title="Event Schedule / Agenda" icon={ClipboardList}>
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm font-sans">
                  <table className="min-w-full text-sm divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider w-32 border-b border-slate-200">Time</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">Agenda / Activity</th>
                        <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">Speaker / In-charge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 italic">
                      {(s1?.schedule || event?.schedule || []).map((row, idx) => (
                        <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-cse-accent font-bold tabular-nums whitespace-nowrap">
                            {formatTime12(row.time)}
                          </td>
                          <td className="px-4 py-3 text-slate-800 font-medium not-italic">
                            {row.agenda}
                          </td>
                          <td className="px-4 py-3 text-slate-600 not-italic">
                            {row.speaker || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </InfoSection>
            )}

            {/* ── Internal Requirements (Annexures 2 to 7) - Hidden from General Students ── */}
            {(isOrganizer || currentUser.role !== UserRole.STUDENT) && (
              <>
                {/* 2. Venue Requirements - Annexure I */}
            {venueAnnex ? (
              <InfoSection title="2. Venue Requirements (Annexure I)" icon={Building2}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <InfoRow label="Event Date" value={venueAnnex.eventDate} />
                  <InfoRow label="Number of Venues Required" value={venueAnnex.numberOfVenuesRequired} />
                </div>
                {Object.entries(venueAnnex.venueSelection || {}).some(([, v]) => v.selected) && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Venue Selection</p>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Venue</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(venueAnnex.venueSelection).filter(([, v]) => v.selected).map(([name, v]) => (
                            <tr key={name} className="border-t border-slate-100">
                              <td className="px-3 py-2">{name}</td>
                              <td className="px-3 py-2">{v.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {Object.entries(venueAnnex.hallRequirements || {}).some(([, v]) => v.selected) && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Hall Requirements</p>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Item</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(venueAnnex.hallRequirements).filter(([, v]) => v.selected).map(([name, v]) => (
                            <tr key={name} className="border-t border-slate-100">
                              <td className="px-3 py-2">{name}</td>
                              <td className="px-3 py-2">{v.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {venueAnnex.specialRequest && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Special Request</p>
                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-line">{venueAnnex.specialRequest}</div>
                  </div>
                )}
              </InfoSection>
            ) : (
              <InfoSection title="2. Venue Requirements (Annexure I)" icon={Building2}>
                <p className="text-sm text-slate-400">Not required for this event.</p>
              </InfoSection>
            )}

            {/* 3. Audio Requirements - Annexure II */}
            {audioAnnex ? (
              <InfoSection title="3. Audio Requirements (Annexure II)" icon={Mic2}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <InfoRow label="Event Date" value={audioAnnex.eventDate} />
                  <InfoRow label="Venue Name" value={audioAnnex.venueName} />
                   <InfoRow label="Start Time" value={formatTime12(audioAnnex.startTime)} />
                   <InfoRow label="End Time" value={formatTime12(audioAnnex.endTime)} />
                  <InfoRow label="Event Reference ID" value={<span className="font-mono font-bold">{formatEventRef(event)}</span>} fullWidth />
                </div>
                {Object.entries(audioAnnex.audioEquipment || {}).some(([, v]) => v.selected) && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Audio Equipment</p>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Equipment</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(audioAnnex.audioEquipment).filter(([, v]) => v.selected).map(([name, v]) => (
                            <tr key={name} className="border-t border-slate-100">
                              <td className="px-3 py-2">{name}</td>
                              <td className="px-3 py-2">{v.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {audioAnnex.specialRequest && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Special Request</p>
                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-line">{audioAnnex.specialRequest}</div>
                  </div>
                )}
              </InfoSection>
            ) : (
              <InfoSection title="3. Audio Requirements (Annexure II)" icon={Mic2}>
                <p className="text-sm text-slate-400">Not required for this event.</p>
              </InfoSection>
            )}

            {/* 4. ICTS Requirements - Annexure III */}
            {ictsAnnex ? (
              <InfoSection title="4. ICTS Requirements (Annexure III)" icon={MonitorSmartphone}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <InfoRow label="Desktop / Laptop" value={ictsAnnex.desktopLaptop} />
                  <InfoRow label="Internet Facility" value={ictsAnnex.internetFacility} />
                  <InfoRow label="Expected Internet Users" value={ictsAnnex.expectedInternetUsers} />
                </div>
                {Object.entries(ictsAnnex.additionalServices || {}).some(([, v]) => v) && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Additional ICT Services</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(ictsAnnex.additionalServices).filter(([, v]) => v).map(([name]) => (
                        <span key={name} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold">✓ {name}</span>
                      ))}
                    </div>
                  </div>
                )}
                {ictsAnnex.specialRequest && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Special Request</p>
                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-line">{ictsAnnex.specialRequest}</div>
                  </div>
                )}
              </InfoSection>
            ) : (
              <InfoSection title="4. ICTS Requirements (Annexure III)" icon={MonitorSmartphone}>
                <p className="text-sm text-slate-400">Not required for this event.</p>
              </InfoSection>
            )}

            {/* 5. Transport Requirements */}
            {transportAnnex ? (
              <InfoSection title="5. Transport Requirements" icon={Car}>
                <div className="space-y-6">
                  {/* External Transport Block */}
                  {(transportAnnex.transportType === 'external' || transportAnnex.transportType === 'both') && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/30 overflow-hidden">
                      <div className="px-4 py-2 bg-blue-100/50 border-b border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>🚘</span>
                          <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">External Transport</span>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <InfoRow label="Guest" value={`${transportAnnex.externalTransport?.guestName || ''} ${transportAnnex.externalTransport?.guestDesignation ? `(${transportAnnex.externalTransport.guestDesignation})` : ''}`} fullWidth />
                          <InfoRow label="Contact" value={transportAnnex.externalTransport?.guestContact} />
                          <InfoRow label="Email" value={transportAnnex.externalTransport?.guestEmail} />
                          <InfoRow label="Organizer" value={`${transportAnnex.externalTransport?.organizerName || ''} (${transportAnnex.externalTransport?.facultyId || ''})`} />
                          <InfoRow label="Department" value={transportAnnex.externalTransport?.department} />
                          <InfoRow label="Purpose" value={transportAnnex.externalTransport?.purposeOfVisit} fullWidth />
                          <InfoRow label="Mode" value={transportAnnex.externalTransport?.modeOfTransport} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          {['onwardJourney', 'returnJourney'].map((jType) => {
                            const j = transportAnnex.externalTransport?.[jType];
                            return (
                              <div key={jType} className="rounded-lg bg-white border border-blue-100 p-3">
                                <p className="text-[10px] font-bold text-blue-500 uppercase mb-2">{jType === 'onwardJourney' ? '🛫 Onward' : '🛬 Return'}</p>
                                <div className="space-y-1.5">
                                  <InfoRow label="Date" value={j?.vehicleDate} />
                                  <InfoRow label="From" value={j?.startingPlace} />
                                  <InfoRow label="To" value={j?.endPlace} />
                                  <InfoRow label="Time" value={`${formatTime12(j?.startTime)} - ${formatTime12(j?.endTime)}`} />
                                  <InfoRow label="Persons" value={j?.numberOfPersons} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Internal Transport Block */}
                  {(transportAnnex.transportType === 'internal' || transportAnnex.transportType === 'both') && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/30 overflow-hidden">
                      <div className="px-4 py-2 bg-blue-100/50 border-b border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>🚌</span>
                          <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Internal Transport</span>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <InfoRow label="Indenter" value={`${transportAnnex.internalTransport?.indenterName || ''} (${transportAnnex.internalTransport?.employeeId || ''})`} />
                          <InfoRow label="Department" value={transportAnnex.internalTransport?.department} />
                          <InfoRow label="Purpose" value={transportAnnex.internalTransport?.purposeOfVisit} fullWidth />
                          <InfoRow label="Vehicles" value={`${transportAnnex.internalTransport?.numberOfVehicles || ''} ${transportAnnex.internalTransport?.vehicleNumber ? `(No: ${transportAnnex.internalTransport.vehicleNumber})` : ''}`} />
                        </div>
                        
                        {transportAnnex.internalTransport?.industries?.filter(Boolean).length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-blue-500 uppercase mb-1.5">Destinations</p>
                            <div className="flex flex-wrap gap-2">
                              {transportAnnex.internalTransport.industries.filter(Boolean).map((ind, idx) => (
                                <span key={idx} className="px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-700">{ind}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-2">
                          {['onwardJourney', 'returnJourney'].map((jType) => {
                            const j = transportAnnex.internalTransport?.[jType];
                            return (
                              <div key={jType} className="rounded-lg bg-white border border-blue-100 p-3">
                                <p className="text-[10px] font-bold text-blue-500 uppercase mb-2">{jType === 'onwardJourney' ? '🛫 Onward' : '🛬 Return'}</p>
                                <div className="space-y-1.5">
                                  <InfoRow label="Date" value={j?.vehicleDate} />
                                  <InfoRow label="From" value={j?.startingPlace} />
                                  <InfoRow label="To" value={j?.endPlace} />
                                  <InfoRow label="Time" value={`${formatTime12(j?.startTime)} - ${formatTime12(j?.endTime)}`} />
                                  <InfoRow label="Persons" value={j?.numberOfPersons} />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {transportAnnex.internalTransport?.passengers?.length > 0 && (
                          <div className="mt-2">
                            <p className="text-[10px] font-bold text-blue-500 uppercase mb-1.5">Passengers ({transportAnnex.internalTransport.passengers.length})</p>
                            <div className="overflow-x-auto border border-blue-100 rounded-lg bg-white">
                              <table className="w-full text-xs">
                                <thead className="bg-blue-50/50">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-blue-700">#</th>
                                    <th className="text-left px-3 py-2 font-semibold text-blue-700">Name</th>
                                    <th className="text-left px-3 py-2 font-semibold text-blue-700">ID</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-blue-50">
                                  {transportAnnex.internalTransport.passengers.map((p, idx) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-1.5 text-slate-500">{p.sno || idx + 1}</td>
                                      <td className="px-3 py-1.5 font-medium text-slate-700">{p.name || '—'}</td>
                                      <td className="px-3 py-1.5 text-slate-600">{p.employeeId || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fallback for old schema events */}
                  {!transportAnnex.transportType && (
                    <>
                      <div className="mb-5">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-3">External Transport (Legacy Format)</p>
                        <div className="grid grid-cols-2 gap-4">
                          <InfoRow label="Faculty ID" value={transportAnnex.externalTransport?.facultyId} />
                          <InfoRow label="Designation" value={transportAnnex.externalTransport?.organizerDesignation} />
                          <InfoRow label="Contact Number" value={transportAnnex.externalTransport?.contactNumber} />
                          <InfoRow label="Email" value={transportAnnex.externalTransport?.emailId} />
                          <InfoRow label="Guest Details" value={transportAnnex.externalTransport?.guestDetails} fullWidth />
                          <InfoRow label="Purpose of Visit" value={transportAnnex.externalTransport?.purposeOfVisit} />
                          <InfoRow label="Mode of Transport" value={transportAnnex.externalTransport?.modeOfTransport} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          {['onwardJourney', 'returnJourney'].map((jType) => {
                            const j = transportAnnex.externalTransport?.[jType];
                            return (
                              <div key={jType} className="rounded-lg border border-slate-200 p-3 bg-white">
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">{jType === 'onwardJourney' ? 'Onward Journey' : 'Return Journey'}</p>
                                <div className="space-y-1.5">
                                  <InfoRow label="Date" value={j?.vehicleDate} />
                                  <InfoRow label="From" value={j?.startingPlace} />
                                  <InfoRow label="To" value={j?.endPlace} />
                                  <InfoRow label="Time" value={`${formatTime12(j?.startTime)} - ${formatTime12(j?.endTime)}`} />
                                  <InfoRow label="Persons" value={j?.numberOfPersons} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-3">Internal Transport (Legacy Format)</p>
                        <div className="grid grid-cols-2 gap-4">
                          <InfoRow label="Indenter Name" value={transportAnnex.internalTransport?.indenterName} />
                          <InfoRow label="Contact Number" value={transportAnnex.internalTransport?.contactNumber} />
                          <InfoRow label="Designation" value={transportAnnex.internalTransport?.designation} />
                          <InfoRow label="Employee ID" value={transportAnnex.internalTransport?.employeeId} />
                          <InfoRow label="Department" value={transportAnnex.internalTransport?.department} />
                          <InfoRow label="Email" value={transportAnnex.internalTransport?.emailId} />
                          <InfoRow label="No. of Vehicles" value={transportAnnex.internalTransport?.numberOfVehicles} />
                          <InfoRow label="Vehicle Number" value={transportAnnex.internalTransport?.vehicleNumber} />
                          <InfoRow label="Purpose of Visit" value={transportAnnex.internalTransport?.purposeOfVisit} fullWidth />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          {['onwardJourney', 'returnJourney'].map((jType) => {
                            const j = transportAnnex.internalTransport?.[jType];
                            return (
                              <div key={jType} className="rounded-lg border border-slate-200 p-3 bg-white">
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Internal {jType === 'onwardJourney' ? 'Onward Journey' : 'Return Journey'}</p>
                                <div className="space-y-1.5">
                                  <InfoRow label="Date" value={j?.vehicleDate} />
                                  <InfoRow label="From" value={j?.startingPlace} />
                                  <InfoRow label="To" value={j?.endPlace} />
                                  <InfoRow label="Time" value={`${formatTime12(j?.startTime)} - ${formatTime12(j?.endTime)}`} />
                                  <InfoRow label="Persons" value={j?.numberOfPersons} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {transportAnnex.internalTransport?.passengers?.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Passenger List</p>
                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-600">S.No</th>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Name</th>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Employee ID</th>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Designation</th>
                                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Contact</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {transportAnnex.internalTransport.passengers.map((p, idx) => (
                                    <tr key={idx} className="border-t border-slate-100">
                                      <td className="px-3 py-2">{p.sno || idx + 1}</td>
                                      <td className="px-3 py-2">{p.name || '—'}</td>
                                      <td className="px-3 py-2">{p.employeeId || '—'}</td>
                                      <td className="px-3 py-2">{p.designation || '—'}</td>
                                      <td className="px-3 py-2">{p.contactNumber || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {transportAnnex.internalTransport?.industries?.filter(Boolean).length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Industries / Organizations</p>
                            <div className="flex flex-wrap gap-2">
                              {transportAnnex.internalTransport.industries.filter(Boolean).map((ind, idx) => (
                                <span key={idx} className="px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-700">{ind}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </InfoSection>
            ) : (
              <InfoSection title="5. Transport Requirements" icon={Car}>
                <p className="text-sm text-slate-400">Not required for this event.</p>
              </InfoSection>
            )}

            {/* 6. Accommodation & Dining - Annexure V */}
            {accomAnnex ? (
              <InfoSection title="6. Accommodation & Dining (Annexure V)" icon={Hotel}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <InfoRow label="Guest Names" value={accomAnnex.guestNames} fullWidth />
                  <InfoRow label="Guest Designation" value={accomAnnex.guestDesignation} />
                  <InfoRow label="Industry / Institute" value={accomAnnex.industryInstitute} />
                  <InfoRow label="Mobile Number" value={accomAnnex.mobileNumber} />
                  <InfoRow label="Email" value={accomAnnex.email} />
                  <InfoRow label="Address" value={accomAnnex.address} fullWidth />
                  <InfoRow label="Male Guests" value={accomAnnex.maleGuests} />
                  <InfoRow label="Female Guests" value={accomAnnex.femaleGuests} />
                  <InfoRow label="Arrival Date" value={accomAnnex.arrivalDate} />
                   <InfoRow label="Arrival Time" value={formatTime12(accomAnnex.arrivalTime)} />
                   <InfoRow label="Departure Date" value={accomAnnex.departureDate} />
                   <InfoRow label="Departure Time" value={formatTime12(accomAnnex.departureTime)} />
                  <InfoRow label="Number of Days" value={accomAnnex.numberOfDays} />
                  <InfoRow label="Number of Rooms" value={accomAnnex.numberOfRooms} />
                </div>
                {Object.entries(accomAnnex.accommodationTypes || {}).some(([, v]) => v) && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Accommodation Types</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(accomAnnex.accommodationTypes).filter(([, v]) => v).map(([name]) => (
                        <span key={name} className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-semibold">✓ {name}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <InfoRow label="Dining Required" value={accomAnnex.diningRequired ? 'Yes' : 'No'} />
                  {accomAnnex.diningRequired && <InfoRow label="Dining Type" value={accomAnnex.diningType} />}
                </div>
                {accomAnnex.diningRequired && accomAnnex.mealSchedule?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Meal Schedule</p>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-slate-600">Date</th>
                            <th className="px-2 py-2 text-left font-semibold text-slate-600">Guests</th>
                            <th className="px-2 py-2 text-center font-semibold text-slate-600">Breakfast</th>
                            <th className="px-2 py-2 text-center font-semibold text-slate-600">Morn. Ref.</th>
                            <th className="px-2 py-2 text-center font-semibold text-slate-600">Lunch V</th>
                            <th className="px-2 py-2 text-center font-semibold text-slate-600">Lunch NV</th>
                            <th className="px-2 py-2 text-center font-semibold text-slate-600">Eve. Ref.</th>
                            <th className="px-2 py-2 text-center font-semibold text-slate-600">Dinner V</th>
                            <th className="px-2 py-2 text-center font-semibold text-slate-600">Dinner NV</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accomAnnex.mealSchedule.map((row, idx) => (
                            <tr key={idx} className="border-t border-slate-100">
                              <td className="px-2 py-2">{row.date || '—'}</td>
                              <td className="px-2 py-2">{row.guestCount || '—'}</td>
                              {['breakfast','morningRefreshment','lunchVeg','lunchNonVeg','eveningRefreshment','dinnerVeg','dinnerNonVeg'].map((field) => (
                                <td key={field} className="px-2 py-2 text-center">{row[field] ? '✓' : '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {accomAnnex.specialRequest && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Special Request</p>
                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-line">{accomAnnex.specialRequest}</div>
                  </div>
                )}
              </InfoSection>
            ) : (
              <InfoSection title="6. Accommodation & Dining (Annexure V)" icon={Hotel}>
                <p className="text-sm text-slate-400">Not required for this event.</p>
              </InfoSection>
            )}

            {/* 7. Media Requirements - Annexure VI */}
            {mediaAnnex ? (
              <InfoSection title="7. Media Requirements (Annexure VI)" icon={Camera}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                   <InfoRow label="Logos Required" value={mediaAnnex.logosRequired} />
                   <InfoRow label="Photography Time" value={formatTime12(mediaAnnex.photographyTime)} />
                   <InfoRow label="Video Recording Time" value={formatTime12(mediaAnnex.videoRecordingTime)} />
                </div>
                {[
                  { label: 'Poster Design', key: 'posterDesign' },
                  { label: 'Reception TV Design', key: 'receptionTvDesign' },
                  { label: 'Stage Design', key: 'stageDesign' },
                  { label: 'Flex Design', key: 'flexDesign' },
                  { label: 'Other Materials', key: 'otherMaterials' },
                  { label: 'Video Requirements', key: 'videoRequirements' },
                ].map(({ label, key }) => {
                  const items = Object.entries(mediaAnnex[key] || {}).filter(([, v]) => v);
                  if (!items.length) return null;
                  return (
                    <div key={key} className="mb-3">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">{label}</p>
                      <div className="flex flex-wrap gap-2">
                        {items.map(([name]) => (
                          <span key={name} className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-semibold">✓ {name}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {(mediaAnnex.websitePostContent || mediaAnnex.socialPostContent || mediaAnnex.otherMediaRequirement) && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    {mediaAnnex.websitePostContent && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Website Post Content</p>
                        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700">{mediaAnnex.websitePostContent}</div>
                      </div>
                    )}
                    {mediaAnnex.socialPostContent && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Social Post Content</p>
                        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700">{mediaAnnex.socialPostContent}</div>
                      </div>
                    )}
                    {mediaAnnex.otherMediaRequirement && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Other Media Requirement</p>
                        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700">{mediaAnnex.otherMediaRequirement}</div>
                      </div>
                    )}
                  </div>
                )}
                {mediaAnnex.specialRequest && (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Special Request</p>
                    <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-line">{mediaAnnex.specialRequest}</div>
                  </div>
                )}
              </InfoSection>
            ) : (
              <InfoSection title="7. Media Requirements (Annexure VI)" icon={Camera}>
                <p className="text-sm text-slate-400">Not required for this event.</p>
              </InfoSection>
            )}
              </>
            )}
            
            {/* ── 8. IQAC Documentation Checklist (Removed) ── */}
          
          {/* Action Buttons - Sticky Footer */}
          {/* ── IQAC Submission Banner (Organizer) ── */}
          {iqacStatus && (
            <div className="px-6 py-4 border-t border-slate-200 bg-white">
              {iqacStatus.eligible ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    {iqacStatus.reason === 'extended' ? (
                      <div className="flex items-center gap-2 mb-1">
                        <Clock3 size={15} className="text-emerald-500" />
                        <p className="text-sm font-bold text-emerald-800">IQAC Window Extended by Faculty</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 size={15} className="text-emerald-500" />
                        <p className="text-sm font-bold text-emerald-800">IQAC Submission Window Open</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 font-medium">
                      {iqacStatus.reason === 'extended'
                        ? `Extension granted by ${iqacStatus.extendedBy || 'Faculty'}${event.iqacExtensionEndDate ? ` until ${new Date(event.iqacExtensionEndDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}. Submit your IQAC documentation below.`
                        : `${iqacStatus.daysLeft} day${iqacStatus.daysLeft !== 1 ? 's' : ''} remaining to complete your IQAC documentation.`
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedEvent(event); onClose(); navigate(`/${getRolePath(currentUser.role)}/iqac`); }}
                    className="px-6 py-2.5 bg-cse-accent text-white rounded-xl font-bold text-sm hover:bg-cse-accent/90 transition-all shadow-md shadow-cse-accent/20 active:scale-95 flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <FileCheck size={16} /> Submit IQAC Report
                  </button>
                </div>
              ) : iqacStatus.reason === 'requested' ? (
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-200 shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <Clock size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-indigo-900">IQAC Extension Requested</p>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-extrabold uppercase tracking-tighter">Pending HOD Approval</span>
                    </div>
                    <p className="text-xs text-indigo-700 leading-relaxed bg-white/50 p-2 rounded-lg border border-indigo-100 italic">
                      " {iqacStatus.request?.reason} "
                    </p>
                    <p className="text-[10px] text-indigo-500 mt-2 font-medium">Requested {new Date(iqacStatus.request?.requestedAt).toLocaleString()}</p>
                  </div>
                </div>
              ) : iqacStatus.reason === 'expired' ? (
                <div className="flex flex-col gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 shrink-0">
                      <AlertTriangle size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-amber-900">IQAC Submission Window Closed</p>
                      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed font-medium">
                        The 7-day submission window has passed. You must request a formal extension from the HOD to complete the documentation.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 mt-1 bg-white/40 p-4 rounded-xl border border-amber-100">
                    <label className="text-[11px] font-bold text-amber-900 uppercase tracking-widest pl-1">Reason for Extension</label>
                    <textarea 
                      placeholder="Explain why the documentation was delayed (e.g. pending photo collection, guest details delay...)"
                      value={extensionReason}
                      onChange={(e) => setExtensionReason(e.target.value)}
                      className="w-full text-sm p-3 rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white min-h-[80px]"
                    />
                    <div className="flex justify-end gap-3 mt-1">
                      {approvalError && <span className="text-xs text-red-600 font-bold flex-1 flex items-center">{approvalError}</span>}
                      <button
                        onClick={handleRequestExtension}
                        disabled={isRequestingExtension}
                        className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-all shadow-md shadow-amber-900/20 active:scale-95 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isRequestingExtension ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        Send Request to HOD
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* ── Media poster upload (Non-sticky) ── */}
          {isMediaUploadAllowed && (
            <div className="px-6 py-6 border-t border-slate-200 bg-white relative z-10">
              <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Media Poster Upload</p>
                      <p className="text-xs text-slate-500">Provide the designed poster for this event.</p>
                    </div>
                  </div>
                  
                  <PremiumDatePicker 
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handlePosterUpload}
                    disabled={isUploadingPoster || isProcessing}
                  />

                  {eventPosterSrc ? (
                    <div className="flex flex-col gap-3">
                      <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 relative">
                        <img
                          src={eventPosterSrc}
                          alt="Preview"
                          className="w-full max-h-[250px] object-contain bg-slate-100"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={eventPosterSrc}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
                        >
                          <Eye size={14} /> Preview
                        </a>
                        <a
                          href={eventPosterSrc}
                          download={`Poster_${event.title?.replace(/\s+/g, '_') || 'Event'}.jpg`}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
                        >
                          <Download size={14} /> Download
                        </a>
                        <button
                          onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                          disabled={isUploadingPoster || isProcessing}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                        >
                          {isUploadingPoster ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Replace Poster
                        </button>
                        <button
                          onClick={handleRemovePoster}
                          disabled={isUploadingPoster || isProcessing}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 shadow-sm ml-auto"
                        >
                          <XCircle size={14} /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                      disabled={isUploadingPoster || isProcessing}
                      className="w-full py-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isUploadingPoster ? (
                        <><Loader2 size={24} className="animate-spin" /> <span className="text-sm font-semibold">Uploading...</span></>
                      ) : (
                        <><Camera size={24} /> <span className="text-sm font-semibold">Choose Poster Image</span></>
                      )}
                    </button>
                  )}

                  {canFinalizePoster && (
                    <div className="mt-2 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow-sm">
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-indigo-900">Poster Ready for Approval?</p>
                          <p className="text-[10px] text-indigo-600 font-medium">Once approved, it will be visible to everyone.</p>
                        </div>
                      </div>
                      <button
                        onClick={handleFinalizePoster}
                        disabled={isProcessing}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md shadow-indigo-200 active:scale-95 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
                        Approve & Finalize
                      </button>
                    </div>
                  )}
                  {posterUploadError && (
                    <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                      <XCircle size={16} className="shrink-0" /> {posterUploadError}
                    </div>
                  )}
                  {posterUploadSuccess && (
                    <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0" /> {posterUploadSuccess}
                    </div>
                  )}
                </div>
            </div>
          )}

          {(canApprove() || hasAnyDeptApproval) && (
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] z-20">

              {/* ── Department approvals (HR / Audio / ICTS / Transport / Accommodation) ── */}
              {hasAnyDeptApproval && (
                <div className="flex flex-col gap-3">
                  {approvalError && (
                    <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                      <XCircle size={16} className="shrink-0" /> {approvalError}
                    </div>
                  )}
                  <p className="text-sm font-semibold text-slate-700">Approve or Reject Your Department's Requirements</p>

                  <div className="mb-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                      Reason for Rejection *
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter why this requirement is being rejected"
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cse-accent/30 disabled:bg-slate-100"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    {canApproveVenue && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => handleDeptReject('venue')}
                          disabled={isProcessing || !rejectionReason.trim()}
                          className="flex-1 px-5 py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject Venue
                        </button>
                        <button
                          onClick={() => handleDeptApprove('venue')}
                          disabled={isProcessing}
                          className="flex-1 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve Venue
                        </button>
                      </div>
                    )}
                    {canApproveMedia && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => handleDeptReject('media')}
                          disabled={isProcessing || !rejectionReason.trim()}
                          className="flex-1 px-5 py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject Media Booking
                        </button>
                        <button
                          onClick={() => handleDeptApprove('media')}
                          disabled={isProcessing}
                          className="flex-1 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve Media Booking
                        </button>
                      </div>
                    )}
                    {canApproveVenue && canApproveMedia && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={handleHRRejectBoth}
                          disabled={isProcessing || !rejectionReason.trim()}
                          className="flex-1 px-5 py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject Both (HR)
                        </button>
                        <button
                          onClick={handleHRApproveBoth}
                          disabled={isProcessing}
                          className="flex-1 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve Both (HR)
                        </button>
                      </div>
                    )}
                    {canApproveAudio && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => handleDeptReject('audio')}
                          disabled={isProcessing || !rejectionReason.trim()}
                          className="flex-1 px-5 py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject Audio
                        </button>
                        <button
                          onClick={() => handleDeptApprove('audio')}
                          disabled={isProcessing}
                          className="flex-1 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve Audio
                        </button>
                      </div>
                    )}
                    {canApproveICTS && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => handleDeptReject('icts')}
                          disabled={isProcessing || !rejectionReason.trim()}
                          className="flex-1 px-5 py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject ICTS
                        </button>
                        <button
                          onClick={() => handleDeptApprove('icts')}
                          disabled={isProcessing}
                          className="flex-1 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve ICTS
                        </button>
                      </div>
                    )}
                    {canApproveTransport && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => handleDeptReject('transport')}
                          disabled={isProcessing || !rejectionReason.trim()}
                          className="flex-1 px-5 py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject Transport
                        </button>
                        <button
                          onClick={() => handleDeptApprove('transport')}
                          disabled={isProcessing}
                          className="flex-1 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve Transport
                        </button>
                      </div>
                    )}
                    {canApproveBoysAccommodation && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => handleDeptReject('boysAccommodation')}
                          disabled={isProcessing || !rejectionReason.trim()}
                          className="flex-1 px-5 py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject Boys Accommodation
                        </button>
                        <button
                          onClick={() => handleDeptApprove('boysAccommodation')}
                          disabled={isProcessing}
                          className="flex-1 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve Boys Accommodation
                        </button>
                      </div>
                    )}
                    {canApproveGirlsAccommodation && (
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => handleDeptReject('girlsAccommodation')}
                          disabled={isProcessing || !rejectionReason.trim()}
                          className="flex-1 px-5 py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Reject Girls Accommodation
                        </button>
                        <button
                          onClick={() => handleDeptApprove('girlsAccommodation')}
                          disabled={isProcessing}
                          className="flex-1 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Approve Girls Accommodation
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Faculty / HOD approve + reject ── */}
              {!hasAnyDeptApproval && canApprove() && (
                <>
                  {approvalError && (
                    <div className="mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                      <XCircle size={16} className="shrink-0" />
                      {approvalError}
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                      Reason for Rejection *
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter why this event is being rejected"
                      disabled={isProcessing}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-cse-accent/30 disabled:bg-slate-100"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-sm text-slate-600">
                      {getNextApprover() && (
                        <p className="flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span>Approving will forward to: <span className="font-semibold text-cse-accent">{getNextApprover()}</span></span>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <button
                        onClick={handleReject}
                        disabled={isProcessing || !rejectionReason.trim()}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <><Loader2 size={16} className="animate-spin" /> Processing...</>
                        ) : (
                          <><XCircle size={16} /> Reject</>
                        )}
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={isProcessing}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <><Loader2 size={16} className="animate-spin" /> Approving...</>
                        ) : (
                          <><CheckCircle2 size={16} /> Approve & Forward</>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
            </>
          )}
    </div>
  </motion.div>

    {/* Cancel Event Modal */}
    {showCancelModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold text-red-600 mb-2 flex items-center gap-2"><AlertTriangle size={24}/> Cancel Event</h3>
          <p className="text-sm text-slate-600 mb-4">This action is irreversible. All registrations and ODs will be marked as cancelled.</p>
          {cancelError && <div className="mb-4 text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg">{cancelError}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Cancellation</label>
              <textarea 
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500" 
                rows="3"
                placeholder="Why is this event being cancelled?"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Type "CANCEL EVENT" to confirm</label>
              <input 
                type="text" 
                value={cancelConfirmation}
                onChange={(e) => setCancelConfirmation(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="CANCEL EVENT"
              />
            </div>
            <div className="flex items-center gap-2 justify-end mt-6">
              <button disabled={isProcessing} onClick={() => { setShowCancelModal(false); setCancelError(null); }} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Keep Event</button>
              <button disabled={isProcessing} onClick={handleCancelEvent} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2">
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : null} Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Postpone Event Modal */}
    {showPostponeModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-bold text-amber-600 mb-2 flex items-center gap-2"><Clock3 size={24}/> Postpone Event</h3>
          <p className="text-sm text-slate-600 mb-4">Move the event to a new date and time. Registrations and ODs remain valid.</p>
          {postponeError && <div className="mb-4 text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg">{postponeError}</div>}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Postponement</label>
              <input 
                type="text"
                value={postponeReason}
                onChange={(e) => setPostponeReason(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" 
                placeholder="e.g. Chief guest unavailable"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">{isMultiDay ? 'New Start Date' : 'New Date'}</label>
                <input 
                   
                  value={postponeDate}
                  onChange={(e) => {
                    setPostponeDate(e.target.value);
                    if (!isMultiDay) setPostponeEndDate(e.target.value);
                  }}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" 
                />
              </div>
              {isMultiDay && (
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">New End Date</label>
                  <PremiumDatePicker  
                     
                    value={postponeEndDate}
                    onChange={(e) => setPostponeEndDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" 
                  />
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">New Start Time</label>
                <div className="w-full border border-slate-300 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 bg-white">
                  <TimePicker 
                    id="postponeStartTime"
                    value={postponeStartTime}
                    onChange={(e) => setPostponeStartTime(e.target.value)}
                    className="w-full px-2 py-1" 
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">New End Time</label>
                <div className="w-full border border-slate-300 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500 bg-white">
                  <TimePicker 
                    id="postponeEndTime"
                    value={postponeEndTime}
                    onChange={(e) => setPostponeEndTime(e.target.value)}
                    className="w-full px-2 py-1" 
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end mt-6">
              <button disabled={isProcessing} onClick={() => { setShowPostponeModal(false); setPostponeError(null); }} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button disabled={isProcessing} onClick={handlePostponeEvent} className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg flex items-center gap-2">
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : null} Confirm Postponement
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
      </motion.div>
    </AnimatePresence>
  );
};

export default EventDetailModal;
