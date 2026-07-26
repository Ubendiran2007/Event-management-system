import React, { useState } from 'react';
import DataTable from './DataTable';
import { usePaginatedApi } from '../hooks/usePaginatedApi';
import StatusBadge from './StatusBadge';
import { User, Calendar, Check, X, Loader2 } from 'lucide-react';

export default function RegistrationsTable({ currentUser, onRowClick }) {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter for requests assigned to this organizer that are pending (or we could show all and let them filter)
  const filters = {
    organizerId: currentUser?.id,
    // If you want to show only pending, add: status: 'PENDING_ORGANIZER'
  };

  const { data, loading, pagination, actions } = usePaginatedApi('/api/od-requests', filters, { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
  const [processingId, setProcessingId] = useState(null);

  // We could implement handleApprove/Reject here, calling the same API endpoint.
  const handleAction = async (e, req, actionStatus) => {
    e.stopPropagation();
    setProcessingId(req.id);
    try {
      const token = localStorage.getItem('sessionToken') || localStorage.getItem('token') || '';
      const baseUrl = import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com';
      
      const res = await fetch(`${baseUrl}/api/od-requests/${req.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: actionStatus, approvedBy: currentUser.name })
      });
      
      if (res.ok) {
        actions.reload();
      }
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // Local search filter
  const displayData = data.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (d.studentName || '').toLowerCase().includes(q) ||
           (d.eventTitle || '').toLowerCase().includes(q) ||
           (d.rollNo || '').toLowerCase().includes(q);
  });

  const columns = [
    {
      key: 'student',
      label: 'STUDENT DETAILS',
      render: (req) => {
        const initials = req.studentName ? req.studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ST';
        return (
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onRowClick && onRowClick(req)}>
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold text-xs shadow-sm shrink-0 border border-white">
              {initials}
            </div>
            <div className="flex flex-col justify-center min-h-[32px]">
              <p className="font-bold text-xs text-slate-800 leading-tight">
                {req.studentName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{req.rollNo || req.studentId}</span>
                <span className="text-[10px] font-medium text-slate-500">{req.class}</span>
              </div>
            </div>
          </div>
        );
      }
    },
    {
      key: 'event',
      label: 'EVENT',
      render: (req) => (
        <div className="flex items-center gap-2">
           <Calendar size={14} className="text-slate-400" />
           <div className="min-w-0">
             <p className="text-xs font-bold text-slate-700 truncate">{req.eventTitle}</p>
             <p className="text-[10px] text-slate-500">{req.eventDate}</p>
           </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (req) => (
         <div className="scale-[0.8] origin-left">
           <StatusBadge status={req.status} />
         </div>
      )
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: (req) => {
        if (req.status !== 'PENDING_ORGANIZER') {
          return null; // Don't show actions if not pending organizer
        }
        
        return (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(e) => handleAction(e, req, 'REJECTED')}
              disabled={processingId === req.id}
              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100 disabled:opacity-50"
              title="Reject"
            >
              <X size={16} />
            </button>
            <button
              onClick={(e) => handleAction(e, req, 'APPROVED')}
              disabled={processingId === req.id}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {processingId === req.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Approve
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="flex-1 w-full min-h-0 h-full flex flex-col">
      <DataTable
        columns={columns}
        data={displayData}
        loading={loading}
        pagination={pagination}
        onNextPage={actions.nextPage}
        onPrevPage={actions.prevPage}
        hasPrevPage={pagination.hasPrevPage}
        onSearch={setSearchQuery}
        searchPlaceholder="Search student or event..."
      />
    </div>
  );
}
