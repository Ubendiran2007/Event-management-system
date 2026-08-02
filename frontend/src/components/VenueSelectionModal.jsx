import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, Search, MapPin, Users, CheckCircle, AlertCircle, X, ChevronRight, Activity } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { venueApi } from '../utils/api';
import PremiumDatePicker from './PremiumDatePicker';
import TimePicker from './TimePicker';

const VenueSelectionModal = ({ isOpen, onClose, onVenueReserved }) => {
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  
  const [step, setStep] = useState(1); // 1: Date/Time, 2: Venue Search
  const contentRef = useRef(null);

  const todayStr = () => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  };
  
  // Step 1 State — real defaults so the displayed TimePicker values match the stored state
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('16:00');

  // Step 2 State
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  
  // Reservation State
  const [reservingId, setReservingId] = useState(null);
  const [reservationSuccess, setReservationSuccess] = useState(null);

  // Reset modal when opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setDate(todayStr());
      setStartTime('09:00');
      setEndTime('16:00');
      setVenues([]);
      setError('');
      setReservationSuccess(null);
      setReservingId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error, step, reservationSuccess]);

  const handleSearchAvailable = async () => {
    if (!date || !startTime || !endTime) {
      setError('Please fill in all date and time fields.');
      return;
    }
    
    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }

    setError('');
    setStep(2);
    setLoading(true);

    const toMin = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const reqStart = toMin(startTime);
    const reqEnd = toMin(endTime);

    try {
      const listRes = await venueApi.listActive();
      // NOTE: If backend is stale (no new enterprise endpoints yet) listRes may be
      // { success: false, message: '404...' }. Swallow gracefully by falling back
      // to legacy venues API shape.
      let allVenues = (listRes && listRes.success) ? (listRes.data || []) : [];
      if (!allVenues.length && listRes && listRes.data && Array.isArray(listRes.data)) {
        allVenues = listRes.data;
      }

      const timeConflictStatus = (items) => {
        let bestStatus = 'AVAILABLE';
        let earliestEnd = null;
        if (!Array.isArray(items)) items = [];
        for (const it of items) {
          if (!it || !it.startTime || !it.endTime) continue;
          const itDate = it.date || (it.startDate && new Date(it.startDate).toISOString().slice(0, 10));
          if (itDate && itDate !== date) continue;
          const s = toMin(it.startTime);
          const e = toMin(it.endTime);
          if (s < reqEnd && e > reqStart) {
            if (it.type === 'MAINTENANCE') bestStatus = 'UNAVAILABLE';
            else if (it.type === 'EVENT' || it.status === 'BOOKED' || it.status === 'CONSUMED') {
              if (bestStatus !== 'UNAVAILABLE') bestStatus = 'BOOKED';
            } else if (it.type === 'RESERVATION' || it.status === 'HELD' || it.status === 'RESERVED') {
              const expired = it.status === 'EXPIRED' || (it.expiresAt && new Date(it.expiresAt).getTime() < Date.now());
              if (expired) continue;
              if (bestStatus === 'AVAILABLE') bestStatus = 'HELD';
            } else if (it.type === 'HOLD') {
              const expired = it.status === 'EXPIRED' || (it.expiresAt && new Date(it.expiresAt).getTime() < Date.now());
              if (expired) continue;
              if (bestStatus === 'AVAILABLE') bestStatus = 'HELD';
            }
            if (e > reqStart && (earliestEnd == null || e < earliestEnd)) earliestEnd = e;
          }
        }
        let earliestAvailable = null;
        if (bestStatus !== 'AVAILABLE' && earliestEnd != null && Number.isFinite(earliestEnd)) {
          const hh = Math.floor(earliestEnd / 60);
          const mm = earliestEnd % 60;
          const iso = `${date}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`;
          const ts = new Date(iso).getTime();
          if (!Number.isNaN(ts)) earliestAvailable = ts;
        }
        return { slotStatus: bestStatus, earliestAvailable };
      };

      // Fire ALL venue calendar lookups concurrently instead of sequentially
      const calResults = await Promise.all(
        allVenues.map(async (v) => {
          const venueId = v.id || v.venueId || v.venue_id;
          try {
            // 3.5s timeout per venue so one slow venue doesn't hang everything
            let cal = null;
            try {
              const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3500));
              const res = await Promise.race([
                venueApi.getCalendar(venueId, date, date),
                timeout
              ]);
              if (res && res.success) cal = res.data || [];
            } catch (_e) { /* try fallback */ }

            if (cal && Array.isArray(cal)) {
              return { venue: v, items: cal };
            }

            // Fallback 1 — slot-status endpoint (return shape: success:true, status, available at ROOT, not .data)
            try {
              const slot = await venueApi.getSlotStatus(venueId, { date, startTime, endTime });
              if (slot && slot.success) {
                const status = slot.status || slot.data?.status || 'UNAVAILABLE';
                const available = (slot.available === true) || (slot.data && slot.data.available === true) || status === 'AVAILABLE';
                return {
                  venue: v,
                  override: {
                    slotStatus: status,
                    available: available,
                    earliestAvailable: slot.earliestAvailable || slot.data?.earliestAvailable || null
                  }
                };
              }
            } catch (_e) { /* ignore */ }

            // Final fallback: assume available (legacy backends don't expose calendar endpoint)
            return { venue: v, items: [] };
          } catch (_uncaught) {
            return { venue: v, items: [] };
          }
        })
      );

      const enriched = calResults.map(({ venue, items, override }) => {
        let slotInfo;
        if (override) slotInfo = override;
        else {
          const computed = timeConflictStatus(items);
          slotInfo = {
            slotStatus: computed.slotStatus,
            available: computed.slotStatus === 'AVAILABLE',
            earliestAvailable: computed.earliestAvailable
          };
        }
        return {
          ...venue,
          slotStatus: slotInfo.slotStatus,
          available: slotInfo.available,
          earliestAvailable: slotInfo.earliestAvailable,
          isAvailable: slotInfo.available
        };
      });

      setVenues(enriched);
    } catch (err) {
      // Never set modal-level error banner for availability lookups — venues
      // will just render as "Unavailable". The user can still see the list.
      // eslint-disable-next-line no-console
      console.warn('[VenueSelectionModal] Search availability failed:', err && err.message ? err.message : err);
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
          return await venueApi.reserveVenue({
            venueId,
            date,
            startTime,
            endTime
          });
        } catch (legacyErr) {
          return { success: false, message: legacyErr?.message || 'Legacy reserve failed.' };
        }
      };

      try {
        holdResult = await venueApi.holdVenue(venueId, { date, startTime, endTime });
      } catch (holdErr) {
        // Network-level failure (not handled by handleResponse), try legacy
        holdResult = await legacyFallback();
      }

      // If enterprise endpoint returned non-JSON / 404 (handleResponse returns success:false)
      // also try the legacy reserve endpoint since it has existed since before recent changes.
      if (!holdResult || !holdResult.success) {
        const reason = String(holdResult?.message || '').toLowerCase();
        const needsFallback = !holdResult
          || /404|not found|endpoint/i.test(reason)
          || /responded with status instead of json/i.test(reason)
          || /non-json/i.test(reason);
        if (needsFallback) {
          holdResult = await legacyFallback();
        }
      }

      if (holdResult && holdResult.success) {
        const payload = holdResult.reservation || holdResult.data || {};
        const holdReservation = {
          reservationId: payload.reservationId,
          expiresAt: payload.expiresAt,
          holdDurationMinutes: payload.holdDurationMinutes || null,
          date,
          startTime,
          endTime
        };
        if (!holdReservation.reservationId || !holdReservation.expiresAt) {
          throw new Error(holdResult.message || 'Server did not return a valid venue hold. Please refresh and try again.');
        }
        setReservationSuccess({
          venue,
          reservation: holdReservation
        });
        sessionStorage.setItem('currentVenueHold', JSON.stringify({
          venue,
          reservation: holdReservation
        }));

        setTimeout(() => {
          onClose();
          navigate('/create-event', {
            state: {
              reservation: holdReservation,
              venue,
              date,
              startTime,
              endTime
            }
          });
        }, 3000);
      } else {
        const code = holdResult?.code || '';
        const isConflict = code && (code.includes('CONFLICT') || (code === 'VALIDATION' && /reserved|overlap|slot/i.test(holdResult.message || ''))) || /reserved|conflict|already booked|unavailable|overlap|maintenance/i.test(holdResult?.message || '');
        const earliest = holdResult?.earliestAvailable || holdResult?.data?.earliestAvailable;
        const suffix = earliest ? ` Available after ${new Date(earliest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : '';
        const msg = holdResult?.message || 'This venue was just reserved by another user. Please choose another venue.';
        if (isConflict) {
          setVenues(prev => prev.map(v => (v.id || v.venueId || v.venue_id) === venueId ? { ...v, isAvailable: false, slotStatus: 'HELD', earliestAvailable: earliest || v.earliestAvailable } : v));
        }
        setError(msg + suffix);
        // eslint-disable-next-line no-console
        console.warn('[VenueSelectionModal] Hold failed:', { venueId, holdResult, date, startTime, endTime });
      }
    } catch (err) {
      setError(err.message || 'Failed to reserve venue. Please try again.');
      // eslint-disable-next-line no-console
      console.warn('[VenueSelectionModal] Hold error:', err, { venueId: venue.id, date, startTime, endTime });
    } finally {
      setReservingId(null);
    }
  };

  if (!isOpen) return null;

  // Filter logic
  const filteredVenues = venues.filter(v => {
    if (typeFilter !== 'ALL' && v.type !== typeFilter) return false;
    if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Select Venue</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
              <span className={`font-medium ${step === 1 ? 'text-cse-primary' : 'text-slate-400'}`}>1. Date & Time</span>
              <ChevronRight size={14} className="text-slate-300" />
              <span className={`font-medium ${step === 2 ? 'text-cse-primary' : 'text-slate-400'}`}>2. Available Venues</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div ref={contentRef} className="p-6 overflow-y-auto flex-1 bg-white">
          
          {error && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* STEP 1: DATE & TIME */}
          {step === 1 && (
            <div className="max-w-md mx-auto space-y-6 py-8">
              <div className="text-center mb-8">
                <CalendarIcon className="w-12 h-12 text-cse-primary/50 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800">When is your event?</h3>
                <p className="text-slate-500 text-sm mt-2">Select the date and time to find available venues.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Event Date</label>
                  <PremiumDatePicker value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)}
                    className="w-full min-h-[50px] rounded-xl border-slate-200 px-4 py-3 shadow-sm focus:ring-cse-primary/20" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                    <TimePicker id="venue-start-time" value={startTime} onChange={e => setStartTime(e.target.value)}
                      className="w-full min-h-[50px] rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus:ring-2 focus:ring-cse-primary/20" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                    <TimePicker id="venue-end-time" value={endTime} onChange={e => setEndTime(e.target.value)}
                      className="w-full min-h-[50px] rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus:ring-2 focus:ring-cse-primary/20" />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleSearchAvailable}
                className="w-full py-3.5 bg-cse-primary hover:bg-cse-hover text-white rounded-xl font-semibold shadow-md flex items-center justify-center gap-2 transition-all mt-8"
              >
                <Search size={18} />
                Search Available Venues
              </button>
            </div>
          )}

          {/* STEP 2: VENUE SEARCH */}
          {step === 2 && !reservationSuccess && (
            <div className="space-y-6">
              
              {/* Selected Time Ribbon */}
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-slate-700">
                    <CalendarIcon size={16} className="text-cse-primary" />
                    <span className="font-medium">{new Date(date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock size={16} className="text-cse-primary" />
                    <span className="font-medium">{startTime} - {endTime}</span>
                  </div>
                </div>
                <button onClick={() => setStep(1)} className="text-sm font-semibold text-cse-primary hover:underline">
                  Change Time
                </button>
              </div>

              {/* Filters */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Search by venue name..." 
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cse-primary/20 outline-none text-sm"
                  />
                </div>
                <select 
                  value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none"
                >
                  <option value="ALL">All Types</option>
                  <option value="Seminar Hall">Seminar Hall</option>
                  <option value="Auditorium">Auditorium</option>
                  <option value="Lab">Lab</option>
                </select>
              </div>

              {/* Venue Grid */}
              {loading ? (
                <div className="flex justify-center p-12">
                  <div className="w-8 h-8 border-4 border-cse-primary/30 border-t-cse-primary rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Status Legend */}
                  <div className="flex flex-wrap gap-2 mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full flex items-center gap-1">
                      <CheckCircle size={12} /> Available
                    </span>
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-full flex items-center gap-1">
                      <Activity size={12} /> Held (Draft)
                    </span>
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-[11px] font-bold rounded-full flex items-center gap-1">
                      <AlertCircle size={12} /> Booked Event
                    </span>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-full">
                      Unavailable / Expired
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredVenues.map(venue => {
                      const status = venue.slotStatus || (venue.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE');
                      const earliest = venue.earliestAvailable
                        ? new Date(venue.earliestAvailable).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : null;

                      let badgeBg = 'bg-slate-100';
                      let badgeText = 'text-slate-600';
                      let badgeIcon = <AlertCircle size={12} />;
                      let badgeLabel = 'Unavailable';
                      let cardDim = true;
                      let cardHover = '';

                      switch (status) {
                        case 'AVAILABLE':
                          badgeBg = 'bg-emerald-50';
                          badgeText = 'text-emerald-700';
                          badgeIcon = <CheckCircle size={12} />;
                          badgeLabel = 'Available';
                          cardDim = false;
                          cardHover = 'hover:border-emerald-400 hover:shadow-md';
                          break;
                        case 'HELD':
                          badgeBg = 'bg-amber-50';
                          badgeText = 'text-amber-700';
                          badgeIcon = <Activity size={12} className="animate-pulse" />;
                          badgeLabel = 'Draft Hold';
                          break;
                        case 'BOOKED':
                          badgeBg = 'bg-rose-50';
                          badgeText = 'text-rose-700';
                          badgeIcon = <AlertCircle size={12} />;
                          badgeLabel = 'Booked';
                          break;
                        case 'EXPIRED':
                          badgeBg = 'bg-slate-100';
                          badgeText = 'text-slate-600';
                          badgeLabel = 'Expired Hold';
                          break;
                        default:
                          badgeBg = 'bg-slate-100';
                          badgeText = 'text-slate-600';
                          badgeLabel = 'Unavailable';
                      }

                      return (
                        <div key={venue.id} className={`border rounded-2xl p-5 flex flex-col gap-4 transition-all ${cardDim ? 'bg-slate-50 border-slate-200 opacity-75' : `bg-white border-slate-200 ${cardHover}`}`}>
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-slate-900 text-lg truncate">{venue.name}</h4>
                              <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                                <MapPin size={14} />
                                <span className="truncate">{venue.building} - Floor {venue.floor}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className={`px-2.5 py-1 ${badgeBg} ${badgeText} text-xs font-bold rounded-full flex items-center gap-1 ${status === 'HELD' ? 'animate-pulse' : ''}`} title={earliest ? `Available after ${earliest}` : ''}>
                                {badgeIcon} {badgeLabel}
                              </span>
                              {earliest && status !== 'AVAILABLE' && (
                                <span className="text-[11px] font-semibold text-slate-500">
                                  Free after {earliest}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 mt-auto">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg flex items-center gap-1.5">
                              <Users size={12} /> {venue.capacity} Capacity
                            </span>
                            {venue.facilities?.slice(0, 2).map((fac, i) => (
                              <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">
                                {fac}
                              </span>
                            ))}
                          </div>

                          <button 
                            disabled={!venue.isAvailable || reservingId === venue.id}
                            onClick={() => handleReserve(venue)}
                            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                              !venue.isAvailable 
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                            }`}
                          >
                            {reservingId === venue.id ? (
                              <><Activity size={16} className="animate-spin" /> Holding Slot...</>
                            ) : (
                              !venue.isAvailable ? (
                                status === 'HELD' ? 'Held By Another' : status === 'BOOKED' ? 'Booked' : 'Unavailable'
                              ) : 'Hold & Create Event'
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP 3: SUCCESS (Auto-redirects) */}
          {reservationSuccess && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Venue Reserved Successfully</h3>
              
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 w-full max-w-sm mt-6">
                <div className="text-sm font-medium text-slate-500 mb-1">Venue</div>
                <div className="text-lg font-bold text-slate-800">{reservationSuccess.venue.name}</div>
                
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <div className="text-sm font-medium text-slate-500 mb-2">Reservation Expires In</div>
                  <div className="text-3xl font-black text-rose-500 font-mono tracking-wider">
                    59:59
                  </div>
                  <div className="text-xs text-slate-400 mt-2">Redirecting to event creation...</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default VenueSelectionModal;
