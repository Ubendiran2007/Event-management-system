import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Calendar as CalendarIcon, Clock, MapPin, Users, Search, 
  Filter, CheckCircle2, AlertCircle, ArrowRight, Layers, LayoutGrid, 
  RefreshCw, ShieldAlert, Sparkles, X, Info
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { motion, AnimatePresence } from 'framer-motion';

const VENUE_TYPES = ['Auditorium', 'Seminar Hall', 'Conference Hall', 'Smart Classroom', 'Lab', 'Board Room', 'Studio', 'Other'];
const BUILDINGS = ['Block A', 'Block B', 'Block C', 'IT Centre', 'Main Building', 'Admin Block', 'Other'];
const COMMON_FACILITIES = ['Projector', 'AC', 'Smart Board', 'Sound System', 'Microphone', 'Wi-Fi', 'Podium', 'LED Display'];

// Configurable hourly timeline slots from 08:00 to 20:00
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

const VenueSelection = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'card'
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reserving, setReserving] = useState(false);
  const [calendarData, setCalendarData] = useState({}); // map venueId -> array of events/holds/maint
  const [calLoading, setCalLoading] = useState(false);
  const [dragRange, setDragRange] = useState(null); // { venueId, startIdx, endIdx }

  // Filters
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [selectedFacilities, setSelectedFacilities] = useState([]);

  // Selected Booking Slot
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';

  useEffect(() => {
    fetchActiveVenues();
  }, []);

  useEffect(() => {
    if (venues.length > 0 && selectedDate) {
      fetchCalendarForDate(selectedDate);
    }
  }, [venues, selectedDate]);

  const fetchActiveVenues = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${backendUrl}/api/venues`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setVenues(data.data || []);
      } else {
        setError(data.message || 'Failed to load venues directory');
      }
    } catch (err) {
      setError('Network error loading venues: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarForDate = async (dateStr) => {
    try {
      setCalLoading(true);
      const params = new URLSearchParams({
        startDate: dateStr,
        endDate: dateStr
      });
      const res = await fetch(`${backendUrl}/api/venues/calendar/system?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        const items = data.data || [];
        const map = {};
        venues.forEach(v => { map[v.id] = []; });
        items.forEach(item => {
          if (!map[item.venueId]) map[item.venueId] = [];
          map[item.venueId].push(item);
        });
        setCalendarData(map);
      }
    } catch (err) {
      console.error('Error fetching calendar slots:', err);
    } finally {
      setCalLoading(false);
    }
  };

  const handleFacilityToggle = (fac) => {
    setSelectedFacilities(prev => 
      prev.includes(fac) ? prev.filter(f => f !== fac) : [...prev, fac]
    );
  };

  const filteredVenues = useMemo(() => {
    return venues.filter(v => {
      const matchSearch = v.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          v.building?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchBuilding = !buildingFilter || v.building === buildingFilter;
      const matchType = !typeFilter || v.type === typeFilter;
      const matchCap = !minCapacity || (Number(v.capacity || 0) >= Number(minCapacity));
      const matchFac = selectedFacilities.length === 0 || 
                       selectedFacilities.every(f => (v.facilities || []).includes(f));
      return matchSearch && matchBuilding && matchType && matchCap && matchFac;
    });
  }, [venues, searchQuery, buildingFilter, typeFilter, minCapacity, selectedFacilities]);

  // Helper to check if a specific time slot is occupied for a venue
  const getSlotStatus = (venueId, timeStr) => {
    const events = calendarData[venueId] || [];
    // Convert timeStr like '09:00' to int 9
    const hour = parseInt(timeStr.split(':')[0], 10);

    for (const ev of events) {
      if (ev.type === 'MAINTENANCE') {
        return { status: 'MAINTENANCE', label: ev.reason || 'Under Maintenance' };
      }
      if (ev.startTime && ev.endTime) {
        const startH = parseInt(ev.startTime.split(':')[0], 10);
        const endH = parseInt(ev.endTime.split(':')[0], 10);
        if (hour >= startH && hour < endH) {
          if (ev.type === 'EVENT') return { status: 'BOOKED', label: ev.title || 'Booked Event' };
          if (ev.type === 'RESERVATION') return { status: 'HOLD', label: 'Draft Hold (10m)' };
        }
      }
    }
    return { status: 'FREE', label: 'Available' };
  };

  const handleSelectVenueSlot = (venue, defaultStart = '09:00', defaultEnd = '11:00') => {
    setSelectedVenue(venue);
    setStartTime(defaultStart);
    setEndTime(defaultEnd);
  };

  const handleReserveAndProceed = async () => {
    if (!selectedVenue || !selectedDate || !startTime || !endTime) {
      alert("Please select a valid venue, date, and time range.");
      return;
    }
    if (startTime >= endTime) {
      alert("End time must be after start time.");
      return;
    }

    try {
      setReserving(true);
      setError('');
      const payload = {
        venueId: selectedVenue.id,
        date: selectedDate,
        startTime,
        endTime
      };

      const res = await fetch(`${backendUrl}/api/venues/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'This venue slot is already booked or currently under maintenance.');
      }

      const holdData = {
        reservationId: data.data.reservationId,
        expiresAt: data.data.expiresAt,
        date: selectedDate,
        startTime,
        endTime
      };

      // Store hold in sessionStorage as backup for route protection
      sessionStorage.setItem('currentVenueHold', JSON.stringify({
        venue: selectedVenue,
        reservation: holdData
      }));

      // Navigate to event creation details page
      navigate('/create-event/details', {
        state: {
          venue: selectedVenue,
          reservation: holdData
        }
      });
    } catch (err) {
      setError(err.message);
      // Refresh calendar to reflect new bookings if any
      fetchCalendarForDate(selectedDate);
    } finally {
      setReserving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 flex-1 min-h-0 flex flex-col">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 p-6 sm:p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-2 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-extrabold uppercase tracking-wider">
              <Sparkles size={14} className="text-amber-300" /> Step 1: Venue-First Event Creation
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
              Interactive Venue Scheduler
            </h1>
            <p className="text-blue-100 text-sm sm:text-base max-w-2xl font-medium leading-relaxed">
              Select your event date, check real-time institutional hall occupancy, and place a 10-minute hold on your preferred venue before entering event details.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 z-10 shrink-0">
            <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 flex items-center gap-1">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  viewMode === 'timeline' ? 'bg-white text-blue-950 shadow-md' : 'text-blue-200 hover:text-white'
                }`}
              >
                <Layers size={14} /> Timeline View
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  viewMode === 'card' ? 'bg-white text-blue-950 shadow-md' : 'text-blue-200 hover:text-white'
                }`}
              >
                <LayoutGrid size={14} /> Card Grid View
              </button>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center justify-between text-sm font-semibold shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600 font-bold p-1">✕</button>
          </div>
        )}

        {/* Main Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start flex-1 min-h-0">
          
          {/* LEFT SIDEBAR: FILTERS */}
          <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md space-y-6 lg:sticky lg:top-24">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Filter size={18} className="text-blue-600" /> Filter Directory
              </h3>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setBuildingFilter('');
                  setTypeFilter('');
                  setMinCapacity('');
                  setSelectedFacilities([]);
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Reset All
              </button>
            </div>

            {/* Date Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Event Date *
              </label>
              <div className="relative">
                <CalendarIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600" />
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-blue-50/50 border border-blue-200 rounded-xl text-sm font-bold text-blue-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            {/* Search input */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Search Name</label>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Hall name, location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            {/* Building */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Building Block</label>
              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              >
                <option value="">All Institutional Blocks</option>
                {BUILDINGS.map((b, idx) => <option key={idx} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Venue Type */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Venue Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              >
                <option value="">All Venue Types</option>
                {VENUE_TYPES.map((t, idx) => <option key={idx} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Min Capacity */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Min. Seating Capacity</label>
              <input
                type="number"
                placeholder="e.g. 100"
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:border-blue-600 transition-all"
              />
            </div>

            {/* Facilities Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Required Facilities</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {COMMON_FACILITIES.map((fac, idx) => {
                  const checked = selectedFacilities.includes(fac);
                  return (
                    <label key={idx} className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleFacilityToggle(fac)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="truncate">{fac}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT AREA: SCHEDULER & BOOKING BAR */}
          <div className="lg:col-span-3 space-y-6 flex flex-col min-h-0 flex-1">
            
            {/* Quick Stats / Legend */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="text-sm font-extrabold text-slate-800 flex items-center">
                  Showing {filteredVenues.length} available halls for <span className="text-blue-600 underline decoration-2 ml-1">{selectedDate}</span>
                  {calLoading && <RefreshCw size={14} className="animate-spin text-blue-600 ml-2" />}
                </span>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5 shadow-2xs">
                  💡 Tip: Click and drag across adjacent free slots to select range!
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-extrabold">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-emerald-500 border border-emerald-600 inline-block" /> Free / Available</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-amber-400 border border-amber-500 inline-block" /> Draft Hold</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-rose-500 border border-rose-600 inline-block" /> Booked / Maintenance</span>
              </div>
            </div>

            {/* VIEW 1: TIMELINE VIEW */}
            {viewMode === 'timeline' && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden flex-1 min-h-0 flex flex-col">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-bold text-slate-500">Loading campus timeline matrix...</span>
                  </div>
                ) : filteredVenues.length === 0 ? (
                  <div className="text-center py-24 px-4 space-y-3">
                    <Building2 size={56} className="mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700 text-lg">No venues match your current filter preferences</p>
                    <p className="text-sm text-slate-400 max-w-md mx-auto">Try lowering minimum seating capacity or resetting facility filters in the left panel.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto flex-1">
                    <table className="w-full border-collapse text-left min-w-[850px]">
                      <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                          <th className="py-4 px-5 font-black w-64 sticky left-0 bg-slate-900 z-20 border-r border-slate-800">
                            Venue Details
                          </th>
                          {TIME_SLOTS.map((slot, i) => (
                            <th key={i} className="py-4 px-2 font-black text-center border-r border-slate-800/60 min-w-[65px]">
                              {slot}
                            </th>
                          ))}
                          <th className="py-4 px-4 font-black text-center bg-slate-900 z-10">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 text-sm">
                        {filteredVenues.map(venue => {
                          const isSelected = selectedVenue?.id === venue.id;
                          return (
                            <tr 
                              key={venue.id} 
                              className={`transition-colors ${isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'}`}
                            >
                              {/* Sticky Venue Info Col */}
                              <td className={`py-4 px-5 sticky left-0 z-10 border-r border-slate-200 ${isSelected ? 'bg-blue-50/95 font-bold' : 'bg-white'}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="space-y-0.5">
                                    <div className="font-black text-slate-900 text-base flex items-center gap-1.5">
                                      {venue.name}
                                      {isSelected && <CheckCircle2 size={16} className="text-blue-600 inline" />}
                                    </div>
                                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                      <MapPin size={12} className="text-slate-400" />
                                      {venue.building} - Floor {venue.floor}
                                    </div>
                                    <div className="text-[11px] font-extrabold text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded-md inline-block mt-1 border border-blue-100">
                                      <Users size={11} className="inline mr-1" /> {venue.capacity} Seats
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Hourly Matrix Columns */}
                              {TIME_SLOTS.map((slot, idx) => {
                                const { status, label } = getSlotStatus(venue.id, slot);
                                const isFree = status === 'FREE';
                                const isHold = status === 'HOLD';
                                const isBooked = status === 'BOOKED' || status === 'MAINTENANCE';

                                const isDraggingThis = dragRange && dragRange.venueId === venue.id && 
                                  idx >= Math.min(dragRange.startIdx, dragRange.endIdx) && 
                                  idx <= Math.max(dragRange.startIdx, dragRange.endIdx);

                                return (
                                  <td key={idx} className="p-1.5 border-r border-slate-100 text-center align-middle">
                                    <button
                                      type="button"
                                      disabled={!isFree}
                                      onMouseDown={(e) => {
                                        if (isFree && e.button === 0) {
                                          setDragRange({ venueId: venue.id, startIdx: idx, endIdx: idx });
                                        }
                                      }}
                                      onMouseEnter={() => {
                                        if (dragRange && dragRange.venueId === venue.id && isFree) {
                                          setDragRange({ ...dragRange, endIdx: idx });
                                        }
                                      }}
                                      onMouseUp={() => {
                                        if (dragRange && dragRange.venueId === venue.id) {
                                          const sIdx = Math.min(dragRange.startIdx, idx);
                                          const eIdx = Math.max(dragRange.startIdx, idx);
                                          handleSelectVenueSlot(venue, TIME_SLOTS[sIdx], TIME_SLOTS[Math.min(eIdx + 1, TIME_SLOTS.length - 1)]);
                                          setDragRange(null);
                                        }
                                      }}
                                      onClick={() => {
                                        if (!dragRange || dragRange.startIdx === dragRange.endIdx) {
                                          handleSelectVenueSlot(venue, slot, TIME_SLOTS[Math.min(idx + 1, TIME_SLOTS.length - 1)]);
                                        }
                                      }}
                                      title={isFree ? `Click or drag to reserve starting at ${slot}` : `${label} (${slot})`}
                                      className={`w-full h-11 rounded-lg font-bold text-[11px] transition-all flex flex-col items-center justify-center p-1 shadow-2xs select-none ${
                                        isDraggingThis ? 'bg-blue-600 text-white border-2 border-blue-700 scale-105 shadow-md z-10' :
                                        isFree ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-500 hover:text-white hover:border-emerald-600 hover:scale-105 cursor-pointer' :
                                        isHold ? 'bg-amber-100 text-amber-900 border border-amber-300 cursor-not-allowed animate-pulse' :
                                        'bg-rose-100 text-rose-900 border border-rose-300 cursor-not-allowed opacity-80'
                                      }`}
                                    >
                                      <span>{isFree ? 'Free' : isHold ? 'Hold' : 'Busy'}</span>
                                      <span className="text-[9px] opacity-75 font-mono">{slot}</span>
                                    </button>
                                  </td>
                                );
                              })}

                              {/* Action button */}
                              <td className="py-4 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleSelectVenueSlot(venue)}
                                  className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all ${
                                    isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-600/50' : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700'
                                  }`}
                                >
                                  {isSelected ? 'Selected' : 'Select'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: CARD GRID VIEW */}
            {viewMode === 'card' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 overflow-y-auto pr-1">
                {loading ? (
                  <div className="col-span-full py-24 text-center font-bold text-slate-500">Loading campus halls...</div>
                ) : filteredVenues.length === 0 ? (
                  <div className="col-span-full py-24 text-center text-slate-500 font-bold">No institutional venues found matching filters.</div>
                ) : (
                  filteredVenues.map(venue => {
                    const isSelected = selectedVenue?.id === venue.id;
                    return (
                      <div
                        key={venue.id}
                        onClick={() => handleSelectVenueSlot(venue)}
                        className={`p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                          isSelected ? 'bg-blue-50/90 border-blue-600 shadow-xl ring-2 ring-blue-600/30' : 'bg-white border-slate-200/80 hover:border-blue-400 hover:shadow-md'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-extrabold uppercase tracking-wider">
                                {venue.type || 'Hall'}
                              </span>
                              <h4 className="text-lg font-black text-slate-900 mt-1 flex items-center gap-2">
                                {venue.name}
                                {isSelected && <CheckCircle2 size={18} className="text-blue-600" />}
                              </h4>
                            </div>
                            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-xl text-xs font-black border border-blue-100 shrink-0">
                              <Users size={12} className="inline mr-1" /> {venue.capacity} Seats
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                            <span className="flex items-center gap-1"><MapPin size={14} className="text-slate-400" /> {venue.building}</span>
                            <span>• Floor {venue.floor}</span>
                          </div>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(venue.facilities || []).map((f, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-md">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            • Available for {selectedDate}
                          </span>
                          <button
                            type="button"
                            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                              isSelected ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 group-hover:bg-blue-600 group-hover:text-white'
                            }`}
                          >
                            {isSelected ? 'Selected Slot' : 'Select Venue'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* STICKY BOTTOM RESERVATION CONFIRMATION BAR */}
            <div className="sticky bottom-4 z-40 bg-slate-900/95 backdrop-blur-md text-white p-5 sm:p-6 rounded-3xl shadow-2xl border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-6 animate-slideUp">
              <div className="space-y-1">
                {selectedVenue ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-lg">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-400" /> Ready to Place 10-Minute Hold
                      </div>
                      <h4 className="text-lg font-black text-white">{selectedVenue.name} <span className="text-sm font-semibold text-slate-300">({selectedVenue.building})</span></h4>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center shrink-0 border border-slate-700">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-300">No Venue Currently Selected</h4>
                      <p className="text-xs text-slate-400">Please choose a free slot from the timeline above to proceed.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Time selector and Submit */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-800/90 p-2 rounded-2xl border border-slate-700">
                  <div className="flex items-center gap-1.5 px-2">
                    <Clock size={16} className="text-blue-400" />
                    <span className="text-xs font-extrabold text-slate-300">Time:</span>
                  </div>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-slate-400 text-xs font-bold">➔</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="button"
                  disabled={!selectedVenue || reserving}
                  onClick={handleReserveAndProceed}
                  className={`px-7 py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2.5 shadow-xl shrink-0 ${
                    !selectedVenue || reserving ? 'bg-slate-700 text-slate-400 cursor-not-allowed' :
                    'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-600/30 hover:scale-[1.02] active:scale-95'
                  }`}
                >
                  {reserving ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Locking Slot...</span>
                    </>
                  ) : (
                    <>
                      <span>Reserve Slot & Continue</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VenueSelection;
