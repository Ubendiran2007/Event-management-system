import { X, User, Calendar, Clock, MapPin, FileText, CheckCircle2, XCircle, AlertCircle, MessageSquare, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { ODRequestStatus, UserRole } from '../types';
import { formatRollNo, formatStudentNameWithRoll, fallbackValue, getAttendanceMode } from '../utils/formatters';
import StatusBadge from './StatusBadge';
import { generateODLetterBase64 } from '../utils/pdfGenerator';

const ODRequestDetailModal = ({ request, onClose }) => {
  const { currentUser, handleODApproval, events, odRequests } = useAppContext();
  const [approving, setApproving] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isFinalized = request.status === ODRequestStatus.APPROVED || request.status === ODRequestStatus.REJECTED;

  if (!request) return null;

  const event = events?.find((e) => e.id === request.eventId);
  const s1 = event?.requisition?.step1;
  const isHistorical = event?.status === 'COMPLETED' || event?.status === 'CANCELLED';

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  let eventName = 'N/A';
  let eventDate = 'N/A';
  let eventTime = 'N/A';
  let eventVenue = 'N/A';

  if (isHistorical) {
    eventName = request.eventName || request.eventTitle || event?.title || s1?.eventName || 'N/A';
    eventDate = formatDate(request.eventDate || event?.date || s1?.eventStartDate || 'N/A');
    if (request.eventDate && request.eventDate.includes('-') && request.eventDate.length > 10) {
       eventDate = request.eventDate;
    } else if (!request.eventDate && s1?.eventStartDate && s1?.eventEndDate && s1.eventStartDate !== s1.eventEndDate) {
       eventDate = `${formatDate(s1.eventStartDate)} - ${formatDate(s1.eventEndDate)}`;
    }
    eventTime = request.eventTime || event?.time || s1?.eventStartTime || 'N/A';
    eventVenue = request.venue || request.eventVenue || event?.venue;
    eventVenue = (!eventVenue || eventVenue === 'N/A' || eventVenue === 'null' || eventVenue === 'undefined') ? 'Venue not alloted' : eventVenue;
  } else {
    eventName = event?.title || s1?.eventName || request.eventName || request.eventTitle || 'N/A';
    eventDate = formatDate(event?.date || s1?.eventStartDate || request.eventDate || 'N/A');
    if (s1?.eventStartDate && s1?.eventEndDate && s1.eventStartDate !== s1.eventEndDate) {
      eventDate = `${formatDate(s1.eventStartDate)} - ${formatDate(s1.eventEndDate)}`;
    }
    eventTime = event?.time || s1?.eventStartTime || request.eventTime || 'N/A';
    if (s1?.eventStartTime && s1?.eventEndTime) {
      eventTime = `${s1.eventStartTime} - ${s1.eventEndTime}`;
    }
    eventVenue = event?.venue || request.venue || request.eventVenue;
    eventVenue = (!eventVenue || eventVenue === 'N/A' || eventVenue === 'null' || eventVenue === 'undefined') ? 'Venue not alloted' : eventVenue;
  }

  const isStudentView = String(currentUser?.id) === String(request.userId || request.studentId);

  const canApprove = () => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.FACULTY && request.status === ODRequestStatus.PENDING_FACULTY) return true;
    if (currentUser.role === UserRole.HOD && request.status === ODRequestStatus.PENDING_HOD) return true;
    if (currentUser.role === UserRole.IQAC_TEAM && request.status === ODRequestStatus.PENDING_IQAC) return true;
    return false;
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      let odLetterBase64 = null;
      
      // If this is the final approval step (IQAC -> Approved)
      if (request.status === ODRequestStatus.PENDING_IQAC) {
        console.log('Generating OD Letter PDF for attachment...');
        odLetterBase64 = await generateODLetterBase64(request, event);
      }

      await handleODApproval(request.id, true, { name: currentUser.name }, odLetterBase64);
      onClose();
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      // It's checked before this function, but just in case
      return;
    }
    
    setApproving(true);
    try {
      await handleODApproval(request.id, false, { name: currentUser.name }, null, rejectionReason.trim());
      setShowRejectInput(false);
      setRejectionReason('');
      onClose();
    } catch (error) {
      console.error('Rejection failed:', error);
    } finally {
      setApproving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case ODRequestStatus.APPROVED:
        return 'text-emerald-600 bg-emerald-50';
      case ODRequestStatus.REJECTED:
        return 'text-red-600 bg-red-50';
      default:
        return 'text-amber-600 bg-amber-50';
    }
  };

  const getApprovalProgress = () => {
    const isRejected = request.status === ODRequestStatus.REJECTED;
    const stepsData = [
      { 
        baseLabel: 'Faculty', 
        key: 'faculty', 
        name: request.facultyApprovedBy,
        approvedAt: request.facultyApprovedAt,
        rejectedAt: request.facultyRejectedAt,
        remarks: request.facultyRejectedAt ? request.remarks : null
      },
      { 
        baseLabel: 'HOD', 
        key: 'hod', 
        name: request.hodApprovedBy,
        approvedAt: request.hodApprovedAt,
        rejectedAt: request.hodRejectedAt,
        remarks: request.hodRejectedAt ? request.remarks : null
      },
      { 
        baseLabel: 'IQAC', 
        key: 'iqac', 
        name: request.iqacApprovedBy || request.principalApprovedBy, // fallback for legacy
        approvedAt: request.iqacApprovedAt || (request.status === ODRequestStatus.APPROVED ? request.approvedAt : null),
        rejectedAt: request.iqacRejectedAt || (request.status === ODRequestStatus.REJECTED && request.hodApprovedBy ? request.rejectedAt : null),
        remarks: (request.iqacRejectedAt || (request.status === ODRequestStatus.REJECTED && request.hodApprovedBy)) ? request.remarks : null
      }
    ];

    let rejectedIndex = -1;
    if (isRejected) {
       if (request.facultyRejectedAt) rejectedIndex = 0;
       else if (request.hodRejectedAt) rejectedIndex = 1;
       else if (request.iqacRejectedAt) rejectedIndex = 2;
       else rejectedIndex = stepsData.findIndex(s => !s.name);
    }

    return stepsData.map((step, index) => {
       let state = 'Waiting';
       let done = false;
       let pending = false;
       let rejected = false;

       if (request.status === ODRequestStatus.APPROVED) {
           state = 'Approved';
           done = true;
       } else if (isRejected) {
           if (index < rejectedIndex) {
               state = 'Approved';
               done = true;
           } else if (index === rejectedIndex) {
               state = 'Rejected';
               rejected = true;
           }
       } else {
           let currentPendingIndex = 0;
           if (request.status === ODRequestStatus.PENDING_FACULTY) currentPendingIndex = 0;
           else if (request.status === ODRequestStatus.PENDING_HOD) currentPendingIndex = 1;
           else if (request.status === ODRequestStatus.PENDING_IQAC) currentPendingIndex = 2;

           if (index < currentPendingIndex) {
               state = 'Approved';
               done = true;
           } else if (index === currentPendingIndex) {
               state = 'Pending';
               pending = true;
           }
       }
       
       let dateStr = '';
       let timeStr = '';
       let timestamp = done ? step.approvedAt : (rejected ? (step.rejectedAt || request.rejectedAt) : null);
       
       if (timestamp) {
           const d = new Date(timestamp);
           const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
           const day = String(d.getDate()).padStart(2, '0');
           const month = months[d.getMonth()];
           const year = d.getFullYear();
           dateStr = `${day}-${month}-${year}`;
           
           let hours = d.getHours();
           const minutes = String(d.getMinutes()).padStart(2, '0');
           const ampm = hours >= 12 ? 'PM' : 'AM';
           hours = hours % 12;
           hours = hours ? hours : 12;
           timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
       }

       return {
           key: step.key,
           label: `${step.baseLabel} (${state})`,
           baseLabel: step.baseLabel,
           done,
           pending,
           rejected,
           approvedBy: step.name,
           dateStr,
           timeStr,
           remarks: rejected ? request.remarks : null
       };
    });
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
          className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">OD Request Details</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(request.status)}`}>
                {request.status.replace(/_/g, ' ')}
              </span>
              <span className="text-sm text-slate-500">
                Requested: {new Date(request.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Student Info */}
            <div className="glass-panel p-4 rounded-xl">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <User size={18} /> Student Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Name</p>
                  <p className="font-medium">{formatStudentNameWithRoll(request.studentName, request.rollNo, request.studentId)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Roll Number</p>
                  <p className="font-medium">{formatRollNo(request.rollNo, request.studentId)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Class / Department</p>
                  <p className="font-medium">{fallbackValue(request.class, 'general')} / {fallbackValue(request.department, 'department')}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium">{fallbackValue(request.email, 'email')}</p>
                </div>
              </div>
            </div>

            {/* Event Info */}
            <div className="glass-panel p-4 rounded-xl">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Calendar size={18} /> Event Details
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-500">Event Name</p>
                  <p className="font-medium text-lg">{eventName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-500 flex items-center gap-1">
                      <Calendar size={14} /> Date
                    </p>
                    <p className="font-medium">{eventDate}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 flex items-center gap-1">
                      <Clock size={14} /> Time
                    </p>
                    <p className="font-medium">{eventTime}</p>
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 flex items-center gap-1">
                    <MapPin size={14} /> Venue
                  </p>
                  <p className="font-medium">{eventVenue}</p>
                </div>
              </div>
            </div>

            {/* Attendance Status - ONLY IF RECORDED OR ACTIVE */}
            {(() => {
                const mode = getAttendanceMode(event);
                const liveRequest = odRequests?.find(r => r.id === request.id) || request;
                const attendance = liveRequest.attendance || {};
                const isHistorical = event?.status === 'COMPLETED' || event?.status === 'CANCELLED';
                
                // Do not retrofit completed events if they don't have attendance
                if (isHistorical && Object.keys(attendance).length === 0) return null;

                const isEventStarted = () => {
                  const evtDate = event?.date || event?.requisition?.step1?.eventStartDate;
                  const startTime = event?.startTime || event?.requisition?.step1?.eventStartTime;
                  if (!evtDate || !startTime) return false;
              
                  const [hours, minutes] = String(startTime).split(':').map(Number);
                  const eventStartObj = new Date(evtDate);
                  eventStartObj.setHours(hours, minutes, 0, 0);
              
                  return Date.now() >= eventStartObj.getTime();
                };

                const generateDateRange = (startDateStr, endDateStr) => {
                  if (!startDateStr) return [];
                  if (!endDateStr || startDateStr === endDateStr) return [startDateStr];
                  const dates = [];
                  let curr = new Date(startDateStr);
                  const end = new Date(endDateStr);
                  while (curr <= end) {
                    dates.push(curr.toISOString().split('T')[0]);
                    curr.setDate(curr.getDate() + 1);
                  }
                  return dates;
                };

                const getOverallBadge = (status) => {
                    let colors = 'bg-slate-50 text-slate-700 border-slate-200';
                    if (status === 'P') colors = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    else if (status === 'A') colors = 'bg-red-50 text-red-700 border-red-200';
                    else if (status === 'FN' || status === 'AN') colors = 'bg-amber-50 text-amber-700 border-amber-200';
                    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${colors}`}>{status}</span>;
                };

                const getSessionBadge = (isPresent) => isPresent ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 size={12}/> Present</span>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-700 border border-red-200"><XCircle size={12}/> Absent</span>
                );

                const renderAttendanceStatus = () => {
                    if (isHistorical && event?.status === 'CANCELLED') {
                        return <p className="text-sm text-slate-500 font-bold">Not Applicable</p>;
                    }

                    const startDate = event?.date || event?.requisition?.step1?.eventStartDate;
                    const endDate = event?.requisition?.step1?.eventEndDate || startDate;
                    const allDates = generateDateRange(startDate, endDate);

                    return (
                        <div className="space-y-3 mt-2">
                            {allDates.map(date => {
                                const data = attendance[date];
                                const config = (event?.attendanceConfigs || {})[date];
                                const isStarted = config && config.session1Status !== 'NotStarted';
                                const isFinalized = config && config.attendanceFinalized;
                                const inProgress = config && (config.session1Status === 'Running' || config.session2Status === 'Running');

                                const cType = config?.attendanceType || 'Single Session';
                                
                                const s1 = data?.S1 || data?.FN || false;
                                const s2 = data?.S2 || data?.AN || false;

                                let overallStatus = 'A';
                                if (cType === 'Single Session') {
                                    overallStatus = s1 ? 'P' : 'A';
                                } else {
                                    if (s1 && s2) overallStatus = 'P';
                                    else if (s1) overallStatus = 'FN';
                                    else if (s2) overallStatus = 'AN';
                                    else overallStatus = 'A';
                                }

                                const formatEventDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

                                if (!isStarted && !isHistorical) {
                                    return (
                                        <div key={date} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-500 uppercase">Attendance Not Started</span>
                                            </div>
                                            <div className="p-4 grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Attendance Date</span>
                                                    <span className="text-sm font-bold text-slate-800">{formatEventDate(date)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</span>
                                                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600">Pending</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                let headerText = 'Completed Attendance';
                                if (!isFinalized) {
                                    if (inProgress) headerText = 'Attendance In Progress';
                                    else if (isHistorical) headerText = 'Final Attendance';
                                    else headerText = 'Attendance Tracking';
                                }

                                return (
                                    <div key={date} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500 uppercase">{headerText}</span>
                                            {isFinalized && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Read-Only</span>}
                                        </div>
                                        <div className="p-4 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Attendance Date</span>
                                                    <span className="text-sm font-bold text-slate-800">{formatEventDate(date)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Attendance Type</span>
                                                    <span className="text-sm font-bold text-slate-800">{cType}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="pt-3 border-t border-slate-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-semibold text-slate-700">Session 1</span>
                                                    {getSessionBadge(s1)}
                                                </div>
                                                {cType === 'Both Sessions' && (
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-semibold text-slate-700">Session 2</span>
                                                        {getSessionBadge(s2)}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                                    <span className="text-sm font-bold text-slate-800">Overall Status</span>
                                                    {getOverallBadge(overallStatus)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                };

                return (
                    <div className="glass-panel p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
                        <h3 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                            <CheckCircle2 size={18} className="text-emerald-600" /> Attendance Information
                        </h3>
                        {renderAttendanceStatus()}
                    </div>
                );
            })()}

            {/* Admin Workflows - Hidden from students */}
            {!isStudentView && (
              <>
                {/* Reason */}
                <div className="glass-panel p-4 rounded-xl">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <FileText size={18} /> Reason for OD
                  </h3>
                  <p className="text-slate-600">{request.reason || 'No reason provided'}</p>
                </div>

                {/* Approval Progress */}
                <div className="glass-panel p-4 rounded-xl">
                  <h3 className="font-semibold text-slate-900 mb-4 text-center">Approval Timeline</h3>
                  <div className="flex flex-col items-center">
                    {getApprovalProgress().map((step, index) => (
                      <div key={step.key} className="flex flex-col items-center w-full max-w-[240px]">
                        <div className="w-full flex flex-col items-center text-center">
                          <div className="font-bold text-slate-800 text-sm mb-1.5">{step.baseLabel}</div>
                          
                          {step.done ? (
                            <div className="flex flex-col items-center">
                               <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs mb-2">
                                 <CheckCircle2 size={14} /> Approved
                               </div>
                               {step.approvedBy && (
                                 <>
                                   <div className="text-[10px] text-slate-500 font-semibold mb-0.5">Approved By:</div>
                                   <div className="text-xs text-slate-700 font-bold mb-2 text-center break-words max-w-[200px]">{step.approvedBy}</div>
                                 </>
                               )}
                               {step.dateStr && (
                                 <>
                                   <div className="text-[10px] text-slate-500 font-semibold mb-0.5">Approved On:</div>
                                   <div className="text-xs text-slate-700 font-medium">{step.dateStr}</div>
                                   <div className="text-xs text-slate-700 font-medium">{step.timeStr}</div>
                                 </>
                               )}
                            </div>
                          ) : step.rejected ? (
                            <div className="flex flex-col items-center">
                               <div className="flex items-center gap-1.5 text-red-600 font-bold text-xs mb-2">
                                 <XCircle size={14} /> Rejected
                               </div>
                               {step.approvedBy && (
                                 <>
                                   <div className="text-[10px] text-slate-500 font-semibold mb-0.5">Rejected By:</div>
                                   <div className="text-xs text-slate-700 font-bold mb-2 text-center break-words max-w-[200px]">{step.approvedBy}</div>
                                 </>
                               )}
                               {step.dateStr && (
                                 <>
                                   <div className="text-[10px] text-slate-500 font-semibold mb-0.5">Rejected On:</div>
                                   <div className="text-xs text-slate-700 font-medium">{step.dateStr}</div>
                                   <div className="text-xs text-slate-700 font-medium">{step.timeStr}</div>
                                 </>
                               )}
                               {step.remarks && (
                                 <div className="mt-2 text-xs text-center">
                                   <span className="text-slate-500 font-semibold block mb-0.5">Reason:</span>
                                   <span className="text-slate-700 font-medium block max-w-[200px] whitespace-normal break-words">{step.remarks}</span>
                                 </div>
                               )}
                            </div>
                          ) : step.pending ? (
                            <div className="flex flex-col items-center">
                               <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs mb-2">
                                 <Clock size={14} className="animate-pulse" /> Pending
                               </div>
                               <div className="text-[10px] text-slate-500 font-semibold">Waiting for approval</div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center opacity-40">
                               <div className="flex items-center gap-1.5 text-slate-400 font-bold text-xs">
                                 <Clock size={14} /> Waiting
                               </div>
                            </div>
                          )}
                        </div>

                        {index < 2 && (
                          <div className="flex justify-center my-3">
                            <ArrowDown size={16} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                {canApprove() && (
                  <div className="pt-4">
                    {showRejectInput ? (
                      <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex flex-col gap-3">
                        <label className="text-sm font-bold text-red-800">Rejection Reason</label>
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                          placeholder="Why is this request being rejected?"
                          rows="2"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            disabled={approving}
                            onClick={() => { setShowRejectInput(false); setRejectionReason(''); }}
                            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            disabled={approving || !rejectionReason.trim()}
                            onClick={handleReject}
                            className="px-4 py-2 text-sm font-bold bg-red-600 text-white hover:bg-red-700 rounded-lg transition-all flex items-center gap-2 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:border-transparent"
                          >
                            {approving ? 'Processing...' : 'Confirm Rejection'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <button
                          disabled={approving}
                          onClick={() => setShowRejectInput(true)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all font-semibold disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:border-transparent"
                        >
                          <XCircle size={20} /> {approving ? 'Processing...' : 'Reject'}
                        </button>
                        <button
                          disabled={approving}
                          onClick={handleApprove}
                          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all font-semibold disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed disabled:border-transparent"
                        >
                          <CheckCircle2 size={20} /> {approving ? 'Processing...' : 'Approve'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {request.status === ODRequestStatus.APPROVED && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={32} />
                    <p className="font-semibold text-emerald-700">OD Request Approved</p>
                    <p className="text-sm text-emerald-600 mt-1">This OD request has successfully completed the institutional approval workflow.</p>
                    <p className="text-xs text-emerald-600/80 mt-2 font-medium">Approval Chain:<br/>Faculty → HOD → IQAC</p>
                  </div>
                )}

                {request.status === ODRequestStatus.REJECTED && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <XCircle className="mx-auto text-red-500 mb-2" size={32} />
                    <p className="font-semibold text-red-700">OD Request Rejected</p>
                    <p className="text-sm text-red-600">This request has been rejected.</p>
                  </div>
                )}

                {/* Participation Feedback Link - Post event only */}
                {(() => {
                    if (request.status !== ODRequestStatus.APPROVED || request.feedback || !event) return null;
                    const endDate = s1?.eventEndDate || event.date;
                    const endTime = s1?.eventEndTime || '23:59';
                    if (!endDate) return null;
                    const end = new Date(`${endDate}T${endTime}`).getTime();
                    const now = Date.now();
                    if (now < end) return null;
                    if (now > end + (7 * 24 * 60 * 60 * 1000)) return null;

                    return (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center flex flex-col items-center gap-2 mt-4">
                        <MessageSquare size={24} className="text-purple-600 mb-1" />
                        <p className="font-bold text-slate-800">Event Feedback Released</p>
                        <p className="text-[11px] text-slate-500 mb-2">Thank you for participating! Please provide your feedback below.</p>
                        
                        {event.studentFeedbackLink ? (
                          <a
                            href={event.studentFeedbackLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-bold shadow-lg transition-all active:scale-95"
                          >
                             Open Google Form Feedback
                          </a>
                        ) : (
                          <p className="text-[10px] text-purple-600 italic">Please go to Explore Events to submit feedback.</p>
                        )}
                      </div>
                    );
                })()}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ODRequestDetailModal;
