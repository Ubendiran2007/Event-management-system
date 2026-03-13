import { X, User, Calendar, Clock, MapPin, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { ODRequestStatus, UserRole } from '../types';
import StatusBadge from './StatusBadge';

const ODRequestDetailModal = ({ request, onClose }) => {
  const { currentUser, handleODApproval } = useAppContext();

  if (!request) return null;

  const canApprove = () => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.FACULTY && request.status === ODRequestStatus.PENDING_FACULTY) return true;
    if (currentUser.role === UserRole.HOD && request.status === ODRequestStatus.PENDING_HOD) return true;
    if (currentUser.role === UserRole.PRINCIPAL && request.status === ODRequestStatus.PENDING_PRINCIPAL) return true;
    return false;
  };

  const handleApprove = async () => {
    await handleODApproval(request.id, true, { name: currentUser.name });
    onClose();
  };

  const handleReject = async () => {
    await handleODApproval(request.id, false, { name: currentUser.name });
    onClose();
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
    const steps = [
      { label: 'Faculty', key: 'faculty', done: request.facultyApprovedBy },
      { label: 'HOD', key: 'hod', done: request.hodApprovedBy },
      { label: 'Principal', key: 'principal', done: request.principalApprovedBy },
    ];

    return steps;
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
                  <p className="font-medium">{request.studentName}</p>
                </div>
                <div>
                  <p className="text-slate-500">Roll Number</p>
                  <p className="font-medium">{request.rollNo}</p>
                </div>
                <div>
                  <p className="text-slate-500">Class</p>
                  <p className="font-medium">{request.class || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium">{request.email}</p>
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
                  <p className="font-medium text-lg">{request.eventName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-500 flex items-center gap-1">
                      <Calendar size={14} /> Date
                    </p>
                    <p className="font-medium">{request.eventDate}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 flex items-center gap-1">
                      <Clock size={14} /> Time
                    </p>
                    <p className="font-medium">{request.eventTime || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 flex items-center gap-1">
                    <MapPin size={14} /> Venue
                  </p>
                  <p className="font-medium">{request.venue || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Reason */}
            <div className="glass-panel p-4 rounded-xl">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileText size={18} /> Reason for OD
              </h3>
              <p className="text-slate-600">{request.reason || 'No reason provided'}</p>
            </div>

            {/* Approval Progress */}
            <div className="glass-panel p-4 rounded-xl">
              <h3 className="font-semibold text-slate-900 mb-4">Approval Progress</h3>
              <div className="flex items-center justify-between">
                {getApprovalProgress().map((step, index) => (
                  <div key={step.key} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        step.done 
                          ? 'bg-emerald-500 text-white' 
                          : request.status === `PENDING_${step.key.toUpperCase()}`
                            ? 'bg-amber-500 text-white animate-pulse'
                            : 'bg-slate-200 text-slate-400'
                      }`}>
                        {step.done ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                      </div>
                      <p className="text-xs mt-2 font-medium">{step.label}</p>
                      {step.done && (
                        <p className="text-xs text-slate-500">{step.done}</p>
                      )}
                    </div>
                    {index < 2 && (
                      <div className={`w-16 h-1 mx-2 ${
                        step.done ? 'bg-emerald-500' : 'bg-slate-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            {canApprove() && (
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleReject}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 transition-all font-semibold"
                >
                  <XCircle size={20} /> Reject
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-semibold"
                >
                  <CheckCircle size={20} /> Approve
                </button>
              </div>
            )}

            {request.status === ODRequestStatus.APPROVED && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <CheckCircle className="mx-auto text-emerald-500 mb-2" size={32} />
                <p className="font-semibold text-emerald-700">OD Request Approved</p>
                <p className="text-sm text-emerald-600">This request has been approved by all authorities.</p>
              </div>
            )}

            {request.status === ODRequestStatus.REJECTED && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <XCircle className="mx-auto text-red-500 mb-2" size={32} />
                <p className="font-semibold text-red-700">OD Request Rejected</p>
                <p className="text-sm text-red-600">This request has been rejected.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ODRequestDetailModal;
