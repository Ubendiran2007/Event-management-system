import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Building2, Plus, Edit2, AlertCircle, Calendar, Wrench, Trash2, CheckCircle2, XCircle, Search, Filter, SlidersHorizontal, Clock, MapPin, Users, ShieldAlert, ChevronLeft, ChevronRight, RefreshCw, ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getAuthToken } from '../utils/api';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useWindowPageSize } from '../hooks/useWindowPageSize';
import { UserRole } from '../types';

const VENUE_TYPES = ['Auditorium', 'Seminar Hall', 'Conference Hall', 'Smart Classroom', 'Lab', 'Board Room', 'Studio', 'Other'];
const venuePageCache = new Map();
const BUILDINGS = ['Block A', 'Block B', 'Block C', 'IT Centre', 'Main Building', 'Admin Block', 'Other'];
const COMMON_FACILITIES = ['Projector', 'AC', 'Smart Board', 'Sound System', 'Microphone', 'Wi-Fi', 'Recording Equipment', 'Podium', 'LED Display'];

const CustomFilterSelect = ({ value, onChange, options, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || 'Select';

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left flex items-center justify-between ${className}`}
      >
        <span className="truncate pr-4">{selectedLabel}</span>
        <ChevronDown size={14} className={`shrink-0 pointer-events-none transition-transform ${isOpen ? 'rotate-180 text-blue-500' : 'text-slate-400'}`} />
      </button>
      
      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto top-full mt-2 min-w-full bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 flex flex-col max-h-64 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors cursor-pointer ${value === String(opt.value) ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const VenueManagement = () => {
  const { currentUser } = useAppContext();
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com';
  const getToken = () => getAuthToken();

  const [activeTab, setActiveTab] = useState('venues'); // 'venues' or 'calendar'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedVenueForMaint, setSelectedVenueForMaint] = useState(null);
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [maintLoading, setMaintLoading] = useState(false);

  const [allVenues, setAllVenues] = useState([]);
  
  useEffect(() => {
    if (activeTab !== 'calendar' || allVenues.length > 0) return;

    const fetchAll = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/venues/all?limit=1000`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const data = await res.json();
        if (data.success) setAllVenues(data.data || []);
      } catch (err) {
        console.warn('Failed to load venue options:', err);
      }
    };
    fetchAll();
  }, [activeTab, allVenues.length, backendUrl]);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    building: BUILDINGS[0],
    floor: '1',
    capacity: '100',
    type: VENUE_TYPES[0],
    facilities: ['Projector', 'AC', 'Wi-Fi'],
    status: 'ACTIVE'
  });

  const [maintData, setMaintData] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    reason: 'Sound System & Equipment Upgrade'
  });

  // Calendar state
  const [calDate, setCalDate] = useState(new Date().toISOString().split('T')[0]);
  const [calEndDate, setCalEndDate] = useState(new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]);
  const [calBuilding, setCalBuilding] = useState('');
  const [calVenueId, setCalVenueId] = useState('');
  const [calStatus, setCalStatus] = useState('ALL');
  const [calType, setCalType] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calLoading, setCalLoading] = useState(false);
  const [selectedCalEvent, setSelectedCalEvent] = useState(null);

  // Search filter for venues list
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const venuesTableRef = useRef(null);
  const venuesPageSize = useWindowPageSize(venuesTableRef, { hasToolbar: true, fallback: 5 });

  // Pagination state for venues
  const [venuesPagination, setVenuesPagination] = useState({ hasMore: false, nextCursor: null, count: 0 });
  const [venuesCursorHistory, setVenuesCursorHistory] = useState([]);
  const [venuesCursor, setVenuesCursor] = useState(null);
  const isReadOnly = false;
  const canAccess = true;

  useEffect(() => {
    if (canAccess) fetchVenues();
  }, [currentUser, statusFilter, venuesPageSize]);

  useEffect(() => {
    if ((activeTab === 'calendar' || activeTab === 'history') && canAccess) {
      fetchSystemCalendar();
    }
  }, [activeTab, calDate, calEndDate, calBuilding, calVenueId, calStatus, calType]);

  const fetchVenues = async (cursor = null, append = false, force = false) => {
    const cacheKey = `${statusFilter || 'ALL'}:${venuesPageSize}`;
    const cachedPage = venuePageCache.get(cacheKey);

    if (!force && !append && !cursor && cachedPage) {
      setVenues(cachedPage.data);
      setVenuesPagination(cachedPage.pagination);
      setVenuesCursor(cachedPage.cursor);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ limit: venuesPageSize, sortBy: 'name', sortOrder: 'asc' });
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (cursor) params.append('cursor', cursor);

      const res = await fetch(`${backendUrl}/api/venues/all?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json();
      if (data.success) {
        const pageVenues = Array.isArray(data.data) ? data.data : [];
        const venueData = append ? [...(cachedPage?.data || []), ...pageVenues] : pageVenues;
        const pagination = data.pagination || { hasMore: false, nextCursor: null, count: 0 };
        venuePageCache.set(cacheKey, { data: venueData, pagination, cursor });
        setVenues(venueData);
        setVenuesPagination(pagination);
        setVenuesCursor(cursor);
      } else {
        setError(data.message || 'Failed to fetch venues');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVenuesNextPage = () => {
    if (venuesPagination.hasMore && venuesPagination.nextCursor) {
      setVenuesCursorHistory(prev => [...prev, venuesCursor]);
      fetchVenues(venuesPagination.nextCursor, true);
    }
  };

  const handleVenuesPrevPage = () => {
    if (venuesCursorHistory.length > 0) {
      const history = [...venuesCursorHistory];
      const prevCursor = history.pop();
      setVenuesCursorHistory(history);
      fetchVenues(prevCursor);
    }
  };

  const fetchSystemCalendar = async () => {
    try {
      setCalLoading(true);
      const params = new URLSearchParams({
        startDate: calDate,
        endDate: calEndDate
      });
      if (calVenueId) params.append('venueId', calVenueId);
      if (calBuilding) params.append('building', calBuilding);
      if (calType) params.append('type', calType);
      if (calStatus && calStatus !== 'ALL') params.append('status', calStatus);

      const res = await fetch(`${backendUrl}/api/venues/calendar/system?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setCalendarEvents(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Error fetching calendar:', err);
    } finally {
      setCalLoading(false);
    }
  };

  const fetchMaintenanceForVenue = async (venueId) => {
    try {
      setMaintLoading(true);
      const res = await fetch(`${backendUrl}/api/venues/${venueId}/maintenance`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (data.success) {
        setMaintenanceList(Array.isArray(data.data) ? data.data : []);
      }
    } catch (err) {
      console.error('Error fetching maintenance:', err);
    } finally {
      setMaintLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingVenue(null);
    setFormData({
      name: '',
      building: BUILDINGS[0],
      floor: 'Ground',
      capacity: '150',
      type: VENUE_TYPES[0],
      facilities: ['Air Conditioning (AC)', 'HD Projector & Screen', 'High-Speed Wi-Fi'],
      status: 'ACTIVE'
    });
    setShowVenueModal(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEditModal = (v) => {
    setEditingVenue(v);
    setFormData({
      name: v.name || '',
      building: v.building || BUILDINGS[0],
      floor: String(v.floor || '1'),
      capacity: String(v.capacity || '100'),
      type: v.type || VENUE_TYPES[0],
      facilities: v.facilities || [],
      status: v.status || 'ACTIVE'
    });
    setActiveTab('crud');
    setShowVenueModal(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMaintenanceModal = (v) => {
    setSelectedVenueForMaint(v);
    setShowMaintenanceModal(true);
    fetchMaintenanceForVenue(v.id);
  };

  const handleFacilityToggle = (fac) => {
    setFormData(prev => {
      const exists = prev.facilities.includes(fac);
      if (exists) {
        return { ...prev, facilities: prev.facilities.filter(f => f !== fac) };
      } else {
        return { ...prev, facilities: [...prev.facilities, fac] };
      }
    });
  };

  const handleSaveVenue = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const method = editingVenue ? 'PATCH' : 'POST';
      const url = editingVenue ? `${backendUrl}/api/venues/${editingVenue.id}` : `${backendUrl}/api/venues`;
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to save venue');
      }
      setSuccessMsg(`Venue ${editingVenue ? 'updated' : 'created'} successfully!`);
      setShowVenueModal(false);
      if (!editingVenue) {
        setFormData({
          name: '',
          building: BUILDINGS[0],
          floor: 'Ground',
          capacity: '150',
          type: VENUE_TYPES[0],
          facilities: ['Air Conditioning (AC)', 'HD Projector & Screen', 'High-Speed Wi-Fi'],
          status: 'ACTIVE'
        });
      } else {
        setEditingVenue(null);
      }
      fetchVenues(null, false, true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleArchiveVenue = async (v) => {
    try {
      setError('');
      const res = await fetch(`${backendUrl}/api/venues/${v.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to archive venue');
      }
      setSuccessMsg(`Venue "${v.name}" has been disabled/archived.`);
      fetchVenues(null, false, true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleScheduleMaintenance = async (e) => {
    e.preventDefault();
    if (!selectedVenueForMaint) return;
    try {
      setError('');
      const res = await fetch(`${backendUrl}/api/venues/${selectedVenueForMaint.id}/maintenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(maintData)
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to schedule maintenance');
      }
      setSuccessMsg('Maintenance scheduled successfully!');
      fetchMaintenanceForVenue(selectedVenueForMaint.id);
      fetchVenues(null, false, true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancelMaintenance = async (maintId) => {
    if (isReadOnly || !selectedVenueForMaint) return;
    try {
      setError('');
      const res = await fetch(`${backendUrl}/api/venues/${selectedVenueForMaint.id}/maintenance/${maintId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to cancel maintenance');
      }
      setSuccessMsg('Maintenance cancelled.');
      fetchMaintenanceForVenue(selectedVenueForMaint.id);
      fetchVenues(null, false, true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredVenues = useMemo(() => {
    return venues.filter(v => {
      const matchSearch = v.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.building?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          v.type?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || v.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [venues, searchTerm, statusFilter]);

  
  const venueColumns = [
    {
      key: 'name',
      label: 'Venue Name & Type',
      render: (v) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-slate-900 text-base">{v.name}</span>
          <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-md w-max">
            {v.type || 'Hall'}
          </span>
        </div>
      )
    },
    {
      key: 'location',
      label: 'Location',
      render: (v) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <MapPin size={15} className="text-slate-400" />
            <span>{v.building}</span>
          </div>
          <div className="text-xs text-slate-400 font-medium ml-5">Floor {v.floor}</div>
        </div>
      )
    },
    {
      key: 'capacity',
      label: 'Capacity',
      render: (v) => (
        <div className="flex items-center gap-1.5 font-extrabold text-slate-800">
          <Users size={16} className="text-blue-500" />
          <span>{v.capacity} Seats</span>
        </div>
      )
    },
    {
      key: 'facilities',
      label: 'Facilities Available',
      render: (v) => {
        const facs = Array.isArray(v.facilities) ? v.facilities : (typeof v.facilities === 'string' && v.facilities.trim() ? v.facilities.split(',').map(s => s.trim()) : []);
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {facs.length > 0 ? facs.map((fac, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 rounded text-[11px] font-semibold">
                {fac}
              </span>
            )) : <span className="text-xs text-slate-400 font-medium italic">Standard setups</span>}
          </div>
        );
      }
    },
    {
      key: 'status',
      label: 'Current Status',
      render: (v) => (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold shadow-sm ${
          v.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
          v.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' :
          'bg-slate-100 text-slate-600 border border-slate-300'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            v.status === 'ACTIVE' ? 'bg-emerald-500' :
            v.status === 'MAINTENANCE' ? 'bg-amber-500' :
            'bg-slate-400'
          }`} />
          {v.status || 'ACTIVE'}
        </span>
      )
    }
  ];

  const venuesDirectoryColumns = [
    ...venueColumns,
    {
      key: 'actions',
      label: 'Actions',
      render: (v) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleOpenMaintenanceModal(v)}
            className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
            title={isReadOnly ? 'View Maintenance' : 'Schedule Maintenance'}
          >
            <Wrench size={16} />
          </button>
          {!isReadOnly && (
            <>
              <button
                onClick={() => { setEditingVenue(v); setFormData({
                  name: v.name, building: v.building, floor: v.floor || '1', capacity: v.capacity || '100',
                  type: v.type || VENUE_TYPES[0], facilities: Array.isArray(v.facilities) ? v.facilities : (v.facilities || '').split(',').map(s=>s.trim())
                }); setShowVenueModal(true); }}
                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit Venue"
              >
                <Edit2 size={16} />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  const reservationHistoryColumns = [
    {
      key: 'venue',
      label: 'Venue & Building',
      render: (ev) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800">{ev.venueName || 'Unknown Venue'}</span>
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{ev.building || 'Unknown Building'}</span>
        </div>
      )
    },
    {
      key: 'title',
      label: 'Event Title / Purpose',
      render: (ev) => (
        <div className="font-bold text-slate-700 max-w-xs truncate" title={ev.title || 'N/A'}>
          {ev.title || 'N/A'}
        </div>
      )
    },
    {
      key: 'datetime',
      label: 'Date & Time',
      render: (ev) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-slate-700 font-bold">
            <Calendar size={13} className="text-slate-400" />
            <span>{ev.date}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5 font-semibold">
            <Clock size={13} className="text-slate-400" />
            <span>{ev.time || 'All Day'}</span>
          </div>
        </div>
      )
    },
    {
      key: 'type',
      label: 'Type',
      render: (ev) => (
        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black tracking-wider uppercase border border-indigo-100">
          EVENT
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (ev) => (
        <div className="flex justify-end">
          <span className={`px-2 py-1 rounded text-[10px] font-black tracking-wider uppercase ${
            ev.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {ev.status || 'APPROVED'}
          </span>
        </div>
      )
    }
  ];

  if (!canAccess) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[70vh]">
          <div className="text-center space-y-4 max-w-md mx-auto p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto" />
            <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
            <p className="text-slate-600 text-sm">You do not have administrative permission to view or manage venues.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col h-full min-h-0 gap-6 overflow-hidden">
        {/* Clean Minimalist Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5 shrink-0 pr-16 md:pr-20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 shrink-0 shadow-2xs">
              <Building2 size={26} className="stroke-[2.5]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Venue Management
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
            {/* Custom Dropdown Filter */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200/80 rounded-full text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
              >
                <SlidersHorizontal size={16} className="text-slate-500" />
                {activeTab === 'venues' ? 'Venues Directory' : activeTab === 'calendar' ? 'System Reservation Calendar' : activeTab === 'history' ? 'Reservation History' : 'Manage Venue'}
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 flex flex-col">
                  <button 
                    onClick={() => { setActiveTab('venues'); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors cursor-pointer ${activeTab === 'venues' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    Venues Directory {venuesPagination.count > 0 ? `(${venuesPagination.count})` : ''}
                  </button>
                  <button 
                    onClick={() => { setActiveTab('calendar'); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors cursor-pointer ${activeTab === 'calendar' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    System Reservation Calendar
                  </button>
                  <button 
                    onClick={() => { setActiveTab('history'); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors cursor-pointer ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    Reservation History
                  </button>
                  {!isReadOnly && (
                    <button 
                      onClick={() => { setActiveTab('crud'); setIsDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors cursor-pointer ${activeTab === 'crud' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      Manage Venue
                    </button>
                  )}
                </div>
              )}
            </div>

            {!isReadOnly && activeTab !== 'crud' && (
              <button 
                onClick={handleOpenAddModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-full shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95 text-sm cursor-pointer"
              >
                <Plus size={18} className="stroke-[3]" />
                Add New Venue
              </button>
            )}
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center justify-between text-sm font-semibold shadow-sm animate-fadeIn shrink-0">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 rounded-lg text-rose-500 transition-colors cursor-pointer">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2.5 text-sm font-semibold shadow-sm animate-fadeIn shrink-0">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}


        {/* Scrollable Inner Content Container (Header and Tabs stay fixed without scrollbar!) */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* TAB 1: VENUES DIRECTORY */}
        {activeTab === 'venues' && (
          <div className="flex-1 min-h-0 flex flex-col space-y-4">
            {/* Search and Filters Bar */}
            <div className="shrink-0 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center transition-all">
              <div className="relative w-full sm:max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search venues by name, building block, or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200/80 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <div className="shrink-0 w-full sm:w-48">
                  <CustomFilterSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer"
                    options={[
                      { value: 'ALL', label: 'All Statuses' },
                      { value: 'ACTIVE', label: 'Active (Bookable)' },
                      { value: 'MAINTENANCE', label: 'Under Maintenance' },
                      { value: 'DISABLED', label: 'Disabled' },
                      { value: 'ARCHIVED', label: 'Archived' }
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <DataTable
                containerRef={venuesTableRef}
                columns={venueColumns}
                data={filteredVenues}
                loading={loading}
                emptyState={
                  <div className="text-center py-16 px-4 space-y-3">
                    <Building2 size={48} className="mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">No venues found matching your criteria</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">Try clearing your search filter or add a new institutional venue to get started.</p>
                  </div>
                }
                pagination={{
                  hasMore: venuesPagination.hasMore,
                  count: venuesPagination.count,
                  hasPrevPage: venuesCursorHistory.length > 0
                }}
                onNextPage={handleVenuesNextPage}
                onPrevPage={handleVenuesPrevPage}
                hasPrevPage={venuesCursorHistory.length > 0}
              />
            </div>
          </div>
        )}
        {activeTab === 'calendar' && (
          <div className="flex-1 min-h-0 flex flex-col space-y-4">
            {/* Filter Bar */}
            <div className="shrink-0 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Filter size={18} className="text-blue-600" />
                  Reservation & Hold Filters
                </h3>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">FROM:</label>
                  <input
                    type="date"
                    value={calDate}
                    onChange={(e) => setCalDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700"
                  />
                  <label className="text-[11px] font-bold text-slate-500 uppercase ml-2">TO:</label>
                  <input
                    type="date"
                    value={calEndDate}
                    onChange={(e) => setCalEndDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700"
                  />
                  <button
                    onClick={fetchSystemCalendar}
                    className="ml-2 px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw size={13} /> Refresh
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">BUILDING</label>
                  <CustomFilterSelect
                    value={calBuilding}
                    onChange={setCalBuilding}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    options={[
                      { value: '', label: 'All Buildings' },
                      ...BUILDINGS.map(b => ({ value: b, label: b }))
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">SPECIFIC VENUE</label>
                  <CustomFilterSelect
                    value={calVenueId}
                    onChange={setCalVenueId}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    options={[
                      { value: '', label: 'All Venues' },
                      ...allVenues.map(v => ({ value: v.id, label: `${v.name} (${v.building})` }))
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">VENUE TYPE</label>
                  <CustomFilterSelect
                    value={calType}
                    onChange={setCalType}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    options={[
                      { value: '', label: 'All Types' },
                      ...VENUE_TYPES.map(t => ({ value: t, label: t }))
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">BOOKING STATUS</label>
                  <CustomFilterSelect
                    value={calStatus}
                    onChange={setCalStatus}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    options={[
                      { value: 'ALL', label: 'All Statuses (Confirmed / Hold / Maint.)' },
                      { value: 'EVENT', label: 'Confirmed Reservations' },
                      { value: 'RESERVATION', label: 'Temporary Holds (10 Min)' },
                      { value: 'MAINTENANCE', label: 'Maintenance Periods' }
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Calendar Events Grid/List */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-y-auto pr-2">
              {calLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-bold text-slate-500">Querying system reservations and holds...</span>
                </div>
              ) : calendarEvents.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-2">
                  <Calendar size={48} className="mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700">No scheduled bookings or maintenance found</p>
                  <p className="text-xs text-slate-400">Try selecting a broader date range or clearing your filter selections.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="font-extrabold text-xs uppercase tracking-wider text-slate-500">
                      Showing {calendarEvents.length} records between {calDate} and {calEndDate}
                    </span>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Confirmed Event</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Temp Hold</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Maintenance</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {calendarEvents.map((ev, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedCalEvent(ev)}
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 cursor-pointer hover:shadow-md hover:scale-[1.01] ${
                          ev.type === 'EVENT' ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950 hover:border-emerald-400' :
                          ev.type === 'RESERVATION' ? 'bg-amber-50/50 border-amber-300 text-amber-950 shadow-sm hover:border-amber-400' :
                          'bg-rose-50/60 border-rose-300 text-rose-950 hover:border-rose-400'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-sm truncate">{ev.title || ev.reason || 'Draft Hold Slot'}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase shrink-0 ${
                              ev.type === 'EVENT' ? 'bg-emerald-100 text-emerald-800' :
                              ev.type === 'RESERVATION' ? 'bg-amber-200 text-amber-900 animate-pulse' :
                              'bg-rose-200 text-rose-900'
                            }`}>
                              {ev.type === 'EVENT' ? 'Confirmed' : ev.type === 'RESERVATION' ? '10-Min Hold' : 'Maintenance'}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Building2 size={14} className="text-blue-600 shrink-0" />
                            <span>{ev.venueName || ev.venueId}</span>
                            <span className="text-slate-400">({ev.building || 'Block A'})</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-slate-600">
                          <span className="flex items-center gap-1">
                            <Calendar size={13} className="text-slate-400" />
                            {ev.date || `${ev.startDate} ➔ ${ev.endDate}`}
                          </span>
                          {(ev.startTime && ev.endTime) && (
                            <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs font-mono text-[11px]">
                              <Clock size={12} className="text-blue-500" />
                              {ev.startTime} - {ev.endTime}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: RESERVATION HISTORY */}
        {activeTab === 'history' && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col space-y-6 animate-fadeIn">
            <div className="shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Institutional Reservation Archive</h3>
                <p className="text-xs font-semibold text-slate-500">Historical logs of all campus bookings, workshops, and placement drives</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search venue or event..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold w-64 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <DataTable
                columns={reservationHistoryColumns}
                data={[]}
                loading={false}
                emptyState={
                  <div className="p-8 text-center text-slate-400 font-bold">
                    No historical records found.
                  </div>
                }
              />
            </div>
          </div>
        )}
        {activeTab === 'crud' && (
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden animate-fadeIn">
            <div className="shrink-0 p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Venue Management Matrix</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Configure institutional spaces, adjust capacities, and manage facilities</p>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search venues..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>
                <div className="w-full sm:w-44">
                  <CustomFilterSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer"
                    options={[
                      { value: 'ALL', label: 'All Statuses' },
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'MAINTENANCE', label: 'Maintenance' },
                      { value: 'DISABLED', label: 'Disabled' },
                      { value: 'ARCHIVED', label: 'Archived' }
                    ]}
                  />
                </div>
                {!isReadOnly && (
                  <button 
                    onClick={handleOpenAddModal}
                    className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Plus size={16} className="stroke-[3]" />
                    Add Venue
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 p-6 bg-slate-50/30">
              <DataTable
                containerRef={venuesTableRef}
                columns={venuesDirectoryColumns}
                data={filteredVenues}
                loading={loading}
                emptyState={
                  <div className="p-8 text-center text-slate-400 font-bold">
                    No venues found.
                  </div>
                }
                pagination={{
                  hasMore: venuesPagination.hasMore,
                  count: venuesPagination.count,
                  hasPrevPage: venuesCursorHistory.length > 0
                }}
                onNextPage={handleVenuesNextPage}
                onPrevPage={handleVenuesPrevPage}
                hasPrevPage={venuesCursorHistory.length > 0}
              />
            </div>
          </div>
        )}


        </div>


        {/* MODAL 1: ADD / EDIT VENUE */}
        {showVenueModal && !isReadOnly && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
                <h3 className="font-extrabold text-lg flex items-center gap-2">
                  <Building2 size={22} className="text-blue-300" />
                  {editingVenue ? `Edit Venue: ${editingVenue.name}` : 'Add New Institutional Venue'}
                </h3>
                <button onClick={() => setShowVenueModal(false)} className="text-white/70 hover:text-white font-bold text-lg">✕</button>
              </div>

              <form onSubmit={handleSaveVenue} className="p-6 overflow-y-auto space-y-5 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Venue Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Seminar Hall A, Main Auditorium"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Building Location *</label>
                    <select
                      value={formData.building}
                      onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      {BUILDINGS.map((b, idx) => <option key={idx} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Floor Level *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Ground, 1, 2"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Seating Capacity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g., 150"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Venue Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      {VENUE_TYPES.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase mb-1">Operational Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      <option value="ACTIVE">Active (Available for booking)</option>
                      <option value="DISABLED">Disabled (Hidden from search)</option>
                      <option value="MAINTENANCE">Under Maintenance</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase mb-2">Built-in Facilities & AV Equipment</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {COMMON_FACILITIES.map((fac, idx) => {
                      const checked = formData.facilities.includes(fac);
                      return (
                        <label key={idx} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 hover:text-blue-600">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleFacilityToggle(fac)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{fac}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowVenueModal(false)}
                    className="px-5 py-2.5 text-slate-600 font-bold text-sm bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-md transition-all"
                  >
                    {editingVenue ? 'Save Changes' : 'Create Venue'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: MAINTENANCE SCHEDULER */}
        {showMaintenanceModal && selectedVenueForMaint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
              <div className="p-6 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg flex items-center gap-2">
                    <Wrench size={22} />
                    Maintenance Scheduler
                  </h3>
                  <p className="text-amber-100 text-xs mt-0.5">{selectedVenueForMaint.name} ({selectedVenueForMaint.building})</p>
                </div>
                <button onClick={() => setShowMaintenanceModal(false)} className="text-white/70 hover:text-white font-bold text-lg">✕</button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {!isReadOnly && (
                  <form onSubmit={handleScheduleMaintenance} className="space-y-4 bg-amber-50/50 p-4 rounded-xl border border-amber-200">
                    <h4 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">Schedule New Maintenance Window</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Start Date *</label>
                        <input
                          type="date"
                          required
                          value={maintData.startDate}
                          onChange={(e) => setMaintData({ ...maintData, startDate: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">End Date *</label>
                        <input
                          type="date"
                          required
                          value={maintData.endDate}
                          onChange={(e) => setMaintData({ ...maintData, endDate: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Upgrade Description *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Sound System & AC Upgrade"
                        value={maintData.reason}
                        onChange={(e) => setMaintData({ ...maintData, reason: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm rounded-lg shadow-sm transition-all"
                    >
                      Schedule Maintenance Window
                    </button>
                  </form>
                )}

                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Scheduled Maintenance Periods</h4>
                  {maintLoading ? (
                    <div className="py-8 text-center text-slate-400 font-bold text-sm">Loading schedules...</div>
                  ) : maintenanceList.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs font-bold">
                      No maintenance periods scheduled for this venue.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {maintenanceList.map((m, idx) => (
                        <div key={idx} className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                          <div>
                            <p className="font-extrabold text-sm text-slate-800">{m.reason}</p>
                            <p className="text-xs text-amber-700 font-bold flex items-center gap-1 mt-0.5">
                              <Calendar size={13} />
                              {m.startDate} ➔ {m.endDate}
                            </p>
                          </div>
                          {!isReadOnly && (
                            <button
                              onClick={() => handleCancelMaintenance(m.id)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 text-right">
                <button
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-xl transition-colors"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: RESERVATION DETAILS (CALENDAR/HISTORY CLICK) */}
        {selectedCalEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden space-y-6 p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    selectedCalEvent.type === 'EVENT' ? 'bg-emerald-100 text-emerald-600' :
                    selectedCalEvent.type === 'RESERVATION' ? 'bg-amber-100 text-amber-600' :
                    'bg-rose-100 text-rose-600'
                  }`}>
                    <Calendar size={24} />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                      {selectedCalEvent.type === 'EVENT' ? 'Confirmed Event' : selectedCalEvent.type === 'RESERVATION' ? 'Temporary 10-Min Hold' : 'Maintenance Window'}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">{selectedCalEvent.title || selectedCalEvent.reason || 'Draft Hold Slot'}</h3>
                  </div>
                </div>
                <button onClick={() => setSelectedCalEvent(null)} className="text-slate-400 hover:text-slate-600 p-1">
                  <XCircle size={22} />
                </button>
              </div>

              <div className="space-y-3 text-sm font-semibold text-slate-700">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500">Venue</span>
                  <span className="font-extrabold text-slate-900">{selectedCalEvent.venueName || selectedCalEvent.venueId} ({selectedCalEvent.building || 'Campus'})</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-500">Date Range</span>
                  <span className="font-extrabold text-slate-900">{selectedCalEvent.date || `${selectedCalEvent.startDate} ➔ ${selectedCalEvent.endDate}`}</span>
                </div>
                {(selectedCalEvent.startTime && selectedCalEvent.endTime) && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-500">Time Slot</span>
                    <span className="font-extrabold text-blue-600 font-mono">{selectedCalEvent.startTime} — {selectedCalEvent.endTime}</span>
                  </div>
                )}
                {selectedCalEvent.reservedBy && (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-500">Reserved By</span>
                    <span className="font-mono text-xs text-slate-800 truncate max-w-[200px]">{selectedCalEvent.reservedBy}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center gap-3">
                {selectedCalEvent.id && selectedCalEvent.type === 'EVENT' && (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = `/dashboard?eventId=${selectedCalEvent.id}`;
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>Open Event Requisition</span>
                    <ChevronRight size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedCalEvent(null)}
                  className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default VenueManagement;
