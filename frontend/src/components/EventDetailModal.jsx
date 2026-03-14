import {
  X,
  Clock,
  User,
  Users,
  Monitor,
  Camera,
  Car,
  Hotel,
  Mic2,
  Building2,
  MonitorSmartphone,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
  FileCheck,
  Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { EventStatus, UserRole } from '../types';
import StatusBadge from './StatusBadge';
import ErrorBoundary from './ErrorBoundary';

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const compressImageToDataUrl = (file, maxWidth = 1200, quality = 0.82) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Unable to process image'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = reader.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

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

const EventDetailModal = ({ event, onClose }) => {
  const { currentUser, handleApproval } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [posterUploadError, setPosterUploadError] = useState('');
  const [posterUploadSuccess, setPosterUploadSuccess] = useState('');
  const [isWorkflowUpdating, setIsWorkflowUpdating] = useState(false);
  const [workflowError, setWorkflowError] = useState('');
  const [workflowSuccess, setWorkflowSuccess] = useState('');
  const [organizerReviewComment, setOrganizerReviewComment] = useState('');

  // Calculate if event has started (must be AFTER all hooks)
  let eventHasStarted = false;
  let eventHasEnded = false;
  if (event?.requisition?.step1?.eventStartDate && event?.requisition?.step1?.eventStartTime) {
    const startDate = event.requisition.step1.eventStartDate;
    const startTime = event.requisition.step1.eventStartTime;
    const startDateTime = new Date(`${startDate}T${startTime}`);
    eventHasStarted = Date.now() >= startDateTime.getTime();
    
    // Default to start date if end date is missing
    const endDate = event.requisition.step1.eventEndDate || startDate;
    const endTime = event.requisition.step1.eventEndTime || '23:59';
    const endDateTime = new Date(`${endDate}T${endTime}`);
    eventHasEnded = Date.now() >= endDateTime.getTime();
  }

  if (!event) return null;

  const r = event.requisition;
  const s1 = r?.step1;
  const venueAnnex = r?.annexureI_venue;
  const audioAnnex = r?.annexureII_audio;
  const ictsAnnex = r?.annexureIII_icts;
  const transportAnnex = r?.annexureIV_transport;
  const accomAnnex = r?.annexureV_accommodation;
  const mediaAnnex = r?.annexureVI_media;
  const createdOn = event?.createdAt ? new Date(event.createdAt).toLocaleDateString() : 'Not available';
  const eventDateRange = s1?.eventStartDate && s1?.eventEndDate
    ? `${s1.eventStartDate} to ${s1.eventEndDate}`
    : (event?.date || 'Not specified');
  const enabledRequirementCount = Object.values(s1?.requirements || {}).filter(Boolean).length;
  const eventPosterSrc = event?.posterDataUrl || event?.posterUrl || null;
  const posterWorkflow = event?.posterWorkflow || null;
  const posterWorkflowStatus = String(posterWorkflow?.status || '').toUpperCase();
  const isSystemAutoRejected =
    event.status === EventStatus.REJECTED &&
    String(event?.autoRejectedBy || '').toUpperCase() === 'SYSTEM';
  const isApprovedEvent = ['POSTED', 'COMPLETED'].includes(String(event.status).toUpperCase());
  const isEventOrganizer = Boolean(currentUser) && event.organizerId === currentUser.id;
  const canUploadFinalPosterAsMedia = currentUser?.role === UserRole.MEDIA && !eventHasEnded;
  const canUpdatePosterForOrganizer = isEventOrganizer && [UserRole.STUDENT_ORGANIZER, UserRole.FACULTY].includes(currentUser.role) && !posterWorkflow?.requested;
  const canUpdatePoster = canUpdatePosterForOrganizer || canUploadFinalPosterAsMedia;
  const canManagePosterWorkflowAsMedia = false; // Draft workflow is superseded by direct upload for Media
  const canReviewPosterWorkflowAsOrganizer = false; // We use direct uploads now

  const canApprove = () => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.FACULTY && event.status === EventStatus.PENDING_FACULTY) return true;
    if (currentUser.role === UserRole.HOD && event.status === EventStatus.PENDING_HOD) return true;
    if (currentUser.role === UserRole.PRINCIPAL && event.status === EventStatus.PENDING_PRINCIPAL) return true;
    return false;
  };

  const isFacultyCreated = String(event.createdByRole || event.creatorType || '').toUpperCase() === UserRole.FACULTY;

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
    switch (event.status) {
      case EventStatus.PENDING_FACULTY:
        return 'HOD';
      case EventStatus.PENDING_HOD:
        return 'Principal';
      case EventStatus.PENDING_PRINCIPAL:
        return 'Posted for all students';
      default:
        return '';
    }
  };

  const handlePosterUpload = async (uploadEvent) => {
    const file = uploadEvent.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPosterUploadError('Please upload an image file for the event poster.');
      uploadEvent.target.value = '';
      return;
    }

    try {
      setIsUploadingPoster(true);
      setPosterUploadError('');
      setPosterUploadSuccess('');

      const posterDataUrl = file.type === 'image/gif'
        ? await fileToDataUrl(file)
        : await compressImageToDataUrl(file);

      if (posterDataUrl.length > 10 * 1024 * 1024) {
        setPosterUploadError('Poster is too large after processing. Please use a smaller image.');
        return;
      }

      const response = await fetch(`http://localhost:5001/api/events/${event.id}/poster`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posterDataUrl,
          posterFileName: file.name,
          posterMimeType: file.type,
          updatedBy: currentUser?.name || currentUser?.email || 'Unknown User',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to upload poster');
      }

      // If Media uploads directly, auto-complete the poster workflow to clear it from their queue
      if (currentUser?.role === UserRole.MEDIA && event.posterWorkflow?.requested) {
        await fetch(`http://localhost:5001/api/events/${event.id}/poster-workflow`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'COMPLETED',
            finalUploadedAt: new Date().toISOString(),
            finalUploadedBy: currentUser?.name || currentUser?.email || 'Media Team',
            updatedBy: currentUser?.name || currentUser?.email || 'Media Team',
          }),
        }).catch(err => console.error('Failed to complete poster workflow:', err));
      }

      setPosterUploadSuccess('Poster uploaded successfully. The latest version will appear automatically.');

      // Force local event list refresh for instant UI update
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('eventPosterUpdated', { detail: { eventId: event.id } }));
      }
    } catch (error) {
      setPosterUploadError(error.message || 'Failed to upload poster.');
    } finally {
      setIsUploadingPoster(false);
      uploadEvent.target.value = '';
    }
  };

  const updatePosterWorkflow = async (payload) => {
    const response = await fetch(`http://localhost:5001/api/events/${event.id}/poster-workflow`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to update poster workflow');
    }
  };

  const handleMediaDraftUpload = async (uploadEvent) => {
    const file = uploadEvent.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setWorkflowError('Please upload an image file for media draft poster.');
      uploadEvent.target.value = '';
      return;
    }

    try {
      setIsWorkflowUpdating(true);
      setWorkflowError('');
      setWorkflowSuccess('');

      const mediaDraftDataUrl = file.type === 'image/gif'
        ? await fileToDataUrl(file)
        : await compressImageToDataUrl(file);

      if (mediaDraftDataUrl.length > 10 * 1024 * 1024) {
        setWorkflowError('Draft poster is too large after processing. Please use a smaller image.');
        return;
      }

      await updatePosterWorkflow({
        status: 'SENT_TO_ORGANIZER',
        mediaDraftDataUrl,
        mediaDraftFileName: file.name,
        mediaDraftMimeType: file.type,
        mediaResponseBy: currentUser?.name || currentUser?.email || 'Media Team',
        updatedBy: currentUser?.name || currentUser?.email || 'Media Team',
      });

      setWorkflowSuccess('Draft poster sent to organizer for review.');
    } catch (error) {
      setWorkflowError(error.message || 'Failed to send draft poster to organizer.');
    } finally {
      setIsWorkflowUpdating(false);
      uploadEvent.target.value = '';
    }
  };

  const handleOrganizerPosterDecision = async (approve) => {
    if (!approve && !String(organizerReviewComment || '').trim()) {
      setWorkflowError('Please add a rework comment before sending back to media team.');
      return;
    }

    try {
      setIsWorkflowUpdating(true);
      setWorkflowError('');
      setWorkflowSuccess('');

      await updatePosterWorkflow({
        status: approve ? 'APPROVED_BY_ORGANIZER' : 'REWORK_REQUESTED',
        organizerDecisionBy: currentUser?.name || currentUser?.email || 'Organizer',
        organizerReviewComment: String(organizerReviewComment || '').trim(),
        updatedBy: currentUser?.name || currentUser?.email || 'Organizer',
      });

      setWorkflowSuccess(approve
        ? 'Poster draft approved. You can now upload it in Event Poster as final.'
        : 'Rework request sent back to media team.');
      if (approve) {
        setOrganizerReviewComment('');
      }
    } catch (error) {
      setWorkflowError(error.message || 'Failed to update organizer decision.');
    } finally {
      setIsWorkflowUpdating(false);
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
          className="bg-slate-50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                {event.title}
                {event.isResubmitted && (
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-[11px] uppercase tracking-wider font-bold">
                    Resubmitted
                  </span>
                )}
              </h2>
              <p className="text-sm text-slate-500 mt-1">Approval review workspace</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 border border-blue-200">{eventDateRange}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 border border-emerald-200">{enabledRequirementCount} requirements enabled</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
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

            {/* Approval Workflow Indicator */}
            <div className="glass-panel p-4 rounded-xl">
              <p className="text-xs font-bold text-slate-400 uppercase mb-3">Approval Workflow</p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Faculty step */}
                <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  isFacultyCreated ? 'bg-slate-100 text-slate-500' :
                  event.status === EventStatus.PENDING_FACULTY ? 'bg-amber-100 text-amber-700' :
                  event.status === EventStatus.REJECTED ? 'bg-red-100 text-red-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {isFacultyCreated ? '↷ Faculty Skipped' :
                   event.status === EventStatus.PENDING_FACULTY ? '⏳ Faculty Review' :
                   event.status === EventStatus.REJECTED ? '✗ Faculty Rejected' :
                   '✓ Faculty Approved'}
                </div>
                <ArrowRight size={14} className="text-slate-300" />
                {/* HOD step */}
                <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  event.status === EventStatus.PENDING_HOD ? 'bg-amber-100 text-amber-700' :
                  [EventStatus.PENDING_PRINCIPAL, EventStatus.POSTED, EventStatus.APPROVED, EventStatus.COMPLETED].includes(event.status) ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {event.status === EventStatus.PENDING_HOD ? '⏳ HOD Review' :
                   [EventStatus.PENDING_PRINCIPAL, EventStatus.POSTED, EventStatus.APPROVED, EventStatus.COMPLETED].includes(event.status) ? '✓ HOD Approved' :
                   'HOD Review'}
                </div>
                <ArrowRight size={14} className="text-slate-300" />
                {/* Principal step */}
                <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                  event.status === EventStatus.PENDING_PRINCIPAL ? 'bg-amber-100 text-amber-700' :
                  [EventStatus.POSTED, EventStatus.APPROVED, EventStatus.COMPLETED].includes(event.status) ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  {event.status === EventStatus.PENDING_PRINCIPAL ? '⏳ Principal Review' :
                   [EventStatus.POSTED, EventStatus.APPROVED, EventStatus.COMPLETED].includes(event.status) ? '✓ Principal Approved' :
                   'Principal Review'}
                </div>
                <ArrowRight size={14} className="text-slate-300" />
                {/* Posted step */}
                <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  [EventStatus.POSTED, EventStatus.APPROVED, EventStatus.COMPLETED].includes(event.status) ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  {[EventStatus.POSTED, EventStatus.APPROVED, EventStatus.COMPLETED].includes(event.status) ? '🎉 Posted' : 'Posted'}
                </div>
              </div>
              {/* Rejected banner */}
              {event.status === EventStatus.REJECTED && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-semibold border ${
                  isSystemAutoRejected
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  {isSystemAutoRejected
                    ? `Auto-rejected by system because approval was not completed before the configured cutoff.${currentUser?.role === 'ORGANIZER' ? ' You can edit and resubmit this event from Dashboard.' : ''}`
                    : `This event has been rejected.${currentUser?.role === 'ORGANIZER' ? ' You can edit and resubmit this event from Dashboard.' : ''}`}
                  {event.rejectionReason && (
                    <p className={`mt-1 font-medium text-[11px] ${isSystemAutoRejected ? 'text-amber-900' : 'text-red-800'}`}>
                      Reason: {event.rejectionReason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 1. Event Basic Information */}
            <InfoSection title="1. Event Basic Information" icon={FileText}>
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Event Code" value={event?.eventCode || event?.id} fullWidth />
                <InfoRow label="IQAC Number" value={r?.iqacNumber} fullWidth />
                <InfoRow label="Event Name" value={s1?.eventName} fullWidth />
                <InfoRow label="Event Type" value={s1?.eventType} />
                <InfoRow label="IIC Activity" value={s1?.isIIC} />
                {s1?.professionalSocieties?.length > 0 && (
                  <InfoRow label="Professional Societies" value={s1.professionalSocieties.join(', ')} fullWidth />
                )}
                <InfoRow label="Start Date" value={s1?.eventStartDate} />
                <InfoRow label="End Date" value={s1?.eventEndDate} />
                <InfoRow label="Number of Days" value={s1?.numberOfDays} />
                <InfoRow label="Start Time" value={s1?.eventStartTime} />
                <InfoRow label="End Time" value={s1?.eventEndTime} />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Organizer Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Organizer Name" value={s1?.organizerDetails?.organizerName} />
                  <InfoRow label="Department" value={s1?.organizerDetails?.department} />
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
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-3">Guest Details</p>
                {Array.isArray(s1?.guestDetails?.guests) && s1.guestDetails.guests.length > 0 ? (
                  <div className="space-y-3">
                    {s1.guestDetails.guests.map((guest, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-4 border border-slate-200 rounded-xl bg-slate-50 px-3 py-2">
                        <InfoRow label="Name" value={guest.name} />
                        <InfoRow label="Designation" value={guest.designation} />
                        <InfoRow label="Organization" value={guest.organization} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <InfoRow label="Number of Guests" value={s1?.guestDetails?.numberOfGuests} />
                    <InfoRow label="Guest Designation" value={s1?.guestDetails?.guestDesignation} />
                    <InfoRow label="Guest Names" value={s1?.guestDetails?.guestNames} fullWidth />
                    <InfoRow label="Organization / Industry" value={s1?.guestDetails?.organizationIndustry} fullWidth />
                  </div>
                )}
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
                {posterWorkflow?.requested && (
                  <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                    <p className="font-semibold">Poster Workflow Status: {posterWorkflowStatus.replace(/_/g, ' ')}</p>
                    {(posterWorkflow.neededByDate || posterWorkflow.neededByTime) && (
                      <p className="mt-1">Needed By: {posterWorkflow.neededByDate || '-'} {posterWorkflow.neededByTime || ''}</p>
                    )}
                    {posterWorkflow.requestNotes && (
                      <p className="mt-1">Brief: {posterWorkflow.requestNotes}</p>
                    )}
                    {posterWorkflow.organizerReviewComment && (
                      <p className="mt-1">Organizer Comment: {posterWorkflow.organizerReviewComment}</p>
                    )}
                  </div>
                )}

                {posterWorkflow?.mediaDraftDataUrl && (
                  <div className="mb-4 rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                    <img
                      src={posterWorkflow.mediaDraftDataUrl}
                      alt={`${event.title} media draft poster`}
                      className="w-full max-h-[360px] object-contain bg-slate-100"
                      referrerPolicy="no-referrer"
                    />
                    <div className="px-3 py-2 bg-white border-t border-slate-200 text-xs text-slate-600">
                      Media Draft: {posterWorkflow.mediaDraftFileName || 'Draft image'}
                    </div>
                  </div>
                )}

                {eventPosterSrc ? (
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                    <img
                      src={eventPosterSrc}
                      alt={`${event.title} poster`}
                      className="w-full max-h-[420px] object-contain bg-slate-100"
                      referrerPolicy="no-referrer"
                    />
                    <div className="px-3 py-2 bg-white border-t border-slate-200">
                      <a
                        href={eventPosterSrc}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-cse-accent hover:underline"
                      >
                        <ExternalLink size={13} /> View full poster
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No poster uploaded for this event.
                  </div>
                )}

                {canManagePosterWorkflowAsMedia && ['REQUESTED', 'REWORK_REQUESTED'].includes(posterWorkflowStatus) && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-amber-800">Media Action</p>
                    <p className="text-xs text-amber-700">
                      Upload the draft poster and send it to organizer for approval.
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:opacity-90"
                      onChange={handleMediaDraftUpload}
                      disabled={isWorkflowUpdating}
                    />
                  </div>
                )}

                {canReviewPosterWorkflowAsOrganizer && posterWorkflowStatus === 'SENT_TO_ORGANIZER' && (
                  <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
                    <p className="text-sm font-semibold text-indigo-800">Organizer Review</p>
                    <textarea
                      rows={3}
                      className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="Add optional feedback (required only for rework)."
                      value={organizerReviewComment}
                      onChange={(e) => setOrganizerReviewComment(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleOrganizerPosterDecision(true)}
                        disabled={isWorkflowUpdating}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Approve Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOrganizerPosterDecision(false)}
                        disabled={isWorkflowUpdating}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
                      >
                        Request Rework
                      </button>
                    </div>
                  </div>
                )}

                {canUpdatePoster && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Upload Event Poster</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {currentUser?.role === UserRole.MEDIA
                          ? 'Upload the finalized event poster here. This updates the live event directly.'
                          : 'When Media shares the final design, or if you created it yourself, upload the poster here.'}
                       </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-cse-accent file:px-4 file:py-2 file:font-semibold file:text-white hover:file:opacity-90"
                      onChange={handlePosterUpload}
                      disabled={isUploadingPoster || (currentUser?.role === UserRole.MEDIA ? eventHasEnded : eventHasStarted)}
                    />
                    {(currentUser?.role === UserRole.MEDIA ? eventHasEnded : eventHasStarted) && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Poster upload is disabled because the event has {currentUser?.role === UserRole.MEDIA ? 'ended' : 'started'}.
                      </div>
                    )}
                    {isUploadingPoster && (
                      <div className="inline-flex items-center gap-2 text-xs font-semibold text-cse-accent">
                        <Loader2 size={14} className="animate-spin" /> Uploading poster...
                      </div>
                    )}
                    {posterUploadError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {posterUploadError}
                      </div>
                    )}
                    {posterUploadSuccess && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        {posterUploadSuccess}
                      </div>
                    )}
                    {isWorkflowUpdating && (
                      <div className="inline-flex items-center gap-2 text-xs font-semibold text-cse-accent">
                        <Loader2 size={14} className="animate-spin" /> Updating poster workflow...
                      </div>
                    )}
                    {workflowError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {workflowError}
                      </div>
                    )}
                    {workflowSuccess && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        {workflowSuccess}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </InfoSection>

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
                  <InfoRow label="Start Time" value={audioAnnex.startTime} />
                  <InfoRow label="End Time" value={audioAnnex.endTime} />
                  <InfoRow label="IQAC Number" value={audioAnnex.iqacNumber} fullWidth />
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

            {/* 5. Transport Requirements - Annexure IV */}
            {transportAnnex ? (
              <InfoSection title="5. Transport Requirements (Annexure IV)" icon={Car}>
                <div className="mb-5">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-3">External Transport (Annexure IV a)</p>
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
                        <div key={jType} className="rounded-lg border border-slate-200 p-3">
                          <p className="text-xs font-bold text-slate-500 uppercase mb-2">{jType === 'onwardJourney' ? 'Onward Journey' : 'Return Journey'}</p>
                          <div className="space-y-2">
                            <InfoRow label="Date" value={j?.vehicleDate} />
                            <InfoRow label="From" value={j?.startingPlace} />
                            <InfoRow label="Start Time" value={j?.startTime} />
                            <InfoRow label="To" value={j?.endPlace} />
                            <InfoRow label="End Time" value={j?.endTime} />
                            <InfoRow label="No. of Persons" value={j?.numberOfPersons} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-3">Internal Transport (Annexure IV b)</p>
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
                        <div key={jType} className="rounded-lg border border-slate-200 p-3">
                          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Internal {jType === 'onwardJourney' ? 'Onward Journey' : 'Return Journey'}</p>
                          <div className="space-y-2">
                            <InfoRow label="Date" value={j?.vehicleDate} />
                            <InfoRow label="From" value={j?.startingPlace} />
                            <InfoRow label="Start Time" value={j?.startTime} />
                            <InfoRow label="To" value={j?.endPlace} />
                            <InfoRow label="End Time" value={j?.endTime} />
                            <InfoRow label="No. of Persons" value={j?.numberOfPersons} />
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
              </InfoSection>
            ) : (
              <InfoSection title="5. Transport Requirements (Annexure IV)" icon={Car}>
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
                  <InfoRow label="Arrival Time" value={accomAnnex.arrivalTime} />
                  <InfoRow label="Departure Date" value={accomAnnex.departureDate} />
                  <InfoRow label="Departure Time" value={accomAnnex.departureTime} />
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
                  <InfoRow label="Photography Time" value={mediaAnnex.photographyTime} />
                  <InfoRow label="Video Recording Time" value={mediaAnnex.videoRecordingTime} />
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

            {/* 8. IQAC Submission Details */}
            {event.iqacData && (
              <InfoSection title="8. IQAC Post-Event Submission" icon={FileCheck}>
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Event Outcome</p>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-sm text-emerald-900 whitespace-pre-line">
                      {event.iqacData.eventOutcome || 'No outcome provided.'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Registration vs Attendance</p>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">Total Registered:</span>
                          <span className="font-semibold text-slate-900">{event.iqacData.registration?.total || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">Total Attended:</span>
                          <span className="font-semibold text-emerald-600">{event.iqacData.registration?.attendance?.total || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-2">
                          <span className="text-slate-600">Attendance Rate:</span>
                          <span className="font-semibold text-cse-accent">{event.iqacData.registration?.attendance?.attendanceRate || '0%'}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Student Feedback Summary</p>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">Total Responses:</span>
                          <span className="font-semibold text-slate-900">{event.iqacData.feedbackSummary?.totalResponses || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm flex-1">
                          <span className="text-slate-600">Average Rating:</span>
                          <div className="flex items-center gap-1 font-semibold text-amber-600">
                            {event.iqacData.feedbackSummary?.averageRating || '-'} <Star size={14} className="fill-amber-500" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {event.iqacData.gallery?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Event Gallery</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {event.iqacData.gallery.map((img, idx) => (
                          <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-slate-200">
                            <img src={img.url} alt={img.title || `Gallery ${idx}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(event.iqacData.documents || {}).length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Submitted Documents</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(event.iqacData.documents).map(([docName, docInfo]) => (
                          <div key={docName} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                            <CheckCircle size={14} className={docInfo.verified ? "text-emerald-500" : "text-blue-500"} />
                            <span className="font-medium text-slate-700">{docName}</span>
                            {docInfo.dataUrl && (
                              <a href={docInfo.dataUrl} download={docInfo.fileName} className="text-cse-accent hover:underline ml-1">(Download)</a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </InfoSection>
            )}
          </div>

          {/* Action Buttons - Sticky Footer */}
          {canApprove() && (
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4">
              {approvalError && (
                <div className="mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <XCircle size={16} className="shrink-0" />
                  {approvalError}
                </div>
              )}
              <div className="mb-3">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Rejection Reason (required to reject)
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
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  {getNextApprover() && (
                    <p className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-600" />
                      Approving will forward to: <span className="font-semibold text-cse-accent">{getNextApprover()}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleReject}
                    disabled={isProcessing}
                    className="px-6 py-2.5 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <XCircle size={18} /> Reject
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} /> Approve & Forward
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default function EventDetailModalWithBoundary(props) {
  return (
    <ErrorBoundary>
      <EventDetailModal {...props} />
    </ErrorBoundary>
  );
}
