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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { EventStatus, UserRole } from '../types';
import StatusBadge from './StatusBadge';

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

  const canApprove = () => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.FACULTY && event.status === EventStatus.PENDING_FACULTY) return true;
    if (currentUser.role === UserRole.HOD && event.status === EventStatus.PENDING_HOD) return true;
    if (currentUser.role === UserRole.PRINCIPAL && event.status === EventStatus.PENDING_PRINCIPAL) return true;
    return false;
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
              <h2 className="text-2xl font-bold text-slate-900">{event.title}</h2>
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
                  event.status === EventStatus.PENDING_FACULTY ? 'bg-amber-100 text-amber-700' :
                  event.status === EventStatus.REJECTED ? 'bg-red-100 text-red-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {event.status === EventStatus.PENDING_FACULTY ? '⏳ Faculty Review' :
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
                <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
                  ✗ This event has been rejected and will not proceed further.
                  {event.rejectionReason && (
                    <p className="mt-1 font-medium text-[11px] text-red-800">
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
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] uppercase tracking-wider font-bold border ${
                  event.creatorType === 'FACULTY' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}>
                  {event.creatorType === 'FACULTY' ? 'Faculty Event' : 'Student Event'}
                </span>
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

export default EventDetailModal;
