import { fetchEvents } from '../services/firebaseService';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Loader2, CheckCircle, XCircle, Download, UserPlus, UserMinus, FileCheck, Clock, Users, MessageSquare, X, Star, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../context/AppContext';
import { EventStatus, UserRole } from '../types';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';
import ODLetterModal from '../components/ODLetterModal';
import FeedbackModal from '../components/FeedbackModal';
import defaultPoster from '../assets/sece.avif';

// ── Compact IQAC Summary Modal ────────────────────────────────────────────────
const IQACSummaryModal = ({ event, onClose }) => {
  if (!event) return null;
  const s1 = event.requisition?.step1;
  const iqac = event.iqacSubmission || {};
  const reg  = iqac.registration || iqac.registrationDetails || {};
  const checklist = Array.isArray(iqac.checklist) ? iqac.checklist : [];
  const feedback  = iqac.guestFeedbackList || [];
  const gallery   = iqac.gallery || [];
  const feedback3 = feedback.slice(0, 3);

  const totalRegistered = (Number(reg.studentsCount) || 0) + (Number(reg.facultyCount) || 0) + (Number(reg.externalCount) || 0);
  const totalAttended   = (Number(reg.studentsAttended) || 0) + (Number(reg.facultyAttended) || 0) + (Number(reg.externalAttended) || 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList size={18} className="text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">IQAC Report</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{event.title || s1?.eventName || 'Event'}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {s1?.eventStartDate} — {s1?.eventEndDate} &bull; {event.venue || 'Venue not specified'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors mt-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Attendance Summary */}
          {totalRegistered > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Users size={15} className="text-cse-accent" /> Attendance Summary
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Registered', value: totalRegistered, color: 'text-blue-700 bg-blue-50' },
                  { label: 'Attended', value: totalAttended, color: 'text-emerald-700 bg-emerald-50' },
                  { label: 'No-Show', value: Math.max(totalRegistered - totalAttended, 0), color: 'text-amber-700 bg-amber-50' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-xl px-3 py-3 text-center ${color}`}>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs font-semibold mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {reg.studentsCount > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <span>Students: {reg.studentsAttended}/{reg.studentsCount}</span>
                  <span>Faculty: {reg.facultyAttended || 0}/{reg.facultyCount || 0}</span>
                  <span>External: {reg.externalAttended || 0}/{reg.externalCount || 0}</span>
                </div>
              )}
            </section>
          )}

          {/* Gallery Preview */}
          {gallery.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">📷 Event Gallery</h3>
              <div className="grid grid-cols-3 gap-2">
                {gallery.slice(0, 6).map((img, i) => (
                  <div key={i} className="rounded-lg overflow-hidden aspect-square bg-slate-100">
                    <img src={img.dataUrl} alt={img.title || `Photo ${i+1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              {gallery.length > 6 && (
                <p className="text-xs text-slate-400 mt-2">+{gallery.length - 6} more photos</p>
              )}
            </section>
          )}

          {/* Guest Feedback */}
          {feedback3.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Star size={14} className="text-amber-500" /> Guest Feedback
              </h3>
              <div className="space-y-3">
                {feedback3.map((fb, i) => (
                  <div key={i} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">{fb.name}</p>
                      <span className="text-xs text-amber-600 font-semibold">{'★'.repeat(fb.rating || 5)}</span>
                    </div>
                    {fb.designation && <p className="text-xs text-slate-500">{fb.designation}{fb.organization ? ` · ${fb.organization}` : ''}</p>}
                    {fb.feedback && <p className="text-xs text-slate-700 mt-1 italic">"{fb.feedback}"</p>}
                  </div>
                ))}
                {feedback.length > 3 && (
                  <p className="text-xs text-slate-400">+{feedback.length - 3} more feedback entries</p>
                )}
              </div>
            </section>
          )}

          {/* Document Checklist */}
          {checklist.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <FileCheck size={14} className="text-emerald-600" /> Documentation Checklist
              </h3>
              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs">
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                      item.status === 'verified' ? 'bg-emerald-100 text-emerald-600' :
                      item.status === 'autoGenerated' ? 'bg-slate-100 text-slate-500' :
                      item.status === 'uploaded' ? 'bg-blue-100 text-blue-600' :
                      'bg-red-50 text-red-400'
                    }`}>
                      {item.status === 'pending' ? '✗' : '✓'}
                    </span>
                    <span className="text-slate-700">{item.requirement}</span>
                    <span className={`ml-auto font-semibold ${
                      item.status === 'verified' ? 'text-emerald-600' :
                      item.status === 'autoGenerated' ? 'text-slate-400' :
                      item.status === 'uploaded' ? 'text-blue-600' :
                      'text-red-400'
                    }`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Submission timestamp */}
          {event.iqacSubmittedAt && (
            <p className="text-xs text-slate-400 text-center">
              IQAC submitted on {new Date(event.iqacSubmittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ── EventCard — module-level so React never sees a new component type on re-renders ──
const EventCard = ({
  event, currentUser, odRequests, processingEventId,
  getEventStatus, isRegistered, canDownloadOD, canSubmitFeedback,
  onRegister, onWithdraw, onDownloadOD, onOpenFeedback, onOpenIQAC,
  defaultPoster,
}) => {
  const status = getEventStatus(event);
  const registered = isRegistered(event);
  const processing = processingEventId === event.id;
  const isStudent = currentUser?.role === UserRole.STUDENT_GENERAL || currentUser?.role === UserRole.STUDENT_ORGANIZER;
  const canWithdraw = registered && status === 'upcoming';
  const showOD = canDownloadOD(event);
  const showFeedback = canSubmitFeedback(event);
  const showIQAC = status === 'completed' && (event.iqacSubmittedAt || event.iqacSubmission);
  const odReq = odRequests.find(r => r.eventId === event.id && r.studentId === currentUser?.id && r.status !== 'WITHDRAWN');
  const requestStatus = odReq ? odReq.status : null;

  return (
    <div
      onClick={() => showIQAC && onOpenIQAC(event)}
      className={`bg-white rounded-xl shadow-md overflow-hidden transition-shadow duration-200 ${showIQAC ? 'hover:shadow-xl cursor-pointer' : 'cursor-default'}`}
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
            status === 'ongoing'  ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {status.toUpperCase()}
          </span>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar size={14} />
            <span className="text-xs">{event.requisition?.step1?.eventStartDate} to {event.requisition?.step1?.eventEndDate}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock size={14} />
            <span className="text-xs">{event.requisition?.step1?.eventStartTime} - {event.requisition?.step1?.eventEndTime}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MapPin size={14} />
            <span className="text-xs">{event.venue || 'Venue TBA'}</span>
          </div>
        </div>

        {event.requisition?.step1?.eventDescription && (
          <p className="text-xs text-slate-600 mb-4 line-clamp-2">{event.requisition.step1.eventDescription}</p>
        )}

        {showIQAC && (
          <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 text-xs font-semibold">
              <FileCheck size={14} /><span>IQAC Submitted</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* Register button — only for upcoming events */}
          {isStudent && !registered && status === 'upcoming' && (
            <button onClick={(e) => { e.stopPropagation(); onRegister(event.id); }} disabled={processing}
              className="flex items-center gap-1.5 px-3 py-2 bg-cse-accent text-white rounded-lg hover:bg-cse-accent/90 disabled:opacity-50 text-xs font-medium">
              {processing ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Register
            </button>
          )}
          {/* Withdraw — only for upcoming events */}
          {isStudent && registered && canWithdraw && status !== 'completed' && (
            <button onClick={(e) => { e.stopPropagation(); onWithdraw(event.id); }} disabled={processing}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-xs font-medium">
              {processing ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />} Withdraw
            </button>
          )}
          {/* Registration status badges — hidden on completed events */}
          {isStudent && registered && status !== 'completed' && requestStatus === 'APPROVED' && (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
              <CheckCircle size={14} /> Registered (Approved)
            </span>
          )}
          {isStudent && registered && status !== 'completed' && requestStatus === 'PENDING_ORGANIZER' && (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium">
              <Clock size={14} /> Pending Approval
            </span>
          )}
          {isStudent && registered && status !== 'completed' && requestStatus === 'REJECTED' && (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
              <XCircle size={14} /> Registration Rejected
            </span>
          )}
          {isStudent && registered && status !== 'completed' && !requestStatus && (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
              <CheckCircle size={14} /> Registered
            </span>
          )}
          {/* OD Letter — hidden on completed events */}
          {showOD && status !== 'completed' && (
            <button onClick={(e) => { e.stopPropagation(); onDownloadOD(event); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs font-medium">
              <Download size={14} /> OD Letter
            </button>
          )}
          {/* Feedback — shown only on completed events for eligible registered students */}
          {showFeedback && (
            <button onClick={(e) => { e.stopPropagation(); onOpenFeedback(event); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-xs font-medium">
              <MessageSquare size={14} /> Feedback
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const ExploreEvents = () => {
  const { currentUser, odRequests = [] } = useAppContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showODModal, setShowODModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [processingEventId, setProcessingEventId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const allEvents = await fetchEvents();
      // Show both POSTED and COMPLETED events in the explore page
      const visibleEvents = allEvents.filter(
        e => e.status === EventStatus.POSTED || e.status === EventStatus.COMPLETED
      );
      setEvents(visibleEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      if (!silent) setLoading(false);
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

    // Build the registration entry we'll add locally
    const newEntry = {
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email || '',
      userDepartment: currentUser.department || '',
      userYear: currentUser.year || '',
      rollNo: currentUser.rollNo || currentUser.password || '',
      userClass: currentUser.class || currentUser.className || '',
      registeredAt: new Date().toISOString(),
    };

    // Optimistic update — add student to local state immediately (no blink)
    setEvents(prev => prev.map(ev =>
      ev.id === eventId
        ? { ...ev, registeredStudents: [...(ev.registeredStudents || []), newEntry] }
        : ev
    ));

    try {
      // 1. Create OD Request
      await fetch(`http://localhost:5001/api/od-requests`, {
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

      // 2. Persist registration to Firestore
      const response = await fetch(`http://localhost:5001/api/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry),
      });

      // 409 = already registered in Firestore — optimistic state is already correct, carry on
      if (!response.ok && response.status !== 409) {
        // Roll back optimistic update on unexpected failure
        setEvents(prev => prev.map(ev =>
          ev.id === eventId
            ? { ...ev, registeredStudents: (ev.registeredStudents || []).filter(s => s.userId !== currentUser.id) }
            : ev
        ));
      }
    } catch (error) {
      console.error('Error registering:', error);
      // Roll back on network failure
      setEvents(prev => prev.map(ev =>
        ev.id === eventId
          ? { ...ev, registeredStudents: (ev.registeredStudents || []).filter(s => s.userId !== currentUser.id) }
          : ev
      ));
    } finally {
      setProcessingEventId(null);
    }
  };

  const handleWithdraw = async (eventId) => {
    if (!currentUser) return;
    setProcessingEventId(eventId);

    // Optimistic update — remove student from local state immediately (no blink)
    setEvents(prev => prev.map(ev =>
      ev.id === eventId
        ? { ...ev, registeredStudents: (ev.registeredStudents || []).filter(s => s.userId !== currentUser.id) }
        : ev
    ));

    try {
      // Withdraw OD request if one exists
      const odReq = odRequests.find(r => r.eventId === eventId && r.studentId === currentUser.id && r.status !== 'WITHDRAWN');
      if (odReq) {
        await fetch(`http://localhost:5001/api/od-requests/${odReq.id}/withdraw`, { method: 'PATCH' });
      }

      await fetch(`http://localhost:5001/api/events/${eventId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
    } catch (error) {
      console.error('Error withdrawing:', error);
      // Roll back optimistic update on failure
      loadEvents(true);
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
    const twentyFourHoursBefore = start - (24 * 60 * 60 * 1000); 
    return Date.now() >= twentyFourHoursBefore;
  };

  const canSubmitFeedback = (event) => {
    if (!isRegistered(event)) return false;
    
    // Check if the student's OD Request is approved (verifies participation)
    const odReq = odRequests.find(r => r.eventId === event.id && r.studentId === currentUser?.id);
    if (!odReq || odReq.status !== 'APPROVED') return false;

    // Block if feedback already submitted
    if (odReq.feedback) return false;

    const endDate = event.requisition?.step1?.eventEndDate;
    const endTime = event.requisition?.step1?.eventEndTime || '23:59';
    if (!endDate) return false;
    
    const end = new Date(`${endDate}T${endTime}`).getTime();
    const now = Date.now();
    const sevenDaysAfter = end + (7 * 24 * 60 * 60 * 1000); // 7 days after event ends
    
    return now >= end && now <= sevenDaysAfter;
  };
  // Shared props for the stable module-level EventCard
  const cardSharedProps = {
    currentUser, odRequests, processingEventId,
    getEventStatus, isRegistered, canDownloadOD, canSubmitFeedback,
    onRegister: handleRegister,
    onWithdraw: handleWithdraw,
    onDownloadOD: handleDownloadOD,
    onOpenFeedback: (event) => { setSelectedEvent(event); setShowFeedbackModal(true); },
    onOpenIQAC: (event) => { setSelectedEvent(event); setShowEventDetail(true); },
    defaultPoster,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Explore Events</h1>
          <p className="text-slate-600">Discover and register for upcoming events</p>
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
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} {...cardSharedProps} />
              ))}
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

      {showFeedbackModal && selectedEvent && (() => {
        const odReq = odRequests.find(r => r.eventId === selectedEvent.id && r.studentId === currentUser?.id && r.status === 'APPROVED');
        return odReq ? (
          <FeedbackModal
            odRequestId={odReq.id}
            eventTitle={selectedEvent.title || selectedEvent.requisition?.step1?.eventName || 'Event'}
            onClose={() => {
              setShowFeedbackModal(false);
              setSelectedEvent(null);
            }}
          />
        ) : null;
      })()}

      <AnimatePresence>
        {showEventDetail && selectedEvent && (
          <IQACSummaryModal
            event={selectedEvent}
            onClose={() => {
              setShowEventDetail(false);
              setSelectedEvent(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExploreEvents;
