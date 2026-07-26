import React, { useMemo } from 'react';
import DataTable from './DataTable';
import { usePaginatedApi } from '../hooks/usePaginatedApi';
import { UserRole, EventStatus } from '../types';
import StatusBadge from './StatusBadge';
import { Calendar } from 'lucide-react';
import { formatEventRef } from '../utils/formatters';

export default function ApprovalsTable({ currentUser, filter, onRowClick }) {
  // Map the UI filter to actual API status query
  const queryParams = useMemo(() => {
    const params = {};
    const role = currentUser?.role;
    
    let pendingStatuses = [];
    if (role === UserRole.FACULTY) pendingStatuses = [EventStatus.PENDING_FACULTY];
    else if (role === UserRole.HOD) pendingStatuses = [EventStatus.PENDING_HOD];
    else if (role === UserRole.IQAC_TEAM) pendingStatuses = [EventStatus.PENDING_IQAC];
    else pendingStatuses = [EventStatus.PENDING_FACULTY, EventStatus.PENDING_CLASS_ADVISOR, EventStatus.PENDING_HOD, EventStatus.PENDING_IQAC, 'PENDING_HR', 'PENDING_AUDIO', 'PENDING_TRANSPORT']; // For other roles

    const pastApprovedStatuses = ['APPROVED', 'POSTED', 'COMPLETED'];
    const modifiedStatuses = ['CANCELLED', 'POSTPONED'];

    if (filter === 'pending') {
      params.status = pendingStatuses.join(',');
    } else if (filter === 'approved') {
      params.status = pastApprovedStatuses.join(',');
    } else if (filter === 'modified') {
      params.status = modifiedStatuses.join(',');
    } else {
      // 'all'
      params.status = [...pendingStatuses, ...pastApprovedStatuses, ...modifiedStatuses].join(',');
    }

    return params;
  }, [currentUser, filter]);

  const { data, loading, pagination, actions } = usePaginatedApi('/api/events', queryParams, { limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });

  const columns = [
    {
      key: 'eventDetails',
      label: 'EVENT DETAILS',
      render: (event) => (
        <div className="flex items-center gap-2 sm:gap-4" onClick={() => onRowClick(event)}>
          <div className="w-8 h-8 sm:w-11 sm:h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
             <Calendar size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2 flex-wrap">
               <p className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                 {event.title || 'Untitled Event'}
               </p>
               {event.referenceId && (
                 <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200">
                   {formatEventRef(event.referenceId)}
                 </span>
               )}
               {event.isPostponed && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">POSTPONED</span>}
             </div>
             <div className="flex items-center gap-2 mt-0.5">
               <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-extrabold tracking-wider bg-slate-100 text-slate-600 uppercase border border-slate-200">
                 {event.audienceScope === 'Internal' ? event.department : (event.audienceScope || 'Internal')}
               </span>
               <span className="text-xs sm:text-sm text-slate-500 truncate">
                 {event.organizerName || event.organizerEmail}
               </span>
             </div>
          </div>
        </div>
      )
    },
    {
      key: 'venue',
      label: 'VENUE',
      render: (event) => (
        <p className="text-xs sm:text-sm text-slate-600 font-medium truncate max-w-[120px] sm:max-w-none">
          {event.venue || 'To be allocated'}
        </p>
      )
    },
    {
      key: 'dateTime',
      label: 'DATE & TIME',
      render: (event) => (
        <div>
          <p className="text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap">
            {event.date || event.startDate || '-'} {event.endDate && event.endDate !== event.date && event.endDate !== event.startDate ? ` - ${event.endDate}` : ''}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
            {event.startTime ? `${event.startTime} - ${event.endTime}` : 'Time not set'}
          </p>
        </div>
      )
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (event) => <StatusBadge status={event.status} />
    },
    {
      key: 'actions',
      label: 'ACTIONS',
      render: (event) => (
        <div className="flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRowClick(event);
            }}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold shadow-sm shadow-blue-200 transition-all active:scale-95"
          >
            View
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex-1 w-full min-h-0 h-full flex flex-col">
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        pagination={pagination}
        onNextPage={actions.nextPage}
        onPrevPage={actions.prevPage}
        hasPrevPage={pagination.hasPrevPage}
      />
    </div>
  );
}
