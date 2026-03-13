import { fetchEvents } from '../services/firebaseService';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Loader2, CheckCircle, XCircle, Download, UserPlus, UserMinus, FileCheck, Clock, Users, LayoutDashboard, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { EventStatus, UserRole } from '../types';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';
import ODLetterModal from '../components/ODLetterModal';
import defaultPoster from '../assets/sece.avif';

const ExploreEvents = () => {
  const { currentUser, odRequests = [] } = useAppContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showODModal, setShowODModal] = useState(false);
  const [processingEventId, setProcessingEventId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const allEvents = await fetchEvents();
      // Show both POSTED and COMPLETED events in the explore page
      const visibleEvents = allEvents.filter(
        e => e.status === EventStatus.POSTED || e.status === EventStatus.COMPLETED
      );
      setEvents(visibleEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventStatus = (event) => {
    const now = Date.now();
    const startDate = event.requisition?.step1?.eventStartDate;
    const startTime = event.requisition?.step1?.eventStartTime || '00:00';
    const endDate = event.requisition?.step1?.eventEndDate;
    const endTime = event.requisition?.step1?.eventEndTime || '23:59';

    if (!startDate || !endDate) return 'upcoming';

    const start = new Date(`${startDate}T${startTime}`).getTime();
    const end = new Date(`${endDate}T${endTime}`).getTime();

    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'ongoing';
    return 'completed';
  };

  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => getEventStatus(e) === filter);
  }, [events, filter]);

  const isRegistered = (event) => {
    return event.registeredStudents?.some(s => s.userId === currentUser?.id);
  };

  const handleRegister = async (eventId) => {
    if (!currentUser) return;
    setProcessingEventId(eventId);
    try {
      // 1. Create OD Request (binds to Dashboard Registrations tab)
      const odResponse = await fetch(`http://localhost:5001/api/od-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          studentId: currentUser.id,
          studentName: currentUser.name,
          rollNo: currentUser.rollNo || currentUser.password || '',
          class: currentUser.class || currentUser.className || '',
          email: currentUser.email,
          registrationType: 'PARTICIPANT'
        }),
      });

      const odData = await odResponse.json();
      if (!odResponse.ok && odData.message === 'Already registered for this event') {
         // Do nothing, likely already registered
      }

      // 2. Add to event registered list
      const response = await fetch(`http://localhost:5001/api/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          userDepartment: currentUser.department,
          userYear: currentUser.year,
          rollNo: currentUser.rollNo || currentUser.password || '',
          userClass: currentUser.class || currentUser.className || '',
        }),
      });
      const data = await response.json();
      if (data.success) {
        await loadEvents();
      }
    } catch (error) {
      console.error('Error registering:', error);
    } finally {
      setProcessingEventId(null);
    }
  };

  const handleWithdraw = async (eventId) => {
    if (!currentUser) return;
    setProcessingEventId(eventId);
    try {
      // Find the associated OD request
      const odReq = odRequests.find(r => r.eventId === eventId && r.studentId === currentUser.id && r.status !== 'WITHDRAWN');
      if (odReq) {
        await fetch(`http://localhost:5001/api/od-requests/${odReq.id}/withdraw`, {
          method: 'PATCH',
        });
      }

      const response = await fetch(`http://localhost:5001/api/events/${eventId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await response.json();
      if (data.success) {
        await loadEvents();
      }
    } catch (error) {
      console.error('Error withdrawing:', error);
    } finally {
      setProcessingEventId(null);
    }
  };

  const handleDownloadOD = (event) => {
    setSelectedEvent(event);
    setShowODModal(true);
  };

  const canDownloadOD = (event) => {
    if (!isRegistered(event)) return false;
    // Check if there is an APPROVED OD Request
    const odReq = odRequests.find(r => r.eventId === event.id && r.studentId === currentUser?.id);
    if (!odReq || odReq.status !== 'APPROVED') return false;

    const startDate = event.requisition?.step1?.eventStartDate;
    const startTime = event.requisition?.step1?.eventStartTime || '00:00';
    if (!startDate) return false;
    const start = new Date(`${startDate}T${startTime}`).getTime();
    const oneHourBefore = start - (60 * 60 * 1000);
    return Date.now() >= oneHourBefore;
  };

  const canSubmitFeedback = (event) => {
    if (!isRegistered(event)) return false;
    const endDate = event.requisition?.step1?.eventEndDate;
    const endTime = event.requisition?.step1?.eventEndTime || '23:59';
    if (!endDate) return false;
    const end = new Date(`${endDate}T${endTime}`).getTime();
    const now = Date.now();
    const twentyFourHoursAfter = end + (24 * 60 * 60 * 1000);
    return now >= end && now <= twentyFourHoursAfter;
  };

  const EventCard = ({ event }) => {
    const status = getEventStatus(event);
    const registered = isRegistered(event);
    const processing = processingEventId === event.id;
    const isStudent = currentUser?.role === UserRole.STUDENT_GENERAL || currentUser?.role === UserRole.STUDENT_ORGANIZER;
    const canWithdraw = registered && status === 'upcoming';
    const showOD = canDownloadOD(event);
    const showFeedback = canSubmitFeedback(event);
    const showIQAC = status === 'completed' && (event.iqacSubmittedAt || event.iqacSubmission);
    
    // Get the student's OD request status (if any)
    const odReq = odRequests.find(r => r.eventId === event.id && r.studentId === currentUser?.id && r.status !== 'WITHDRAWN');
    const requestStatus = odReq ? odReq.status : null;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all"
      >
        <div className="h-48 overflow-hidden">
          <img
            src={event.posterDataUrl || event.posterUrl || defaultPoster}
            alt={event.title || event.requisition?.step1?.eventName || 'Event'}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-900 line-clamp-2 flex-1">
              {event.title || event.requisition?.step1?.eventName || 'Untitled Event'}
            </h3>
            <span className={`ml-2 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
              status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
              status === 'ongoing' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {status.toUpperCase()}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar size={14} />
              <span className="text-xs">
                {event.requisition?.step1?.eventStartDate} to {event.requisition?.step1?.eventEndDate}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock size={14} />
              <span className="text-xs">
                {event.requisition?.step1?.eventStartTime} - {event.requisition?.step1?.eventEndTime}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin size={14} />
              <span className="text-xs">{event.venue || 'Venue TBA'}</span>
            </div>
          </div>

          {event.requisition?.step1?.eventDescription && (
            <p className="text-xs text-slate-600 mb-4 line-clamp-2">
              {event.requisition.step1.eventDescription}
            </p>
          )}

          {showIQAC && (
            <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 text-xs font-semibold">
                <FileCheck size={14} />
                <span>IQAC Submitted</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isStudent && !registered && (
              <button
                onClick={() => handleRegister(event.id)}
                disabled={processing}
                className="flex items-center gap-1.5 px-3 py-2 bg-cse-accent text-white rounded-lg hover:bg-cse-accent/90 disabled:opacity-50 text-xs font-medium"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Register
              </button>
            )}

            {isStudent && registered && canWithdraw && (
              <button
                onClick={() => handleWithdraw(event.id)}
                disabled={processing}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-xs font-medium"
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                Withdraw
              </button>
            )}

            {isStudent && registered && requestStatus === 'APPROVED' && (
              <span className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                <CheckCircle size={14} />
                Registered (Approved)
              </span>
            )}

            {isStudent && registered && requestStatus === 'PENDING_ORGANIZER' && (
              <span className="flex items-center gap-1.5 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium">
                <Clock size={14} />
                Pending Approval
              </span>
            )}

            {isStudent && registered && requestStatus === 'REJECTED' && (
              <span className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                <XCircle size={14} />
                Registration Rejected
              </span>
            )}

            {isStudent && registered && !requestStatus && (
              <span className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                <CheckCircle size={14} />
                Registered
              </span>
            )}

            {showOD && (
              <button
                onClick={() => handleDownloadOD(event)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs font-medium"
              >
                <Download size={14} />
                OD Letter
              </button>
            )}

            {showFeedback && (
              <button
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-xs font-medium"
              >
                <MessageSquare size={14} />
                Feedback
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Explore Events</h1>
            <p className="text-slate-600">Discover and register for upcoming events</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-cse-accent text-white rounded-lg hover:bg-cse-accent/90 font-medium"
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
        </div>

        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {['all', 'upcoming', 'ongoing', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-cse-accent text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-2 text-sm opacity-75">
                ({f === 'all' ? events.length : events.filter(e => getEventStatus(e) === f).length})
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={40} className="animate-spin text-cse-accent" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20">
            <XCircle size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No events found</h3>
            <p className="text-slate-500">There are no {filter !== 'all' ? filter : ''} events at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {showODModal && selectedEvent && (
        <ODLetterModal
          odRequest={odRequests.find(r => r.eventId === selectedEvent.id && r.studentId === currentUser?.id && r.status === 'APPROVED')}
          onClose={() => {
            setShowODModal(false);
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
};

export default ExploreEvents;
