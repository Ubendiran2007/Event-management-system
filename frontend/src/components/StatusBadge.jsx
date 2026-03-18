import { EventStatus } from '../types';

const StatusBadge = ({ status }) => {
  const styles = {
    [EventStatus.PENDING_FACULTY]: "bg-amber-100 text-amber-700 border-amber-200",
    [EventStatus.PENDING_HOD]: "bg-blue-100 text-blue-700 border-blue-200",
    [EventStatus.PENDING_DEPARTMENTS]: "bg-orange-100 text-orange-700 border-orange-200",
    [EventStatus.PENDING_IQAC]: "bg-purple-100 text-purple-700 border-purple-200",
    [EventStatus.APPROVED]: "bg-emerald-100 text-emerald-700 border-emerald-200",
    [EventStatus.POSTED]: "bg-emerald-100 text-emerald-700 border-emerald-200",
    [EventStatus.REJECTED]: "bg-red-100 text-red-700 border-red-200",
    [EventStatus.COMPLETED]: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const labels = {
    [EventStatus.PENDING_FACULTY]: 'Pending Faculty',
    [EventStatus.PENDING_HOD]: 'Pending HOD',
    [EventStatus.PENDING_DEPARTMENTS]: 'Dept. Approvals',
    [EventStatus.PENDING_IQAC]: 'Pending IQAC',
    [EventStatus.APPROVED]: 'Approved',
    [EventStatus.POSTED]: 'Posted',
    [EventStatus.REJECTED]: 'Rejected',
    [EventStatus.COMPLETED]: 'Completed',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {labels[status] || status?.replace('PENDING_', '').replace(/_/g, ' ')}
    </span>
  );
};

export default StatusBadge;
