import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon, Clock, Search, MapPin, Users,
  CheckCircle, AlertCircle, X, ChevronRight, Activity,
  User, Hourglass, Unlock, Building2, Info, ChevronDown, ChevronUp,
  Ban, Loader2
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { venueApi } from '../utils/api';
import PremiumDatePicker from './PremiumDatePicker';
import TimePicker from './TimePicker';

import { getRolePath } from '../utils/routeUtils';

const VenueSelectionModal = ({ isOpen, onClose, onVenueReserved }) => {
  const navigate = useNavigate();
  const { currentUser } = useAppContext();

  const [step, setStep] = useState(1);
  const contentRef = useRef(null);

  const todayStr = () => new Date().toISOString().slice(0, 10);

  // Step 1 state
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('16:00');

  // Step 2 state
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Reservation state
  const [reservingId, setReservingId] = useState(null);
  const [reservationSuccess, setReservationSuccess] = useState(null);

  // Hold detail panel — which venue card is expanded
  const [expandedHoldId, setExpandedHoldId] = useState(null);

  // Unreserve state
  const [releasingId, setReleasingId] = useState(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setStartDate(todayStr());
      setEndDate(todayStr());
      setStartTime('09:00');
      setEndTime('16:00');
      setVenues([]);
      setError('');
      setReservationSuccess(null);
      setReservingId(null);
      setExpandedHoldId(null);
      setReleasingId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error, step, reservationSuccess]);

  const handleSearchAvailable = async () => {
    if (!startDate || !endDate || !startTime || !endTime) {
      setError('Please fill in all date and time fields.');
      return;
    }
    if (startDate > endDate) {
      setError('End date must be on or after start date.');
      return;
    }
    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }

    setError('');
    setStep(2);
    setLoading(true);
    setExpandedHoldId(null);

    try {
      const res = await venueApi.listActive({ startDate, endDate, startTime, endTime });
      let enriched = [];

      if (res?.success && Array.isArray(res.data) && res.data.length > 0 && res.data[0].slotStatus !== undefined) {
        enriched = res.data;
      } else {
        const allVenues = res?.success ? (res.data || []) : [];
        const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        const reqStart = toMin(startTime);
        const reqEnd = toMin(endTime);

        const calResults = await Promise.all(
          allVenues.map(async (v) => {
            const venueId = v.id || v.venueId || v.venue_id;
            try {
              const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500));
              const calRes = await Promise.race([venueApi.getCalendar(venueId, startDate, endDate), timeout]);
              const cal = calRes?.success ? (calRes.data || []) : [];
              let slotStatus = 'AVAILABLE';
              for (const it of cal) {
                if (!it?.startTime || !it?.endTime) continue;
                const s = toMin(it.startTime); const e = toMin(it.endTime);
                if (s < reqEnd && e > reqStart) {
                  if (it.type === 'MAINTENANCE') { slotStatus = 'UNAVAILABLE'; break; }
                  if (it.type === 'EVENT' || it.status === 'BOOKED') { slotStatus = 'BOOKED'; break; }
                  if (!it.expiresAt || new Date(it.expiresAt) > new Date()) slotStatus = 'HELD';
                }
              }
              return { ...v, slotStatus, available: slotStatus === 'AVAILABLE', isAvailable: slotStatus === 'AVAILABLE' };
            } catch (_) {
              return { ...v, slotStatus: 'AVAILABLE', available: true, isAvailable: true };
            }
          })
        );
        enriched = calResults;
      }

      setVenues(enriched);
    } catch (err) {
      console.warn('[VenueSelectionModal] Search availability failed:', err?.message || err);
      setError('Failed to load venues. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (venue) => {
    setReservingId(venue.id);
    setError('');

    try {
      const venueId = venue.id || venue.venueId || venue.venue_id;
      let holdResult = null;
      const legacyFallback = async () => {
        try {
          return await venueApi.reserveVenue({ venueId, date: startDate, startDate, endDate, startTime, endTime });
        } catch (legacyErr) {
          return { success: false, message: legacyErr?.message || 'Legacy reserve failed.' };
        }
      };

      try {
        holdResult = await venueApi.holdVenue(venueId, { date: startDate, startDate, endDate, startTime, endTime });
      } catch (holdErr) {
        holdResult = await legacyFallback();
      }

      if (!holdResult || !holdResult.success) {
        const reason = String(holdResult?.message || '').toLowerCase();
        const needsFallback = !holdResult
          || /404|not found|endpoint/i.test(reason)
          || /responded with status instead of json/i.test(reason)
          || /non-json/i.test(reason);
        if (needsFallback) holdResult = await legacyFallback();
      }

      if (holdResult?.success) {
        const payload = holdResult.reservation || holdResult.data || {};
        const holdReservation = {
          reservationId: payload.reservationId,
          expiresAt: payload.expiresAt,
          holdDurationMinutes: payload.holdDurationMinutes || null,
          date: startDate,
          startDate,
          endDate,
          startTime,
          endTime
        };
        if (!holdReservation.reservationId || !holdReservation.expiresAt) {
          throw new Error(holdResult.message || 'Server did not return a valid venue hold. Please refresh and try again.');
        }
        setReservationSuccess({ venue, reservation: holdReservation });
        sessionStorage.setItem('currentVenueHold', JSON.stringify({ venue, reservation: holdReservation }));

        setTimeout(() => {
          onClose();
          const rolePrefix = getRolePath(currentUser?.role);
          const basePath = rolePrefix ? `/${rolePrefix}` : '';
          navigate(`${basePath}/create-event/details`, {
            state: { reservation: holdReservation, venue, date: startDate, startDate, endDate, startTime, endTime }
          });
        }, 500);
      } else {
        const code = holdResult?.code || '';
        const isConflict = code && (code.includes('CONFLICT') || (code === 'VALIDATION' && /reserved|overlap|slot/i.test(holdResult.message || '')))
          || /reserved|conflict|already booked|unavailable|overlap|maintenance/i.test(holdResult?.message || '');
        const earliest = holdResult?.earliestAvailable || holdResult?.data?.earliestAvailable;
        const suffix = earliest ? ` Available after ${new Date(earliest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : '';
        const msg = holdResult?.message || 'This venue was just reserved by another user. Please choose another venue.';
        if (isConflict) {
          setVenues(prev => prev.map(v => (v.id || v.venueId) === venueId ? { ...v, isAvailable: false, slotStatus: 'HELD', earliestAvailable: earliest || v.earliestAvailable } : v));
        }
        setError(msg + suffix);
      }
    } catch (err) {
      setError(err.message || 'Failed to reserve venue. Please try again.');
    } finally {
      setReservingId(null);
    }
  };

  const handleRelease = async (venue) => {
    const venueId = venue.id || venue.venueId;
    const holdDetails = venue.holdDetails;
    if (!holdDetails?.reservationId) return;

    setReleasingId(venueId);
    setError('');
    try {
      const res = await venueApi.releaseHold(venueId, holdDetails.reservationId);
      if (res?.success) {
        // Mark venue as available locally
        setVenues(prev => prev.map(v =>
          (v.id || v.venueId) === venueId
            ? { ...v, slotStatus: 'AVAILABLE', isAvailable: true, available: true, holdDetails: null }
            : v
        ));
        setExpandedHoldId(null);
      } else {
        setError(res?.message || 'Failed to release the hold. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Failed to release the hold. Please try again.');
    } finally {
      setReleasingId(null);
    }
  };

  if (!isOpen) return null;

  const filteredVenues = venues.filter(v => {
    if (typeFilter !== 'ALL' && v.type !== typeFilter) return false;
    if (searchQuery && !(v.name || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  const fmtExpiry = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    const diffMs = d - Date.now();
    if (diffMs <= 0) return 'Expired';
    const mins = Math.ceil(diffMs / 60000);
    return mins < 60 ? `${mins} min` : `${Math.ceil(mins / 60)} hr`;
  };

  const dateRibbonLabel = startDate === endDate
    ? new Date(startDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : `${new Date(startDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(endDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm">
      {/* Wider modal: max-w-5xl, up to 92vh */}
      <div className="bg-white rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cse-primary/10 rounded-lg flex items-center justify-center">
              <Building2 size={16} className="text-cse-primary" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Select Venue</h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={step === 1 ? 'text-cse-primary font-semibold' : ''}>1. Date &amp; Time</span>
              <ChevronRight size={12} />
              <span className={step === 2 ? 'text-cse-primary font-semibold' : ''}>2. Available Venues</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div ref={contentRef} className={`flex-1 p-5 ${step === 2 ? 'overflow-y-auto' : 'overflow-visible'}`}>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          {/* ── STEP 1: DATE & TIME ── */}
          {step === 1 && (
            <div className="max-w-lg mx-auto space-y-5 py-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Date</label>
                  <PremiumDatePicker value={startDate} min={todayStr()} onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-xl border-slate-200 px-3 py-2.5 shadow-sm focus:ring-cse-primary/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Date</label>
                  <PremiumDatePicker value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full rounded-xl border-slate-200 px-3 py-2.5 shadow-sm focus:ring-cse-primary/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Time</label>
                  <TimePicker id="venue-start-time" value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Time</label>
                  <TimePicker id="venue-end-time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm" />
                </div>
              </div>
              {startDate !== endDate && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 font-medium flex items-center gap-2">
                  <CalendarIcon size={13} />
                  Multi-day reservation: {fmtDate(startDate)} → {fmtDate(endDate)} — same time slot each day.
                </div>
              )}
              <button
                onClick={handleSearchAvailable}
                className="w-full py-3 bg-cse-primary hover:bg-cse-hover text-white rounded-xl font-semibold shadow-md flex items-center justify-center gap-2 transition-all active:scale-[.98]"
              >
                <Search size={16} /> Search Available Venues
              </button>
            </div>
          )}

          {/* ── STEP 2: VENUE LIST ── */}
          {step === 2 && !reservationSuccess && (
            <div className="space-y-3">

              {/* Time ribbon + filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 flex-1 min-w-0">
                  <span className="flex items-center gap-1.5"><CalendarIcon size={13} className="text-cse-primary" />{dateRibbonLabel}</span>
                  <span className="text-slate-300">|</span>
                  <span className="flex items-center gap-1.5"><Clock size={13} className="text-cse-primary" />{fmtTime(startTime)} – {fmtTime(endTime)}</span>
                  <button onClick={() => setStep(1)} className="ml-auto text-cse-primary font-semibold text-xs hover:underline whitespace-nowrap">Change</button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="text" placeholder="Search venues…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-1 focus:ring-cse-primary/30 w-44 outline-none" />
                </div>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="text-xs rounded-xl border border-slate-200 px-2 py-2 bg-white focus:ring-1 focus:ring-cse-primary/30 outline-none">
                  <option value="ALL">All Types</option>
                  <option value="Classroom">Classroom</option>
                  <option value="Seminar Hall">Seminar Hall</option>
                  <option value="Auditorium">Auditorium</option>
                  <option value="Lab">Lab</option>
                </select>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 px-1">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle size={11} /> Available</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600"><Activity size={11} /> Held (Draft) — click for details</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600"><AlertCircle size={11} /> Booked Event</span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">Unavailable</span>
              </div>

              {loading ? (
                <div className="flex justify-center py-14">
                  <div className="w-7 h-7 border-4 border-cse-primary/30 border-t-cse-primary rounded-full animate-spin" />
                </div>
              ) : filteredVenues.length === 0 ? (
                <div className="text-center py-14 text-slate-400 text-sm">No venues found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredVenues.map(venue => {
                    const vid = venue.id || venue.venueId;
                    const status = venue.slotStatus || (venue.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE');
                    const isAvail = status === 'AVAILABLE';
                    const isHeld = status === 'HELD';
                    const isExpanded = expandedHoldId === vid;
                    const hold = venue.holdDetails;
                    const isMyHold = hold?.organizerId === currentUser?.id || hold?.organizerId === currentUser?.uid;
                    const releasing = releasingId === vid;

                    const earliest = venue.earliestAvailable
                      ? new Date(venue.earliestAvailable).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : null;

                    const badge = {
                      AVAILABLE:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle size={11} />, label: 'Available' },
                      HELD:        { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  icon: <Activity size={11} className="animate-pulse" />, label: 'Held (Draft)' },
                      BOOKED:      { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',   icon: <AlertCircle size={11} />, label: 'Booked' },
                    }[status] || { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', icon: <AlertCircle size={11} />, label: 'Unavailable' };

                    return (
                      <div
                        key={vid}
                        className={`border rounded-xl flex flex-col transition-all duration-200 ${
                          isAvail ? 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'
                          : isHeld ? `bg-white ${isExpanded ? 'border-amber-300 shadow-md' : 'border-amber-100 hover:border-amber-300 hover:shadow-sm'} cursor-pointer`
                          : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        {/* Card top — always visible */}
                        <div
                          className="p-4 flex flex-col gap-3"
                          onClick={isHeld ? () => setExpandedHoldId(isExpanded ? null : vid) : undefined}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-sm truncate">{venue.name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                                <MapPin size={11} /> {venue.building}{venue.floor ? ` · Floor ${venue.floor}` : ''}
                              </p>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <span className={`px-2 py-0.5 ${badge.bg} ${badge.text} border ${badge.border} text-[11px] font-bold rounded-full flex items-center gap-1`}>
                                {badge.icon} {badge.label}
                              </span>
                              {earliest && !isAvail && <span className="text-[10px] text-slate-400">Free after {earliest}</span>}
                              {isHeld && hold?.expiresAt && (
                                <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                                  <Hourglass size={9} /> Expires in {fmtExpiry(hold.expiresAt)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-md flex items-center gap-1">
                              <Users size={10} /> {venue.capacity}
                            </span>
                            {(venue.facilities || []).slice(0, 3).map((f, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-md">{f}</span>
                            ))}
                          </div>

                          {/* Action button */}
                          {isAvail ? (
                            <button
                              disabled={reservingId === vid}
                              onClick={() => handleReserve(venue)}
                              className="w-full py-2 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white shadow-sm active:scale-[.98]"
                            >
                              {reservingId === vid
                                ? <><Activity size={13} className="animate-spin" /> Holding Slot…</>
                                : 'Hold & Create Event'
                              }
                            </button>
                          ) : isHeld ? (
                            <button
                              onClick={() => setExpandedHoldId(isExpanded ? null : vid)}
                              className="w-full py-2 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                            >
                              <Info size={13} />
                              {isExpanded ? 'Hide Details' : 'View Hold Details'}
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          ) : (
                            <button disabled className="w-full py-2 rounded-lg font-semibold text-xs bg-slate-100 text-slate-400 cursor-not-allowed flex items-center justify-center gap-1.5">
                              <Ban size={12} /> {status === 'BOOKED' ? 'Booked for Event' : 'Unavailable'}
                            </button>
                          )}
                        </div>

                        {/* ── HELD DETAILS PANEL (expanded) ── */}
                        {isHeld && isExpanded && hold && (
                          <div className="border-t border-amber-100 bg-amber-50/60 rounded-b-xl px-4 py-3.5 space-y-3">
                            <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide">Hold Information</p>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-start gap-1.5">
                                <User size={12} className="text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-[10px] text-amber-700 font-semibold">Reserved By</p>
                                  <p className="font-bold text-slate-800">{hold.organizerName || 'Unknown'}</p>
                                  {hold.department && <p className="text-[10px] text-slate-500">{hold.department}</p>}
                                </div>
                              </div>

                              <div className="flex items-start gap-1.5">
                                <CalendarIcon size={12} className="text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-[10px] text-amber-700 font-semibold">Reserved For</p>
                                  <p className="font-bold text-slate-800">
                                    {hold.startDate === hold.endDate
                                      ? fmtDate(hold.startDate)
                                      : `${fmtDate(hold.startDate)} → ${fmtDate(hold.endDate)}`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-start gap-1.5">
                                <Clock size={12} className="text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-[10px] text-amber-700 font-semibold">Time Slot</p>
                                  <p className="font-bold text-slate-800">{fmtTime(hold.startTime)} – {fmtTime(hold.endTime)}</p>
                                </div>
                              </div>

                              <div className="flex items-start gap-1.5">
                                <Hourglass size={12} className="text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-[10px] text-amber-700 font-semibold">Hold Expires In</p>
                                  <p className="font-bold text-slate-800">{fmtExpiry(hold.expiresAt)}</p>
                                  {hold.heldAt && (
                                    <p className="text-[10px] text-slate-500">
                                      Held at {new Date(hold.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Free-after info */}
                            {hold.endTime && (
                              <div className="p-2 bg-white border border-amber-200 rounded-lg text-[11px] text-slate-600 font-medium flex items-center gap-2">
                                <Clock size={11} className="text-amber-500 shrink-0" />
                                Venue will be free after <strong className="text-slate-800 ml-1">{fmtTime(hold.endTime)}</strong>
                                {hold.expiresAt && new Date(hold.expiresAt) > new Date() && (
                                  <span className="ml-auto text-amber-600 font-semibold">or when hold expires</span>
                                )}
                              </div>
                            )}

                            {/* Unreserve button — only for the person who reserved */}
                            {isMyHold && (
                              <button
                                onClick={() => handleRelease(venue)}
                                disabled={releasing}
                                className="w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {releasing
                                  ? <><Loader2 size={13} className="animate-spin" /> Releasing…</>
                                  : <><Unlock size={13} /> Release My Hold</>
                                }
                              </button>
                            )}

                            {!isMyHold && (
                              <p className="text-[11px] text-slate-500 text-center">
                                Only the person who reserved this venue can release it.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── SUCCESS ── */}
          {reservationSuccess && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce-once">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Venue Reserved!</h3>
              <p className="text-sm text-slate-500">
                {reservationSuccess.venue.name} &nbsp;·&nbsp;
                {startDate === endDate ? fmtDate(startDate) : `${fmtDate(startDate)} → ${fmtDate(endDate)}`} &nbsp;·&nbsp;
                {fmtTime(startTime)}–{fmtTime(endTime)}
              </p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <Activity size={12} className="animate-spin" /> Redirecting to event creation…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VenueSelectionModal;
