import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  CheckCircle,
  Clock,
  Plus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  FileText,
  Loader2,
  XCircle,
  UserCheck
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { UserRole, EventStatus, ODRequestStatus } from '../types';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';
import ODRequestDetailModal from '../components/ODRequestDetailModal';
import EventDetailModal from '../components/EventDetailModal';
import cseDeptImg from '../assets/cse_b.jpg';

const Dashboard = () => {
  const {
    currentUser,
    events,
    odRequests,
    organizerRequests,
    loading,
    handleApproval,
    approveOrganizer,
    setSelectedEvent
  } = useAppContext();
  const navigate = useNavigate();
  const [selectedODRequest, setSelectedODRequest] = useState(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('events');
  const [togglingOD, setTogglingOD] = useState({});
  const [withdrawingOD, setWithdrawingOD] = useState({});
  const [expandedRegistrationGroups, setExpandedRegistrationGroups] = useState({});
  const [bulkApprovingGroups, setBulkApprovingGroups] = useState({});
  const isMedia = currentUser?.role === UserRole.MEDIA;
  const canCreateEvent =
    currentUser?.role === UserRole.FACULTY ||
    (currentUser?.role === UserRole.STUDENT_ORGANIZER && currentUser?.isApprovedOrganizer);

  // Redirect if not logged in
  useEffect(() => {
    if (!currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!selectedEventDetail) return;

    const latestEvent = events.find((event) => event.id === selectedEventDetail.id);
    if (!latestEvent) return;

    // Auto-close the modal when the event is no longer in the current user's action queue.
    // This handles the case where Faculty/HOD/Principal approves or rejects an event and the
    // status advances — the modal should dismiss itself automatically.
    const pendingStatusForRole = {
      [UserRole.FACULTY]: EventStatus.PENDING_FACULTY,
      [UserRole.HOD]: EventStatus.PENDING_HOD,
      [UserRole.PRINCIPAL]: EventStatus.PENDING_PRINCIPAL,
    };
    const expectedPendingStatus = pendingStatusForRole[currentUser?.role];
    if (
      expectedPendingStatus &&
      selectedEventDetail.status === expectedPendingStatus &&
      latestEvent.status !== expectedPendingStatus
    ) {
      // Event just moved out of this approver's queue — close the modal
      setSelectedEventDetail(null);
      return;
    }

    // Otherwise, keep modal open but update it to the latest event data
    if (latestEvent !== selectedEventDetail) {
      setSelectedEventDetail(latestEvent);
    }
  }, [events, selectedEventDetail, currentUser?.role]);

  // Filtered events for the current user's role — must be defined BEFORE any early returns
  // so that hook call order stays consistent across every render.
  const filteredEvents = useMemo(() => {
    if (!currentUser) return [];
    return events.filter(ev => {
      if (currentUser.role === UserRole.STUDENT_ORGANIZER) return ev.organizerId === currentUser.id;
      if (currentUser.role === UserRole.FACULTY) {
        // Faculty sees events pending their approval OR events they created as organizer
        return ev.status === EventStatus.PENDING_FACULTY || ev.organizerId === currentUser.id;
      }
      if (currentUser.role === UserRole.HOD)        return ev.status === EventStatus.PENDING_HOD;
      if (currentUser.role === UserRole.PRINCIPAL)  return ev.status === EventStatus.PENDING_PRINCIPAL;
      if (currentUser.role === UserRole.MEDIA) {
        const posterWorkflowStatus = String(ev.posterWorkflow?.status || '').toUpperCase();
        return ['REQUESTED', 'REWORK_REQUESTED'].includes(posterWorkflowStatus);
      }
      return false;
    });
  }, [currentUser, events]);

  if (!currentUser) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-cse-accent mb-4" size={40} />
          <p className="text-slate-500">Loading data from Firebase...</p>
        </div>
      </div>
    );
  }

  // Is this user a staff member (Faculty / HOD / Principal)?
  const isStaff = [UserRole.FACULTY, UserRole.HOD, UserRole.PRINCIPAL].includes(currentUser.role?.toUpperCase());

  // Filter OD requests for student view only
  const getFilteredODRequests = () => {
    const role = currentUser.role?.toUpperCase();
    if (role === UserRole.STUDENT_GENERAL || role === UserRole.STUDENT_ORGANIZER) {
      return odRequests.filter(r => r.studentId === currentUser.id);
    }
    return [];
  };

  const filteredODRequests = getFilteredODRequests();
  const pendingODCount = filteredODRequests.filter(r => r.status.startsWith('PENDING')).length;

  // For organizer: incoming registrations from students for their events
  const organizerIncomingOD = useMemo(() => (
    (currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY)
      ? odRequests.filter(r => r.organizerId === currentUser.id)
      : []
  ), [currentUser.role, currentUser.id, odRequests]);
  const pendingOrganizerOD = organizerIncomingOD.filter(r => r.status === 'PENDING_ORGANIZER');
  const groupedOrganizerEvents = useMemo(() => {
    const organizerIncomingGroupedByEvent = organizerIncomingOD.reduce((acc, req) => {
      const eventKey = req.eventId || req.eventTitle || 'unknown-event';
      if (!acc[eventKey]) {
        acc[eventKey] = {
          eventId: req.eventId || null,
          eventTitle: req.eventTitle || 'Untitled Event',
          eventDate: req.eventDate || '',
          requests: [],
        };
      }
      acc[eventKey].requests.push(req);
      return acc;
    }, {});

    return Object.values(organizerIncomingGroupedByEvent)
      .sort((a, b) => (a.eventTitle || '').localeCompare(b.eventTitle || ''))
      .map(group => ({
        ...group,
        requests: [...group.requests].sort((a, b) => {
          const aPending = a.status === 'PENDING_ORGANIZER' ? 0 : 1;
          const bPending = b.status === 'PENDING_ORGANIZER' ? 0 : 1;
          if (aPending !== bPending) return aPending - bPending;
          return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        }),
      }));
  }, [organizerIncomingOD]);

  const organizerEventsById = useMemo(() => (
    events.reduce((acc, ev) => {
      acc[ev.id] = ev;
      return acc;
    }, {})
  ), [events]);

  useEffect(() => {
    if (currentUser.role !== UserRole.STUDENT_ORGANIZER) return;

    setExpandedRegistrationGroups((prev) => {
      const next = {};

      groupedOrganizerEvents.forEach((group) => {
        const groupKey = group.eventId || group.eventTitle;
        const pendingCount = group.requests.filter(r => r.status === 'PENDING_ORGANIZER').length;
        if (Object.prototype.hasOwnProperty.call(prev, groupKey)) {
          next[groupKey] = prev[groupKey];
        } else {
          // Default-open groups that need immediate action.
          next[groupKey] = pendingCount > 0;
        }
      });

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => prev[key] === next[key])
      ) {
        return prev;
      }

      return next;
    });
  }, [currentUser.role, groupedOrganizerEvents]);

  const handleOrganizerApproval = async (odId, approve) => {
    setTogglingOD(prev => ({ ...prev, [odId]: true }));
    try {
      await fetch(`http://localhost:5001/api/od-requests/${odId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: approve ? 'APPROVED' : 'REJECTED',
          approvedBy: currentUser.name,
        }),
      });
    } catch (err) {
      console.error('Error updating OD request:', err);
    } finally {
      setTogglingOD(prev => ({ ...prev, [odId]: false }));
    }
  };

  const handleWithdraw = async (odId) => {
    if (!window.confirm('Are you sure you want to withdraw this OD request?')) return;
    setWithdrawingOD(prev => ({ ...prev, [odId]: true }));
    try {
      await fetch(`http://localhost:5001/api/od-requests/${odId}/withdraw`, {
        method: 'PATCH',
      });
    } catch (err) {
      console.error('Error withdrawing OD request:', err);
    } finally {
      setWithdrawingOD(prev => ({ ...prev, [odId]: false }));
    }
  };

  const handleBulkOrganizerApproval = async (requests, bulkKey) => {
    const pendingRequests = requests.filter((r) => r.status === 'PENDING_ORGANIZER');
    if (pendingRequests.length <= 1) return;

    setBulkApprovingGroups((prev) => ({ ...prev, [bulkKey]: true }));

    try {
      const results = await Promise.allSettled(
        pendingRequests.map((req) =>
          fetch(`http://localhost:5001/api/od-requests/${req.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'APPROVED',
              approvedBy: currentUser.name,
            }),
          }).then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to approve request ${req.id}`);
            }
            return response;
          })
        )
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        window.alert(`Approved ${pendingRequests.length - failed} registrations. ${failed} failed, please retry.`);
      }
    } catch (err) {
      console.error('Bulk approval error:', err);
    } finally {
      setBulkApprovingGroups((prev) => ({ ...prev, [bulkKey]: false }));
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Department Dashboard</h2>
            <p className="text-slate-500 mt-1">
              Welcome back, {currentUser.name}. Manage your events and approvals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/explore')} className="btn-secondary flex items-center gap-2">
              <Calendar size={18} /> Explore Events
            </button>
            {canCreateEvent && (
              <button onClick={() => navigate('/create-event')} className="btn-primary flex items-center gap-2">
                <Plus size={18} /> Create Event
              </button>
            )}
            {/* Manage Students button for staff */}
            {isStaff && (
              <button
                onClick={() => navigate('/manage-students')}
                className="btn-primary flex items-center gap-2"
              >
                <Users size={18} /> Manage Students
              </button>
            )}
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Grid */}
            <div className={`grid grid-cols-2 gap-4 ${(isStaff || isMedia) ? 'sm:grid-cols-4' : 'sm:grid-cols-5'}`}>
              {(() => {
                const baseEvents = (currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY)
                  ? events.filter(e => e.organizerId === currentUser.id)
                  : events;

                return [
                {
                  label: 'Total Events',
                  // For organizers/faculty: show their own events only; for HOD/Principal/Media: show all
                  value: baseEvents.length,
                  icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50'
                },
                {
                  label: isStaff ? (currentUser.role === UserRole.FACULTY ? 'Pending Review' : 'My Queue') : isMedia ? 'Poster Queue' : 'Pending',
                  value: (isStaff || isMedia)
                    ? (currentUser.role === UserRole.FACULTY
                        ? filteredEvents.filter(e => e.status === EventStatus.PENDING_FACULTY).length
                        : filteredEvents.length)
                    : baseEvents.filter(e => e.status?.startsWith('PENDING')).length,
                  icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50'
                },
                { label: 'Posted', value: baseEvents.filter(e => e.status === EventStatus.POSTED || e.status === EventStatus.APPROVED).length, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Completed', value: baseEvents.filter(e => e.status === EventStatus.COMPLETED).length, icon: FileCheck, color: 'text-slate-600', bg: 'bg-slate-100' },
                // Only show Registrations stat for students
                ...((currentUser.role === UserRole.STUDENT_GENERAL || currentUser.role === UserRole.STUDENT_ORGANIZER) ? [{ label: 'Registrations', value: pendingODCount, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' }] : []),
              ].map((stat, i) => (
                <div key={i} className="glass-panel p-4 rounded-2xl">
                  <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
                    <stat.icon size={20} />
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{stat.label}</p>
                </div>
              ));
              })()}
            </div>

            {/* Tabs */}
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4">
                <button
                  onClick={() => setActiveTab('events')}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'events'
                    ? 'bg-cse-accent text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                    }`}
                >
                  {currentUser.role === UserRole.FACULTY ? 'My Events' : isStaff ? 'Pending Approvals' : isMedia ? 'Poster Requests' : 'Events'}
                  {(isStaff || isMedia) && currentUser.role !== UserRole.FACULTY && filteredEvents.length > 0 && (
                    <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${activeTab === 'events' ? 'bg-white text-cse-accent' : 'bg-amber-500 text-white'}`}>
                      {filteredEvents.length}
                    </span>
                  )}
                  {currentUser.role === UserRole.FACULTY && events.filter(e => e.organizerId === currentUser.id).length > 0 && (
                    <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${activeTab === 'events' ? 'bg-white text-cse-accent' : 'bg-amber-500 text-white'}`}>
                      {events.filter(e => e.organizerId === currentUser.id).length}
                    </span>
                  )}
                </button>

                {/* Approvals tab — only for faculty */}
                {currentUser.role === UserRole.FACULTY && (
                  <button
                    onClick={() => setActiveTab('approvals')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'approvals'
                      ? 'bg-cse-accent text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    Approvals
                    {events.filter(e => e.status === EventStatus.PENDING_FACULTY).length > 0 && (
                      <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${activeTab === 'approvals' ? 'bg-white text-cse-accent' : 'bg-amber-500 text-white'
                        }`}>
                        {events.filter(e => e.status === EventStatus.PENDING_FACULTY).length}
                      </span>
                    )}
                  </button>
                )}

                {/* My Registrations tab — for all students (general and organizer) */}
                {(currentUser.role === UserRole.STUDENT_GENERAL || currentUser.role === UserRole.STUDENT_ORGANIZER) && (
                  <button
                    onClick={() => setActiveTab('od')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'od'
                      ? 'bg-cse-accent text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    My Registrations
                    {pendingODCount > 0 && (
                      <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${activeTab === 'od' ? 'bg-white text-cse-accent' : 'bg-purple-500 text-white'
                        }`}>
                        {pendingODCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Manage Registrations tab — for student organizer and faculty to review incoming requests */}
                {(currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY) && (
                  <button
                    onClick={() => setActiveTab('registrations')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${activeTab === 'registrations'
                      ? 'bg-cse-accent text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                      }`}
                  >
                    Manage Registrations
                    {pendingOrganizerOD.length > 0 && (
                      <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${activeTab === 'registrations' ? 'bg-white text-cse-accent' : 'bg-amber-500 text-white'
                        }`}>
                        {pendingOrganizerOD.length}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* Events Tab Content */}
              {(activeTab === 'events' || activeTab === 'approvals') && (() => {
                let displayEvents = [];
                if (activeTab === 'events') {
                  displayEvents = currentUser.role === UserRole.FACULTY ? events.filter(e => e.organizerId === currentUser.id) : filteredEvents;
                } else if (activeTab === 'approvals') {
                  displayEvents = events.filter(e => e.status === EventStatus.PENDING_FACULTY);
                }

                return (
                  <div className="divide-y divide-slate-100">
                    {displayEvents.map(event => (
                      <div 
                        key={event.id} 
                        className="p-6 hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        onClick={() => {
                          setSelectedEventDetail(event);
                        }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-cse-accent group-hover:text-white transition-all">
                              <Calendar size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                {event.title}
                                {event.isResubmitted && (
                                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md text-[10px] uppercase tracking-wider font-bold">
                                    Resubmitted
                                  </span>
                                )}
                              </h4>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <MapPin size={12} /> {event.venue}
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Clock size={12} /> {event.date}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-2">By {event.organizerName}</p>
                              {event.status === EventStatus.REJECTED && event.rejectionReason && (
                                <p className="text-xs text-red-600 mt-1">
                                  Rejection reason: {event.rejectionReason}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusBadge status={event.status} />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEventDetail(event);
                              }}
                              className="text-xs font-semibold text-cse-accent hover:underline flex items-center gap-1"
                            >
                              View Details <ChevronRight size={14} />
                            </button>
                            {(currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY) && event.status === EventStatus.REJECTED && event.organizerId === currentUser.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/create-event', { state: { editingEvent: event } });
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-60"
                              >
                                Edit &amp; Resubmit
                              </button>
                            )}
                            {(currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY) && !event.iqacSubmittedAt && event.organizerId === currentUser.id && (event.status === EventStatus.COMPLETED || event.status === EventStatus.POSTED) && (() => {
                              const eventDate = event.date || event.requisition?.step1?.eventStartDate;
                              const endTime = event.endTime || event.requisition?.step1?.eventEndTime;
                              if (!eventDate || !endTime) return null;
                              const [h, m] = String(endTime).split(':').map(Number);
                              const eventEnd = new Date(eventDate);
                              eventEnd.setHours(h, m, 0, 0);
                              if (Date.now() <= eventEnd.getTime()) return null;
                              
                              // Allow IQAC submission up to 7 days after event ends
                              const sevenDaysAfter = eventEnd.getTime() + (7 * 24 * 60 * 60 * 1000);
                              if (Date.now() > sevenDaysAfter) return null;

                              return (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); navigate('/iqac'); }}
                                  className="btn-secondary text-xs py-1.5"
                                >
                                  Submit IQAC
                                </button>
                              );
                            })()}
                            {(currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY) && event.iqacSubmittedAt && event.organizerId === currentUser.id && (
                              <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                <FileCheck size={12} /> IQAC Submitted
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  {displayEvents.length === 0 && (
                      <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                          <CheckCircle size={32} />
                        </div>
                        <p className="text-slate-500 font-medium">
                          {(isStaff || isMedia)
                            ? 'No events are currently waiting for your approval.'
                            : 'No events found.'}
                        </p>
                        {isStaff && (
                          <p className="text-xs text-slate-400 mt-1">
                            {currentUser.role === UserRole.FACULTY && 'Events submitted by students will appear here.'}
                            {currentUser.role === UserRole.HOD && 'Events approved by Faculty will appear here.'}
                            {currentUser.role === UserRole.PRINCIPAL && 'Events approved by HOD will appear here.'}
                          </p>
                        )}
                        {isMedia && (
                          <p className="text-xs text-slate-400 mt-1">
                            Poster requests with status Requested or Rework Requested will appear here.
                          </p>
                        )}
                      </div>
                    )}
                </div>
                );
              })()}

              {/* Registrations Tab — organizer sees incoming student OD requests */}
              {activeTab === 'registrations' && (currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY) && (
                <div className="divide-y divide-slate-100">
                  {groupedOrganizerEvents.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <Users size={32} />
                      </div>
                      <p className="text-slate-500 font-medium">No student registrations yet.</p>
                    </div>
                  ) : (
                    groupedOrganizerEvents.map(group => {
                      const groupKey = group.eventId || group.eventTitle;
                      const isExpanded = expandedRegistrationGroups[groupKey] ?? false;
                      const pendingCount = group.requests.filter(r => r.status === 'PENDING_ORGANIZER').length;
                      const sourceEvent = group.eventId ? organizerEventsById[group.eventId] : null;
                      const isVolunteerEnabledEvent = Boolean(sourceEvent?.registrationOptions?.allowVolunteer);

                      const renderRequestRow = (req) => {
                        const isToggling = togglingOD[req.id];
                        // Profile Initials
                        const initials = req.studentName ? req.studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ST';
                        
                        return (
                          <div key={req.id} className="p-4 bg-white hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors group">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold text-lg shadow-sm shrink-0 border border-white">
                                  {initials}
                                </div>
                                <div className="flex flex-col justify-center min-h-[48px]">
                                  <p className="font-bold text-slate-800 leading-tight">{req.studentName}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{req.rollNo}</span>
                                    <span className="text-xs text-slate-400 font-medium">{req.class}</span>
                                    {req.registrationType && (
                                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                                        req.registrationType === 'VOLUNTEER' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                      }`}>
                                        {req.registrationType === 'VOLUNTEER' ? 'Volunteer' : 'Participant'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 sm:mt-0 mt-2">
                                {req.status === 'PENDING_ORGANIZER' ? (
                                  <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                      onClick={() => handleOrganizerApproval(req.id, false)}
                                      disabled={isToggling}
                                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 disabled:opacity-50 transition-all shadow-sm"
                                    >
                                      {isToggling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
                                    </button>
                                    <button
                                      onClick={() => handleOrganizerApproval(req.id, true)}
                                      disabled={isToggling}
                                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-emerald-500/20"
                                    >
                                      {isToggling ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />} Approve
                                    </button>
                                  </div>
                                ) : req.status === 'WITHDRAWN' ? (
                                  <span className="px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400 border border-slate-200">
                                    Withdrawn
                                  </span>
                                ) : (
                                  <span className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-sm ${
                                    req.status === 'APPROVED'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}>
                                    {req.status === 'APPROVED' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                    {req.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      };

                      const participantRequests = group.requests.filter(
                        (r) => (r.registrationType || 'PARTICIPANT') !== 'VOLUNTEER'
                      );
                      const volunteerRequests = group.requests.filter(
                        (r) => r.registrationType === 'VOLUNTEER'
                      );
                      const pendingParticipantRequests = participantRequests.filter((r) => r.status === 'PENDING_ORGANIZER');
                      const pendingVolunteerRequests = volunteerRequests.filter((r) => r.status === 'PENDING_ORGANIZER');
                      const pendingAllRequests = group.requests.filter((r) => r.status === 'PENDING_ORGANIZER');

                      return (
                        <div key={group.eventId || group.eventTitle} className="p-5">
                          <button
                            type="button"
                            onClick={() => setExpandedRegistrationGroups(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                            className={`w-full transition-all duration-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left border ${
                              isExpanded 
                                ? 'bg-white border-blue-100 shadow-md shadow-blue-900/5 mb-4' 
                                : 'bg-slate-50 border-slate-100 hover:bg-slate-100/80 mb-2'
                            }`}
                          >
                            <div>
                              <p className={`text-base font-bold ${isExpanded ? 'text-blue-900' : 'text-slate-900'}`}>{group.eventTitle}</p>
                              {group.eventDate && (
                                <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1">
                                  <Calendar size={12} /> {group.eventDate}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 shadow-sm border border-slate-200">
                                {group.requests.length} Requests
                              </span>
                              {pendingCount > 0 && (
                                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm flex items-center gap-1">
                                  <AlertCircle size={12} /> {pendingCount} Pending
                                </span>
                              )}
                              <span className={`p-1.5 rounded-lg transition-transform duration-300 ${isExpanded ? 'bg-blue-100 text-blue-700 rotate-180' : 'bg-slate-200 text-slate-600'}`}>
                                <ChevronDown size={16} />
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                              {isVolunteerEnabledEvent ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  <div className="rounded-2xl border-2 border-slate-100 bg-white/50 backdrop-blur-sm overflow-hidden shadow-sm">
                                    <div className="px-5 py-4 bg-slate-50/80 border-b-2 border-slate-100">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <Users size={16} className="text-slate-500" />
                                          <p className="text-sm font-bold uppercase tracking-wider text-slate-700">Participants ({participantRequests.length})</p>
                                        </div>
                                        {pendingParticipantRequests.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => handleBulkOrganizerApproval(participantRequests, `${groupKey}-participants`)}
                                            disabled={bulkApprovingGroups[`${groupKey}-participants`]}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 shadow-sm"
                                          >
                                            {bulkApprovingGroups[`${groupKey}-participants`] ? 'Approving...' : `Approve All (${pendingParticipantRequests.length})`}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="divide-y divide-slate-100/80">
                                      {participantRequests.length > 0 ? participantRequests.map(renderRequestRow) : (
                                        <div className="p-8 text-center text-sm font-medium text-slate-400">No participant requests.</div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border-2 border-indigo-100 bg-white/50 backdrop-blur-sm overflow-hidden shadow-sm">
                                    <div className="px-5 py-4 bg-indigo-50/80 border-b-2 border-indigo-100">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                          <ShieldCheck size={16} className="text-indigo-500" />
                                          <p className="text-sm font-bold uppercase tracking-wider text-indigo-800">Volunteers ({volunteerRequests.length})</p>
                                        </div>
                                        {pendingVolunteerRequests.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => handleBulkOrganizerApproval(volunteerRequests, `${groupKey}-volunteers`)}
                                            disabled={bulkApprovingGroups[`${groupKey}-volunteers`]}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 shadow-sm"
                                          >
                                            {bulkApprovingGroups[`${groupKey}-volunteers`] ? 'Approving...' : `Approve All (${pendingVolunteerRequests.length})`}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div className="divide-y divide-indigo-50/80">
                                      {volunteerRequests.length > 0 ? volunteerRequests.map(renderRequestRow) : (
                                        <div className="p-8 text-center text-sm font-medium text-slate-400">No volunteer requests.</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="rounded-2xl border-2 border-slate-100 bg-white/50 backdrop-blur-sm overflow-hidden shadow-sm">
                                  <div className="px-5 py-4 bg-slate-50/80 border-b-2 border-slate-100 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Users size={16} className="text-slate-500" />
                                      <p className="text-sm font-bold uppercase tracking-wider text-slate-700">Registrations ({group.requests.length})</p>
                                    </div>
                                    {pendingAllRequests.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleBulkOrganizerApproval(group.requests, `${groupKey}-all`)}
                                        disabled={bulkApprovingGroups[`${groupKey}-all`]}
                                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 shadow-sm shadow-emerald-500/20"
                                      >
                                        {bulkApprovingGroups[`${groupKey}-all`] ? 'Approving...' : `Approve All (${pendingAllRequests.length})`}
                                      </button>
                                    )}
                                  </div>
                                  <div className="divide-y divide-slate-100/80">
                                    {group.requests.map(renderRequestRow)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* My Registrations Tab — for all students */}
              {activeTab === 'od' && (currentUser.role === UserRole.STUDENT_GENERAL || currentUser.role === UserRole.STUDENT_ORGANIZER) && (
                <div className="divide-y divide-slate-100">
                  {filteredODRequests.map(request => (
                    <div
                      key={request.id}
                      onClick={() => setSelectedODRequest(request)}
                      className="p-6 hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-all">
                            <FileText size={24} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{request.studentName}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-slate-500">{request.rollNo}</span>
                              <span className="text-xs text-slate-500">•</span>
                              <span className="text-xs text-slate-500">{request.eventName}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">{request.eventDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            request.status === ODRequestStatus.APPROVED
                              ? 'bg-emerald-50 text-emerald-600'
                              : request.status === ODRequestStatus.REJECTED
                                ? 'bg-red-50 text-red-600'
                                : request.status === ODRequestStatus.WITHDRAWN
                                  ? 'bg-slate-100 text-slate-400 line-through'
                                  : 'bg-amber-50 text-amber-600'
                            }`}>
                            {request.status.replace(/_/g, ' ')}
                          </span>
                          {(request.status === ODRequestStatus.APPROVED || request.status.startsWith('PENDING')) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleWithdraw(request.id); }}
                              disabled={withdrawingOD[request.id]}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 disabled:opacity-60"
                            >
                              {withdrawingOD[request.id] ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                              Withdraw
                            </button>
                          )}
                          <ChevronRight size={18} className="text-slate-300 group-hover:text-cse-accent" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredODRequests.length === 0 && (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <FileText size={32} />
                      </div>
                      <p className="text-slate-500 font-medium">No registrations found.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Faculty Specific: Organizer Requests (kept for faculty sidebar) */}
            {currentUser.role === UserRole.FACULTY && (
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Users size={18} className="text-cse-accent" /> Organizer Requests
                </h3>
                <div className="space-y-4">
                  {organizerRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <p className="text-sm font-semibold">{req.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{req.status}</p>
                      </div>
                      {req.status === 'pending' && (
                        <button
                          onClick={() => approveOrganizer(req.id)}
                          className="p-1.5 bg-white text-cse-accent rounded-lg border border-slate-200 hover:bg-cse-accent hover:text-white transition-all"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Staff: Manage Students Quick Card */}
            {isStaff && (
              <div
                onClick={() => navigate('/manage-students')}
                className="glass-panel rounded-2xl p-6 cursor-pointer hover:shadow-lg transition-all group border border-transparent hover:border-cse-accent/20"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-cse-accent/10 text-cse-accent rounded-xl flex items-center justify-center group-hover:bg-cse-accent group-hover:text-white transition-all">
                    <Users size={20} />
                  </div>
                  <h3 className="font-bold text-slate-900">Manage Students</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  View section-wise student lists and grant event organizer privileges.
                </p>
                <div className="flex items-center gap-1 text-cse-accent text-sm font-semibold">
                  Open <ChevronRight size={16} />
                </div>
              </div>
            )}

            {/* Student Organizer: Quick Actions Card */}
            {currentUser.role === UserRole.STUDENT_ORGANIZER && (
              <div className="glass-panel rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Plus size={18} className="text-cse-accent" /> Quick Actions
                </h3>
                <div
                  onClick={() => navigate('/explore')}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-cse-accent/40 hover:bg-cse-accent/5 transition-all group"
                >
                  <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-cse-accent group-hover:text-white transition-all">
                    <Calendar size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">Explore Events</p>
                    <p className="text-xs text-slate-500">Browse all department events</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-cse-accent" />
                </div>
                {currentUser.isApprovedOrganizer && (
                  <div
                    onClick={() => navigate('/create-event')}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-cse-accent/40 hover:bg-cse-accent/5 transition-all group"
                  >
                    <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-cse-accent group-hover:text-white transition-all">
                      <Plus size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">Create Event</p>
                      <p className="text-xs text-slate-500">Submit a new event proposal</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-cse-accent" />
                  </div>
                )}
              </div>
            )}

            {/* Department Info Card */}
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="h-28 w-full relative">
                <img src={cseDeptImg} alt="CSE Department" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-cse-primary/80 to-transparent" />
              </div>
              <div className="p-5 bg-cse-primary text-white relative">
                <h3 className="font-bold text-lg mb-1">CSE Department</h3>
                <p className="text-slate-300 text-sm mb-4">Excellence in Innovation and Technology.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                      <Users size={14} />
                    </div>
                    <span>1,200+ Students</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
                      <ShieldCheck size={14} />
                    </div>
                    <span>45 Faculty Members</span>
                  </div>
                </div>
                <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
              </div>
            </div>

            {/* Quick Links */}
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="font-bold text-slate-900 mb-4">Quick Resources</h3>
              <div className="space-y-2">
                {[
                  { label: 'Venue Booking Policy', href: '/resources/venue-booking-policy.html' },
                  { label: 'IQAC Guidelines', href: '/resources/iqac-guidelines.html' },
                  { label: 'Budget Templates', href: '/resources/budget-template.csv', download: true },
                  { label: 'Guest Protocol', href: '/resources/guest-protocol.html' },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    download={item.download ? 'budget-template.csv' : undefined}
                    className="flex items-center justify-between p-2 text-sm text-slate-600 hover:text-cse-accent hover:bg-slate-50 rounded-lg transition-all"
                  >
                    {item.label} <ChevronRight size={14} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* OD Request Detail Modal — students only */}
      {selectedODRequest && !isStaff && (
        <ODRequestDetailModal
          request={selectedODRequest}
          onClose={() => setSelectedODRequest(null)}
        />
      )}

      {/* Event Detail Modal — for all users */}
      {selectedEventDetail && (
        <EventDetailModal
          event={selectedEventDetail}
          onClose={() => setSelectedEventDetail(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
