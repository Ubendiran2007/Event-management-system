import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, Search, MapPin, Users, CheckCircle, AlertCircle, X, ChevronRight, Activity, SlidersHorizontal } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { getAuthToken } from '../utils/api';
import PremiumDatePicker from './PremiumDatePicker';
import TimePicker from './TimePicker';

const VenueSelectionModal = ({ isOpen, onClose, onVenueReserved }) => {
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  
  const [step, setStep] = useState(1); // 1: Date/Time, 2: Venue Search
  
  // Step 1 State
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

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
      setDate('');
      setStartTime('');
      setEndTime('');
      setVenues([]);
      setError('');
      setReservationSuccess(null);
      setReservingId(null);
    }
  }, [isOpen]);

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

    try {
      // In a real implementation, we would query an endpoint like GET /api/venues/available?date=...
      // For this implementation, we will fetch all active venues and rely on the calendar/availability check.
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}/api/venues`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      const data = await res.json();
      
      if (data.success) {
        // Mocking availability check for UI purposes until backend endpoint is explicitly used
        // All active venues are displayed. Real availability will be enforced by the reserve endpoint.
        setVenues(data.data.map(v => ({ ...v, isAvailable: true })));
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (venue) => {
    setReservingId(venue.id);
    setError('');

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001'}/api/venues/reserve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          venueId: venue.id,
          date,
          startTime,
          endTime
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setReservationSuccess({
          venue,
          reservation: data.data
        });
        
        // Wait 3 seconds, then navigate to Create Event
        setTimeout(() => {
          onClose();
          navigate('/create-event', { 
            state: { 
              reservation: data.data,
              venue,
              date,
              startTime,
              endTime
            } 
          });
        }, 3000);
      } else {
        // Graceful failure per user requirement
        setError(`This venue was just reserved by another user. Please choose another venue.`);
        // Mark as unavailable locally
        setVenues(prev => prev.map(v => v.id === venue.id ? { ...v, isAvailable: false } : v));
      }
    } catch (err) {
      setError('Failed to reserve venue. Please try again.');
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
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredVenues.map(venue => (
                    <div key={venue.id} className={`border rounded-2xl p-5 flex flex-col gap-4 transition-all ${!venue.isAvailable ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-cse-primary hover:shadow-md'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-900 text-lg">{venue.name}</h4>
                          <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                            <MapPin size={14} />
                            {venue.building} - Floor {venue.floor}
                          </div>
                        </div>
                        {venue.isAvailable ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1">
                            <CheckCircle size={12} /> Available
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded-full">
                            Unavailable
                          </span>
                        )}
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
                          <><Activity size={16} className="animate-spin" /> Reserving...</>
                        ) : (
                          !venue.isAvailable ? 'Unavailable' : 'Reserve Slot'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
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
