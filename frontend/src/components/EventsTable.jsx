import React, { useMemo, useState, useRef } from 'react';
import DataTable from './DataTable';
import { usePaginatedApi } from '../hooks/usePaginatedApi';
import { useWindowPageSize } from '../hooks/useWindowPageSize';
import { UserRole, EventStatus } from '../types';
import StatusBadge from './StatusBadge';
import { Calendar, MapPin, Search } from 'lucide-react';
import { formatEventRef, getEventStatus } from '../utils/formatters';

export default function EventsTable({ currentUser, activeTab, filter, onRowClick }) {
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const pageSize = useWindowPageSize(containerRef, { hasToolbar: true });

  // Map the UI filter to actual API status query
  const queryParams = useMemo(() => {
    const params = {
        search: searchQuery || undefined
    };
    
    if (activeTab === 'available') {
      params.status = 'APPROVED';
      // Future events filter logic could be added here
    } else if (activeTab === 'my-registrations') {
       // Ideally this would fetch from /api/od-requests for the current student
       // For now, this is a placeholder to show how it would be structured
       params.studentId = currentUser?.id;
    } else if (activeTab === 'events') {
      if (currentUser?.role === UserRole.FACULTY || currentUser?.role === UserRole.STUDENT_ORGANIZER) {
         params.organizerId = currentUser?.id;
      }

      if (filter === 'process') {
        params.status = 'PENDING_MANAGERS,PENDING_FACULTY,PENDING_CLASS_ADVISOR,PENDING_HOD,PENDING_IQAC,PENDING_HR,PENDING_AUDIO,PENDING_TRANSPORT';
      } else if (filter === 'approved') {
        params.status = 'APPROVED';
      } else if (filter === 'posted') {
        params.status = 'POSTED';
      } else if (filter === 'completed') {
        params.status = 'COMPLETED';
      } else if (filter === 'rejected') {
        params.status = 'REJECTED';
      }
    }

    return params;
  }, [currentUser, activeTab, filter, searchQuery]);

  // Use the appropriate endpoint
  const endpoint = activeTab === 'my-registrations' ? '/api/od-requests' : '/api/events';
  const { data, loading, pagination, actions } = usePaginatedApi(endpoint, queryParams, { limit: pageSize, sortBy: 'createdAt', sortOrder: 'desc' });

  // For my-registrations, the data shape is ODRequests, else Events
  const columns = activeTab === 'my-registrations' ? [
    {
        key: 'event',
        label: 'EVENT DETAILS',
        render: (req) => (
            <div className="flex items-center gap-3" onClick={() => onRowClick && onRowClick(req)}>
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                    <Calendar size={18} />
                </div>
                <div>
                    <p className="font-bold text-slate-900 text-sm">{req.eventTitle || 'Unknown Event'}</p>
                    <p className="text-xs text-slate-500">{req.eventDate || 'No date'}</p>
                </div>
            </div>
        )
    },
    {
        key: 'status',
        label: 'REGISTRATION STATUS',
        render: (req) => <StatusBadge status={req.status} />
    }
  ] : [
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
               <p className="font-extrabold text-sm sm:text-base text-slate-900 truncate cursor-pointer hover:text-blue-600 transition-colors">
                 {event.title || 'Untitled Event'}
               </p>
               {event.referenceId && (
                 <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200">
                   {formatEventRef(event.referenceId)}
                 </span>
               )}
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
        <p className="text-xs sm:text-sm text-slate-600 font-medium truncate max-w-[120px] sm:max-w-none flex items-center gap-1.5">
          <MapPin size={14} className="text-slate-400" />
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
            {event.date || event.startDate || '-'}
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
        containerRef={containerRef}
        columns={columns}
        data={data}
        loading={loading}
        pagination={pagination}
        onNextPage={actions.nextPage}
        onPrevPage={actions.prevPage}
        hasPrevPage={pagination.hasPrevPage}
        onSearch={setSearchQuery}
        searchPlaceholder={activeTab === 'my-registrations' ? "Search requests..." : "Search events..."}
      />
    </div>
  );
}
