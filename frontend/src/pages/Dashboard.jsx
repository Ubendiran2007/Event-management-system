import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getRolePath } from '../utils/routeUtils';
import {
  Calendar,
  Users,
  User,
  CheckCircle2,
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
  X,
  XCircle,
  UserCheck,
  Copy,
  Check,
  Download,
  ClipboardCopy,
  ClipboardList,
  Search,
  Filter,
  SlidersHorizontal,
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  LayoutDashboard,
  LogOut,
  Shield,
  History,
  Info,
  UserPlus,
  Lock,
  MoreVertical
} from 'lucide-react';

const formatTime12 = (t24) => {
  if (!t24) return "-";
  try {
    const [h, m] = String(t24).split(':');
    const hh = parseInt(h, 10);
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${m} ${suffix}`;
  } catch {
    return t24;
  }
};
import { useAppContext } from '../context/AppContext';
import { useWorkflowEvents } from '../context/WorkflowEventsContext';
import { useOrganizerEvents } from '../context/OrganizerEventsContext';
import { useODWorkflow } from '../context/ODWorkflowContext';
import { UserRole, EventStatus, ODRequestStatus } from '../types';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import ODRequestDetailModal from '../components/ODRequestDetailModal';
import EventDetailModal from '../components/EventDetailModal';
import ConfirmationModal from '../components/ConfirmationModal';
import { generateODLetterBase64 as generateODLetterPDF } from '../utils/pdfGenerator';
import { sortEventsByEventDateDesc, sortEventsBySubmissionDesc, sortEventsByEndDateDesc } from '../utils/eventSort';

import { formatStudentNameWithRoll, formatStudentNameOnly, formatEventRef, fallbackValue, getEventStatus, isRegistrationLocked } from '../utils/formatters';
import seceHeader from '../assets/sece header.jpeg';



// ── IQACExtensionApprovalWidget ─────────────────────────────────────────────
// HOD-only sidebar widget to review and approve IQAC extension requests
const IQACExtensionApprovalWidget = ({ events, hodName }) => {
  const [open, setOpen] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});

  const handleApprove = async (eventId) => {
    const endDate = selectedDates[eventId];
    if (!endDate) {
      return;
    }
    setProcessingId(eventId);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${eventId}/approve-iqac-extension`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate, approvedBy: hodName }),
      });
      if (!res.ok) throw new Error('Action failed');
    } catch (err) {
      console.error(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 flex flex-col overflow-hidden max-h-[600px] shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-indigo-100/50 transition-all group text-left shrink-0"
      >
        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 transition-all shrink-0">
          <Clock3 size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">IQAC Extension Requests</p>
          <p className="text-xs text-indigo-600 font-bold uppercase tracking-tight">{events.length} Pending Approval</p>
        </div>
        <ChevronDown size={18} className={`text-indigo-400 group-hover:text-indigo-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-4 pt-0 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-200 space-y-4">
          {events.length === 0 ? (
            <div className="py-8 text-center bg-white/50 rounded-xl border border-dashed border-indigo-200">
               <CheckCircle2 size={24} className="mx-auto text-indigo-400 mb-2" />
               <p className="text-xs text-indigo-600 font-bold uppercase">No pending requests</p>
            </div>
          ) : (
            events.map(ev => {
              const req = ev.iqacExtensionRequest;
              return (
                <div key={ev.id} className="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm flex flex-col gap-3 relative transition-all hover:border-indigo-300">
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-slate-800 line-clamp-1">{ev.title}</p>
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500">
                       <User size={10} /> {req?.requestedBy || 'Organizer'}
                    </div>
                  </div>

                  <div className="bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100/50">
                    <p className="text-[11px] font-bold text-indigo-900 mb-1 flex items-center gap-1.5 uppercase tracking-tighter">
                       <Info size={10} /> Reason for Extension
                    </p>
                    <p className="text-xs text-indigo-800 italic leading-snug">" {req?.reason} "</p>
                  </div>

                  <div className="space-y-2 mt-1">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block px-1">Grant Extension Until:</label>
                    <div className="flex items-center gap-2">
                      <PremiumDatePicker  
                         
                        min={new Date().toISOString().split('T')[0]}
                        value={selectedDates[ev.id] || ''}
                        onChange={(e) => setSelectedDates(prev => ({ ...prev, [ev.id]: e.target.value }))}
                        className="flex-1 text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <button
                        onClick={() => handleApprove(ev.id)}
                        disabled={processingId === ev.id}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-indigo-600/10 active:scale-95"
                      >
                        {processingId === ev.id ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={14} />}
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};


const Dashboard = () => {
  const {
    currentUser,
    students,
    loading,
    refreshStudents,
    loadStudents
  } = useAppContext();
  
  const { odRequests, loading: odLoading } = useODWorkflow();

  const { events: workflowEvents, loading: workflowLoading } = useWorkflowEvents();
  const { events: organizerEvents, loading: organizerLoading } = useOrganizerEvents();

  const events = useMemo(() => {
    const combined = [...workflowEvents, ...organizerEvents];
    // Deduplicate by id
    return Array.from(new Map(combined.map(e => [e.id, e])).values());
  }, [workflowEvents, organizerEvents]);

  const navigate = useNavigate();
  const location = useLocation();
  const [selectedODRequest, setSelectedODRequest] = useState(null);
  const [selectedEventDetail, setSelectedEventDetail] = useState(null);
  
  const segments = location.pathname.split('/').filter(Boolean);
  const feature = segments[segments.length - 1];
  const validFeatures = ['dashboard', 'events', 'approvals', 'registrations', 'modifications', 'available', 'my-registrations'];
  const currentFeature = validFeatures.includes(feature) ? feature : 'dashboard';
  
  const [activeTab, setActiveTab] = useState(currentFeature);
  const expectedRolePrefix = getRolePath(currentUser?.role);

  useEffect(() => {
    setActiveTab(currentFeature);
  }, [currentFeature]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (currentUser && expectedRolePrefix) {
      if (!location.pathname.startsWith(`/${expectedRolePrefix}`)) {
        navigate(`/${expectedRolePrefix}/${currentFeature}`, { replace: true });
      }
    }
  }, [currentUser, location.pathname, expectedRolePrefix, currentFeature, navigate]);
  const [togglingOD, setTogglingOD] = useState({});
  const [withdrawingOD, setWithdrawingOD] = useState({});
  const [expandedRegistrationGroups, setExpandedRegistrationGroups] = useState({});
  const [bulkApprovingGroups, setBulkApprovingGroups] = useState({});
  const [copiedStates, setCopiedStates] = useState({});
  const [searchQueries, setSearchQueries] = useState({});
  const [, setShowAllEvents] = useState(false);
  const [eventFilter, setEventFilter] = useState(location.state?.filter || 'all'); // all, posted, completed, iqac
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [odFilter, setOdFilter] = useState('all');
  const [isOdFilterOpen, setIsOdFilterOpen] = useState(false);
  const [isResettingAllOD, setIsResettingAllOD] = useState(false);

  const handleResetAllOD = async () => {
    if (window.confirm("WARNING: This will reset the OD used count to ZERO for ALL students across the entire institution. This action is typically only done at the start of a new semester.\n\nAre you absolutely sure you want to proceed?")) {
      setIsResettingAllOD(true);
      try {
        const response = await fetch((import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com') + '/api/students/reset-od-usage', {
          method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
          alert(`Success: ${data.message}`);
          await refreshStudents();
        } else {
          alert(`Error: ${data.message}`);
        }
      } catch (error) {
        console.error('Failed to reset ODs:', error);
        alert('An error occurred while attempting to reset OD usage.');
      } finally {
        setIsResettingAllOD(false);
      }
    }
  };

  useEffect(() => {
    if (location.state?.filter) {
      setEventFilter(location.state.filter);
    }
  }, [location.state]);
  const isMedia = currentUser?.role === UserRole.MEDIA;
  const isDeptOfficer = currentUser?.role && currentUser.role !== UserRole.FACULTY && currentUser.role !== UserRole.STUDENT_GENERAL && currentUser.role !== UserRole.STUDENT_ORGANIZER;
  const canCreateEvent =
    currentUser?.role === UserRole.FACULTY ||
    currentUser?.role === UserRole.STUDENT_ORGANIZER;
  const isStaff = currentUser?.role && ![UserRole.STUDENT_GENERAL, UserRole.STUDENT_ORGANIZER].includes(currentUser.role.toUpperCase());
  const canManageStudents = [UserRole.FACULTY, UserRole.HOD, UserRole.IQAC_TEAM].includes(currentUser?.role);

  const hasOrganizedEvents = useMemo(() => {
    if (!currentUser || !events) return false;
    return events.some(e => (e.organizerId === currentUser.id || e.organizerEmail === currentUser.email));
  }, [events, currentUser]);

  const downloadStudentListPDF = (group) => {
    // Only include students who are explicitly approved and haven't withdrawn
    const approvedStudents = group.requests.filter(req => req.status === 'APPROVED');
    
    if (approvedStudents.length === 0) {
      alert('No students have been approved yet for this event.');
      return;
    }

    // Re-use the existing beautifully formatted HTML-to-print PDF logic
    downloadDeptListAsPDF('All Departments', approvedStudents, group);
  };

  // ORIGINAL HOOKS START HERE
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === UserRole.STUDENT_GENERAL && activeTab === 'events' && !hasOrganizedEvents) {
      navigate(`/${expectedRolePrefix}/available`, { replace: true });
    }
  }, [currentUser, activeTab, hasOrganizedEvents]);

  useEffect(() => {
    if (!selectedEventDetail) return;
    const latestEvent = events.find((event) => event.id === selectedEventDetail.id);
    if (!latestEvent) return;
    const pendingStatusForRole = {
      [UserRole.FACULTY]: EventStatus.PENDING_FACULTY,
      [UserRole.HOD]: EventStatus.PENDING_HOD,
      [UserRole.HR_TEAM]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.AUDIO_TEAM]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.SYSTEM_ADMIN]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.TRANSPORT_TEAM]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.BOYS_WARDEN]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.GIRLS_WARDEN]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.IQAC_TEAM]: EventStatus.PENDING_IQAC,
    };
    const expectedPendingStatus = pendingStatusForRole[currentUser?.role];
    if (expectedPendingStatus && selectedEventDetail.status === expectedPendingStatus && latestEvent.status !== expectedPendingStatus) {
      setSelectedEventDetail(null);
      return;
    }
    if (latestEvent !== selectedEventDetail) {
      setSelectedEventDetail(latestEvent);
    }
  }, [events, selectedEventDetail, currentUser?.role]);

  // Filtered events for the current user's role — must be defined BEFORE any early returns
  // so that hook call order stays consistent across every render.
  const filteredEvents = useMemo(() => {
    if (!currentUser) return [];
    const result = events.filter(ev => {
      if (currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.STUDENT_GENERAL) {
        if ((ev.organizerId === currentUser.id || ev.organizerEmail === currentUser.email)) return true;
        if (currentUser.role === UserRole.STUDENT_GENERAL) return false;
      }
      if (currentUser.role === UserRole.FACULTY) {
        // Faculty sees events pending their approval OR events they created as organizer
        const isMyEvent = (ev.organizerId === currentUser.id || ev.organizerEmail === currentUser.email);
        if (isMyEvent) return true;
        
        if (ev.status === EventStatus.PENDING_FACULTY) {
          if (!currentUser.assignedClasses || currentUser.assignedClasses.length === 0) return false;
          const creator = students?.find(s => s.id === ev.organizerId);
          if (creator) {
            const creatorClass = (creator.class || '').replace(/-/g, ' ').toUpperCase();
            const assigned = currentUser.assignedClasses.map(c => (c || '').replace(/-/g, ' ').toUpperCase());
            return assigned.includes(creatorClass);
          }
          return false;
        }
        return false;
      }
      if (currentUser.role === UserRole.HOD) {
        if (ev.status !== EventStatus.PENDING_HOD) return false;
        // Event department should match HOD department
        const eventDept = ev.department || ev.requisition?.step1?.department || '';
        if (eventDept && currentUser.department) {
           return eventDept.toUpperCase() === currentUser.department.toUpperCase();
        }
        return true;
      }
      if (currentUser.role === UserRole.MEDIA) {
        const posterWorkflowStatus = String(ev.posterWorkflow?.status || '').toUpperCase();
        return ['REQUESTED', 'REWORK_REQUESTED', 'REVISION_REQUIRED'].includes(posterWorkflowStatus) || ev.status === 'REJECTED';
      }

      // ── Department Approvals (Status must be PENDING_DEPARTMENTS) ──
      const isDeptPending = ev.status === EventStatus.PENDING_DEPARTMENTS;
      const reqs = ev.requisition?.step1?.requirements || {};
      const isReq = (key) => reqs[key] ?? ev[key] ?? false;
      const depts = ev.departmentApprovals || {};

      if (currentUser.role === UserRole.HR_TEAM) {
        return isDeptPending && (
          (isReq('venueRequired') && depts.venue?.status !== 'APPROVED') ||
          (isReq('mediaRequired') && depts.media?.status !== 'APPROVED')
        );
      }
      if (currentUser.role === UserRole.AUDIO_TEAM) {
        return isDeptPending && isReq('audioRequired') && depts.audio?.status !== 'APPROVED';
      }
      if (currentUser.role === UserRole.SYSTEM_ADMIN) {
        return isDeptPending && isReq('ictsRequired') && depts.icts?.status !== 'APPROVED';
      }
      if (currentUser.role === UserRole.TRANSPORT_TEAM) {
        return isDeptPending && isReq('transportRequired') && depts.transport?.status !== 'APPROVED';
      }
      if (currentUser.role === UserRole.BOYS_WARDEN) {
        return isDeptPending && depts.boysAccommodation?.status !== 'APPROVED' && (isReq('accommodationDiningRequired') || isReq('accommodationRequired'));
      }
      if (currentUser.role === UserRole.GIRLS_WARDEN) {
        return isDeptPending && depts.girlsAccommodation?.status !== 'APPROVED' && (isReq('accommodationDiningRequired') || isReq('accommodationRequired'));
      }
      if (currentUser.role === UserRole.IQAC_TEAM) {
        return ev.status === EventStatus.PENDING_IQAC || ev.status === EventStatus.COMPLETED;
      }

      return false;
    });

    if (currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.STUDENT_GENERAL) {
      return result.sort(sortEventsByEventDateDesc);
    } else {
      return result.sort(sortEventsBySubmissionDesc);
    }
  }, [currentUser, events, students]);

  const approvedEvents = useMemo(() => {
    if (!currentUser) return [];
    return events.filter(ev => {
      const depts = ev.departmentApprovals || {};
      const reqs = ev.requisition?.step1?.requirements || {};
      const isReq = (key) => reqs[key] ?? ev[key] ?? false;

      if (currentUser.role === UserRole.HOD) return ev.hodApproval === 'APPROVED' || ev.hodApprovedAt;
      if (currentUser.role === UserRole.HR_TEAM) return (isReq('venueRequired') && depts.venue?.status === 'APPROVED') || (isReq('mediaRequired') && depts.media?.status === 'APPROVED');
      if (currentUser.role === UserRole.AUDIO_TEAM) return isReq('audioRequired') && depts.audio?.status === 'APPROVED';
      if (currentUser.role === UserRole.SYSTEM_ADMIN) return isReq('ictsRequired') && depts.icts?.status === 'APPROVED';
      if (currentUser.role === UserRole.TRANSPORT_TEAM) return isReq('transportRequired') && depts.transport?.status === 'APPROVED';
      if (currentUser.role === UserRole.BOYS_WARDEN) return depts.boysAccommodation?.status === 'APPROVED' && (isReq('accommodationDiningRequired') || isReq('accommodationRequired'));
      if (currentUser.role === UserRole.GIRLS_WARDEN) return depts.girlsAccommodation?.status === 'APPROVED' && (isReq('accommodationDiningRequired') || isReq('accommodationRequired'));
      if (currentUser.role === UserRole.IQAC_TEAM) return ev.status === EventStatus.POSTED || ev.status === EventStatus.COMPLETED || ev.iqacApprovedAt;
      if (currentUser.role === UserRole.MEDIA) return depts.media?.status === 'APPROVED' || ['APPROVED', 'COMPLETED'].includes(String(ev.posterWorkflow?.status || '').toUpperCase());
      return false;
    }).sort(sortEventsByEventDateDesc);
  }, [currentUser, events]);

  // For organizer: incoming registrations from students for their events
  const organizerIncomingOD = useMemo(() => {
    if (!currentUser) return [];
    return (currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY || hasOrganizedEvents)
      ? odRequests.filter(r => (r.organizerId === currentUser.id || r.organizerEmail === currentUser.email))
      : [];
  }, [currentUser, odRequests, hasOrganizedEvents]);

  const groupedOrganizerEvents = useMemo(() => {
    if (!currentUser) return [];
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
      .sort((a, b) => {
        const evA = events.find(e => e.id === a.eventId);
        const evB = events.find(e => e.id === b.eventId);
        return sortEventsByEventDateDesc(evA || { date: a.eventDate }, evB || { date: b.eventDate });
      })
      .map(group => ({
        ...group,
        requests: [...group.requests].sort((a, b) => {
          const aPending = a.status === 'PENDING_ORGANIZER' ? 0 : 1;
          const bPending = b.status === 'PENDING_ORGANIZER' ? 0 : 1;
          if (aPending !== bPending) return aPending - bPending;
          return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        }),
      }));
  }, [organizerIncomingOD, currentUser]);

  const organizerEventsById = useMemo(() => (
    events.reduce((acc, ev) => {
      acc[ev.id] = ev;
      return acc;
    }, {})
  ), [events]);



  const handleRegister = async (eventId) => {
    if (!currentUser?.id) return;
    setProcessingEventId(eventId);

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

    try {
      const results = await Promise.allSettled([
        fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/od-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            studentId: currentUser.id,
            studentName: currentUser.name,
            rollNo: currentUser.rollNo || currentUser.password || '',
            class: currentUser.class || currentUser.className || '',
            department: currentUser.department || '',
            email: currentUser.email,
            registrationType: 'PARTICIPANT'
          }),
        }),
        fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${eventId}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEntry),
        })
      ]);

      const odReq = results[0].status === 'fulfilled' ? results[0].value : null;
      const eventReq = results[1].status === 'fulfilled' ? results[1].value : null;

      if (!odReq || !odReq.ok || !eventReq || !eventReq.ok) {
        console.warn("One or more registration systems returned non-ok status or failed to fetch");
      }
    } catch (error) {
      console.error('Error registering:', error);
    } finally {
      setProcessingEventId(null);
    }
  };

  useEffect(() => {
    if (currentUser?.role !== UserRole.STUDENT_ORGANIZER) return;

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

  }, [currentUser?.role, groupedOrganizerEvents]);

  // NEW HOOKS ADDED HERE (Stay at end of hook section)
  const [processingEventId, setProcessingEventId] = useState(null);

  const availableEvents = useMemo(() => {
    if (!currentUser) return [];
    const now = new Date();

    return events.filter(ev => {
      // 1. Must be POSTED or POSTPONED status
      if (ev.status !== EventStatus.POSTED && ev.status !== 'POSTPONED') return false;

      // 2. Department visibility check
      const globalRoles = [
        UserRole.IQAC_TEAM,
        UserRole.SYSTEM_ADMIN,
        UserRole.HR_TEAM,
        UserRole.AUDIO_TEAM,
        UserRole.TRANSPORT_TEAM,
        UserRole.BOYS_WARDEN,
        UserRole.GIRLS_WARDEN,
        UserRole.MEDIA,
      ];
      const hasGlobalVisibility = globalRoles.includes(currentUser?.role);
      const isOpenToAll = ev.openToAllDepartments === true || ev.audienceScope === 'Open To All' || String(ev.department).toLowerCase() === 'overall';
      const isMyDept = String(ev.department).toLowerCase() === String(currentUser?.department).toLowerCase() || (ev.requisition?.step1?.department === currentUser?.department);
      const isSelectedDept = Array.isArray(ev.selectedDepartments) && ev.selectedDepartments.includes(currentUser?.department);
      
      if (!hasGlobalVisibility && !isOpenToAll && !isMyDept && !isSelectedDept) {
        return false;
      }

      // 3. Registration must be open (not locked)
      if (isRegistrationLocked(ev)) return false;

      // 4. Avoid ongoing and completed events (check date)
      const startDateStr = ev.requisition?.step1?.eventStartDate || ev.date;
      const startTimeStr = ev.requisition?.step1?.eventStartTime || ev.startTime || '00:00';
      
      if (!startDateStr) return false;

      try {
        const sDP = startDateStr.split('-');
        const sTP = startTimeStr.split(':');
        // Month is 0-indexed in JS Date
        const startTimestamp = new Date(parseInt(sDP[0]), parseInt(sDP[1]) - 1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1])).getTime();
        
        // If now is past or equal the event start time, it's considered ongoing/starting
        if (now.getTime() >= startTimestamp) return false;
      } catch {
        // Fallback to simple date string comparison if date object fails
        const today = new Date().toISOString().split('T')[0];
        if (startDateStr < today) return false;
      }

      return true;
    }).sort(sortEventsByEventDateDesc);
  }, [events, currentUser]);

  if (!currentUser) {
    return null;
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <Loader2 className="animate-spin mx-auto text-indigo-600 mb-4" size={40} />
            <p className="text-slate-500 font-medium">Loading Dashboard Data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Filter OD requests for student view only
  const getFilteredODRequests = () => {
    const role = currentUser.role?.toUpperCase();
    if (role === UserRole.STUDENT_GENERAL || role === UserRole.STUDENT_ORGANIZER) {
      let reqs = odRequests.filter(r => r.studentId === currentUser.id);
      
      if (odFilter === 'approved') reqs = reqs.filter(r => r.status === 'APPROVED');
      else if (odFilter === 'rejected') reqs = reqs.filter(r => r.status === 'REJECTED');
      else if (odFilter === 'withdrawn') reqs = reqs.filter(r => r.status === 'WITHDRAWN');
      else if (odFilter === 'pending') reqs = reqs.filter(r => r.status && r.status.startsWith('PENDING'));
      else if (odFilter === 'cancelled') reqs = reqs.filter(r => r.status === 'OD_CANCELLED' || r.status === 'CANCELLED');

      return reqs.sort((a, b) => {
          // Put WITHDRAWN and REJECTED statuses at the bottom
          const isAInactive = a.status === 'WITHDRAWN' || a.status === 'REJECTED';
          const isBInactive = b.status === 'WITHDRAWN' || b.status === 'REJECTED';
          if (isAInactive !== isBInactive) return isAInactive ? 1 : -1;
          
          const evA = events.find(e => e.id === a.eventId);
          const evB = events.find(e => e.id === b.eventId);
          return sortEventsByEventDateDesc(evA || { date: a.eventDate }, evB || { date: b.eventDate });
        });
    }
    return [];
  };

  const filteredODRequests = getFilteredODRequests();
  const pendingODCount = filteredODRequests.filter(r => r.status && r.status.startsWith('PENDING')).length;

  const pendingOrganizerOD = organizerIncomingOD.filter(r => r.status === 'PENDING_ORGANIZER');



  const handleOrganizerApproval = async (odId, approve) => {
    setTogglingOD(prev => ({ ...prev, [odId]: true }));
    try {
      let odLetterBase64 = null;
      if (approve) {
        try {
          const req = odRequests.find(r => r.id === odId);
          const event = events.find(e => e.id === req?.eventId);
          if (req && event) {
            console.log(`[Approval] Generating PDF for ${req.studentName}...`);
            odLetterBase64 = await generateODLetterPDF(req, event);
          } else {
            console.warn('[Approval] Missing req or event for PDF generation:', { odId, req: !!req, event: !!event });
          }
        } catch (pdfErr) {
          console.error('[Approval] PDF generation failed, proceeding without attachment:', pdfErr);
        }
      }

      console.log(`[Approval] Sending ${approve ? 'approval' : 'rejection'} for ${odId}...`);
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/od-requests/${odId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: approve ? 'APPROVED' : 'REJECTED',
          approvedBy: currentUser?.name || 'Organizer',
          odLetterBase64
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update status');
      }

      console.log(`[Approval] Successfully updated status for ${odId}`);
    } catch (err) {
      console.error('Error updating OD request:', err);
    } finally {
      setTogglingOD(prev => ({ ...prev, [odId]: false }));
    }
  };

  const handleWithdraw = async (odId) => {
    const req = odRequests.find(r => r.id === odId);
    if (!req) return;

    setWithdrawingOD(prev => ({ ...prev, [odId]: true }));
    try {
      // 1. Mark OD request as withdrawn
      await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/od-requests/${odId}/withdraw`, {
        method: 'PATCH',
      });

      // 2. Remove student from event's registration list
      if (req.eventId && currentUser?.id) {
        await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${req.eventId}/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id }),
        });
      }
    } catch (err) {
      console.error('Error withdrawing registration:', err);
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
        pendingRequests.map(async (req) => {
          let odLetterBase64 = null;
          try {
            const event = events.find(e => e.id === req.eventId);
            if (event) {
              odLetterBase64 = await generateODLetterPDF(req, event);
            }
          } catch (pdfErr) {
            console.error(`[Bulk Approval] PDF generation failed for ${req.studentName}:`, pdfErr);
          }

          return fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/od-requests/${req.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'APPROVED',
              approvedBy: currentUser?.name || 'Organizer',
              odLetterBase64
            }),
          }).then((response) => {
            if (!response.ok) {
              throw new Error(`Failed to approve request ${req.id}`);
            }
            return response;
          });
        })
      );

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.warn(`Approved ${pendingRequests.length - failed} registrations. ${failed} failed.`);
      }
    } catch (err) {
      console.error('Bulk approval error:', err);
    } finally {
      setBulkApprovingGroups((prev) => ({ ...prev, [bulkKey]: false }));
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const shareDeptList = async (dept, students, eventTitle, eventDate) => {
    const listText = students.map((s, i) => `${i + 1}. ${formatStudentNameWithRoll(s.studentName, s.rollNo, s.userId || s.studentId)} - ${fallbackValue(s.class, 'general')}`).join('\n');
    const shareText = `APPROVED PARTICIPANT OD LIST: ${eventTitle}\nDATE: ${eventDate || '-'}\nDEPARTMENT: ${dept}\n\n${listText}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `OD List - ${dept}`,
          text: shareText,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
          copyToClipboard(shareText, `${eventTitle}-${dept}`);
        }
      }
    } else {
      copyToClipboard(shareText, `${eventTitle}-${dept}`);
    }
  };

    const downloadDeptListAsPDF = (dept, students, group) => {
    // 1. Sort students by class and then name
    const sortedStudents = [...students].sort((a, b) => {
      const classComp = String(a.class || '').localeCompare(String(b.class || ''));
      if (classComp !== 0) return classComp;
      return String(a.studentName || a.name || '').localeCompare(String(b.studentName || b.name || ''));
    });

    const event = organizerEventsById[group.eventId];
    const s1 = event?.requisition?.step1;

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateStr;
    };

    let displayDate = formatDate(group.eventDate);
    if (s1?.eventStartDate && s1?.eventEndDate && s1.eventStartDate !== s1.eventEndDate) {
      displayDate = `${formatDate(s1.eventStartDate)} - ${formatDate(s1.eventEndDate)}`;
    }

    // --- Pagination Logic ---
    const PAGE_1_ROWS = 20;
    const PAGE_N_ROWS = 28;
    
    const chunks = [];
    let currentChunk = [];
    
    sortedStudents.forEach((student, index) => {
       const isPage1 = chunks.length === 0;
       const maxRows = isPage1 ? PAGE_1_ROWS : PAGE_N_ROWS;
       
       currentChunk.push({ ...student, globalIndex: index + 1 });
       
       if (currentChunk.length === maxRows || index === sortedStudents.length - 1) {
          chunks.push(currentChunk);
          currentChunk = [];
       }
    });

    const lastChunk = chunks[chunks.length - 1] || [];
    const isLastPage1 = chunks.length === 1;
    const maxRowsLast = isLastPage1 ? PAGE_1_ROWS : PAGE_N_ROWS;
    
    // If the last chunk is almost full, the signature section won't fit on the same page.
    // Signature needs about 4 rows of space.
    if (lastChunk.length > maxRowsLast - 5) {
        chunks.push([]); // Empty chunk to force signature onto a new page
    }
    
    const totalPages = chunks.length;
    
    const pagesHtml = chunks.map((chunk, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === totalPages - 1;
        
        // Calculate class counts only for this chunk to handle rowspans properly per page
        const classCountsInChunk = chunk.reduce((acc, s) => {
           acc[s.class] = (acc[s.class] || 0) + 1;
           return acc;
        }, {});
        
        const renderedClassesInChunk = new Set();
        let hodRenderedInChunk = false;

        const tableRows = chunk.map(s => {
           const isFirstInClass = !renderedClassesInChunk.has(s.class);
           if (isFirstInClass) renderedClassesInChunk.add(s.class);
           const isFirstRow = !hodRenderedInChunk;
           if (isFirstRow) hodRenderedInChunk = true;
           
           return `
             <tr>
               <td style="text-align: center;">${s.globalIndex}</td>
               <td style="font-weight: bold; color: #1e293b;">${formatStudentNameOnly(s.studentName || s.name)}</td>
               <td style="font-family: 'Courier New', monospace; font-weight: 600;">${fallbackValue(s.rollNo, 'general')}</td>
               <td style="text-align: center;">${fallbackValue(s.class, 'general')}</td>
               ${isFirstInClass ? `<td rowspan="${classCountsInChunk[s.class]}" class="sig-cell"></td>` : ''}
               ${isFirstRow ? `<td rowspan="${chunk.length}" class="sig-cell"></td>` : ''}
             </tr>
           `;
        }).join('');

        const tableHtml = chunk.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">S.No</th>
                <th>Student Name</th>
                <th>Roll Number</th>
                <th style="width: 100px;">Class / Section</th>
                <th style="width: 140px;">Class Advisor Signature</th>
                <th style="width: 140px;">HOD Signature</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        ` : '';

        const signatureHtml = isLastPage ? `
          <div class="sig-space">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-label">
                <strong>Event Organizer Signature</strong><br/>
                ${currentUser?.name || ''}
              </div>
            </div>
          </div>
        ` : '';

        const headerHtml = isFirstPage ? `
          <div class="header">
            <img src="${seceHeader}" alt="Sri Eshwar College header" class="header-image" />
            <div class="doc-title">Approved On-Duty (OD) Participant List</div>
          </div>
          
          <div class="meta-info">
            <div class="meta-info-grid">
              <div><strong>Event Title:</strong> ${group.eventTitle}</div>
              <div style="text-align: right;"><strong>Event Date:</strong> ${displayDate}</div>
              <div><strong>Department:</strong> ${dept}</div>
              <div style="text-align: right;"><strong>Total Students:</strong> ${students.length}</div>
              <div><strong>Academic Year:</strong> ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}</div>
            </div>
          </div>
        ` : '';

        return `
          <div class="page-container">
            <div class="page-border">
              ${headerHtml}
              ${tableHtml}
              ${signatureHtml}
              
              <div class="footer">
                Page ${pageIndex + 1} of ${totalPages}
              </div>
            </div>
          </div>
        `;
    }).join('');

    const listHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Approved OD Participant List</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { 
      size: A4 portrait; 
      margin: 0; 
    }
    body { 
      font-family: 'Times New Roman', Times, serif; 
      color: #1a202c; 
      background: #eee; 
      padding: 0;
      -webkit-print-color-adjust: exact;
    }
    .page-container {
      width: 210mm;
      height: 297mm;
      background: white;
      margin: 0 auto;
      padding: 10mm 15mm 15mm 15mm;
      page-break-after: always;
      position: relative;
    }
    @media print {
      body { background: white !important; }
      .page-container { margin: 0 !important; padding: 10mm 15mm 15mm 15mm !important; box-shadow: none !important; page-break-after: always !important; }
    }
    .page-border {
      border: 1.5px solid #1a3a6b;
      height: 100%;
      padding: 25px;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .header { 
      border-bottom: 2px solid #1a3a6b; 
      margin-bottom: 25px; 
      padding-bottom: 15px; 
      text-align: center; 
    }
    .header-image { 
      width: 100%; 
      max-height: 90px; 
      object-fit: contain; 
      margin: 0 auto; 
      display: block; 
    }
    .doc-title { 
      text-align: center; 
      font-size: 14pt; 
      font-weight: bold; 
      color: #1a3a6b; 
      margin-top: 15px; 
      text-decoration: underline; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
    }
    .meta-info { 
      margin-bottom: 25px; 
      font-size: 11pt; 
      line-height: 1.6; 
      color: #1e293b; 
    }
    .meta-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #cbd5e0; }
    th, td { border: 1px solid #cbd5e0; padding: 10px 12px; text-align: left; font-size: 10pt; }
    th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; text-transform: uppercase; font-size: 9pt; }
    .sig-cell { vertical-align: middle; text-align: center; color: #718096; font-size: 8pt; font-weight: normal; background: #fff !important; }
    tr:nth-child(even) { background-color: #f8fafc; }
    
    .sig-space { 
      margin-top: auto; 
      display: flex; 
      justify-content: flex-end; 
      padding-bottom: 25px;
    }
    .sig-box { 
      text-align: center; 
      width: 250px;
    }
    .sig-line { 
      border-top: 1.5px solid #1e293b; 
      width: 100%; 
      margin-bottom: 8px; 
    }
    .sig-label { 
      font-size: 11pt; 
      color: #1e293b; 
      line-height: 1.4;
    }
    
    .footer { 
      position: absolute;
      bottom: 10px;
      left: 0;
      width: 100%;
      text-align: center;
      font-size: 10pt;
      color: #64748b;
      font-weight: bold;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(listHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      console.error('Pop-ups might be blocked or error in list generation');
    }
  };

  const getDashboardSubtitle = (role) => {
    switch (role) {
      case UserRole.STUDENT_GENERAL:
      case UserRole.STUDENT_ORGANIZER:
        return "Manage and track your events and registrations";
      case UserRole.FACULTY:
        return "Review and forward event proposals for approval";
      case UserRole.HOD:
        return "Approve and oversee departmental event proposals";
      case UserRole.HR_TEAM:
      case UserRole.TRANSPORT_TEAM:
      case UserRole.BOYS_WARDEN:
      case UserRole.GIRLS_WARDEN:
      case UserRole.MEDIA:
      case UserRole.AUDIO_TEAM:
      case UserRole.SYSTEM_ADMIN:
        return "Review and approve event requirements and logistics";
      case UserRole.IQAC_TEAM:
        return "Finalize and approve events ensuring institutional compliance";
      case UserRole.PRINCIPAL:
        return "Approve and oversee institutional event proposals";
      default:
        return "Manage and track your events and registrations";
    }
  };

  return (
    <Layout>
      <div className={`flex-1 flex flex-col min-h-0 overflow-y-auto relative ${activeTab === 'dashboard' ? '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]' : 'scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent'}`}>
        <div className="max-w-[1600px] mx-auto w-full min-h-full px-4 sm:px-6 py-6 flex flex-col">
          {/* Header Section */}
          {activeTab === 'dashboard' ? (
            <div className="mb-6 flex flex-row items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                  Welcome Back, {currentUser.name}! <span className="text-2xl">👋</span>
                </h2>
                <p className="text-slate-400 font-bold tracking-widest text-[11px] uppercase mt-1">
                  INSTITUTION PORTAL OVERVIEW
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {[UserRole.HOD, UserRole.IQAC_TEAM, UserRole.PRINCIPAL, UserRole.FACULTY].includes(currentUser.role) && (
                  <button onClick={() => navigate(getRolePath(currentUser.role, 'approvals'))} className="p-2 bg-white border border-slate-200 rounded-full text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm" title="Approvals">
                    <FileCheck size={20} className="hidden sm:block m-0.5" />
                    <MoreVertical size={20} className="sm:hidden m-0.5" />
                  </button>
                )}
                {currentUser.role === UserRole.ADMIN && (
                  <button onClick={() => navigate('/security')} className="p-2 bg-white border border-slate-200 rounded-full text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm" title="Security">
                    <Shield size={20} className="hidden sm:block m-0.5" />
                    <MoreVertical size={20} className="sm:hidden m-0.5" />
                  </button>
                )}
              </div>
            </div>
          ) : activeTab === 'events' ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  My Events
                </h2>
                <p className="text-slate-500 font-medium tracking-wide text-xs uppercase mt-1">
                  MANAGE AND TRACK YOUR ORGANIZED COLLEGE EVENTS
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl font-extrabold transition-all text-[13px]"
                  >
                    <SlidersHorizontal size={16} className="text-slate-600" />
                    <span>
                      {isDeptOfficer ? (
                        {
                          'all': 'All Events',
                          'pending': 'Pending Approval',
                          'approved': 'Approved Events'
                        }[eventFilter] || 'All Events'
                      ) : (
                        {
                          'all': 'All Events',
                          'process': 'In Process',
                          'approved': 'Approved',
                          'posted': 'Posted',
                          'completed': 'Completed',
                          'rejected': 'Rejected'
                        }[eventFilter] || 'All Events'
                      )}
                    </span>
                  </button>
                  
                  {isFilterOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                      <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        {(isDeptOfficer ? [
                          { id: 'all', label: 'All Events' },
                          { id: 'pending', label: 'Pending Approval' },
                          { id: 'approved', label: 'Approved Events' }
                        ] : [
                          { id: 'all', label: 'All Events' },
                          { id: 'process', label: 'In Process' },
                          { id: 'approved', label: 'Approved' },
                          { id: 'posted', label: 'Posted' },
                          { id: 'completed', label: 'Completed' },
                          { id: 'rejected', label: 'Rejected' }
                        ]).map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => { setEventFilter(opt.id); setShowAllEvents(false); setIsFilterOpen(false); }}
                            className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${eventFilter === opt.id ? 'bg-blue-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {activeTab !== 'dashboard' && currentUser.role !== UserRole.STUDENT_ORGANIZER && (
                  <button onClick={() => navigate(`/${expectedRolePrefix}`)} className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2">
                     <ArrowLeft size={18} /> <span className="hidden sm:inline">Back</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {activeTab === 'registrations' ? 'Registrations' : 
                   activeTab === 'approvals' ? 'Approvals' :
                   activeTab === 'modifications' ? 'Modifications' :
                   activeTab === 'available' ? 'Available Events' :
                   activeTab === 'my-registrations' ? 'My Registrations' :
                   currentUser.role === UserRole.STUDENT_GENERAL || currentUser.role === UserRole.STUDENT_ORGANIZER ? 'Student Dashboard' : 'My Dashboard'}
                </h2>
                <p className="text-slate-500 font-medium mt-1">
                  {activeTab === 'registrations' ? 'Review and manage event participant registrations' : 
                   activeTab === 'available' ? 'Browse and register for upcoming events' :
                   activeTab === 'my-registrations' ? 'Track your event registrations and OD requests' :
                   getDashboardSubtitle(currentUser.role)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {(activeTab === 'approvals' || activeTab === 'modifications') && (
                  <div className="relative">
                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl font-extrabold transition-all text-[13px]"
                    >
                      <SlidersHorizontal size={16} className="text-slate-600" />
                      <span>
                        {
                          activeTab === 'approvals' ? (
                            {
                              'all': 'All Approvals',
                              'pending': 'Pending Approval',
                              'approved': 'Approved',
                              'modified': 'Modified / Cancelled'
                            }[eventFilter] || 'All Approvals'
                          ) : (
                            {
                              'all': 'All Modifications',
                              'cancellation': 'Cancellation',
                              'postponement': 'Postponement'
                            }[eventFilter] || 'All Modifications'
                          )
                        }
                      </span>
                    </button>
                    
                    {isFilterOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                        <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                          {(activeTab === 'approvals' ? [
                            { id: 'all', label: 'All Approvals' },
                            { id: 'pending', label: 'Pending Approval' },
                            { id: 'approved', label: 'Approved' },
                            { id: 'modified', label: 'Modified / Cancelled' }
                          ] : [
                            { id: 'all', label: 'All Modifications' },
                            { id: 'cancellation', label: 'Cancellation' },
                            { id: 'postponement', label: 'Postponement' }
                          ]).map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => { setEventFilter(opt.id); setIsFilterOpen(false); }}
                              className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${eventFilter === opt.id ? 'bg-blue-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button onClick={() => navigate(`/${expectedRolePrefix}`)} className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2">
                   <ArrowLeft size={18} /> <span className="hidden sm:inline">Back</span>
                </button>
              </div>
              {activeTab === 'dashboard' && (
                <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(`/${expectedRolePrefix}/explore`)}
                  className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                >
                  <Calendar size={18} /> Explore Events
                </button>
                {canCreateEvent && (
                  <button
                    onClick={() => navigate(`/${expectedRolePrefix}/create-event`)}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-md active:scale-95"
                  >
                    <Plus size={18} /> Create Event
                  </button>
                )}
                {canManageStudents && (
                  <button
                    onClick={() => navigate(`/${expectedRolePrefix}/manage-students`)}
                    className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                  >
                    <Users size={18} /> Manage Students
                  </button>
                )}
              </div>
              )}
              {activeTab === 'my-registrations' && (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      onClick={() => setIsOdFilterOpen(!isOdFilterOpen)}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 border border-slate-200 shadow-sm hover:bg-slate-50 rounded-2xl font-extrabold transition-all text-[13px]"
                    >
                      <SlidersHorizontal size={16} className="text-slate-600" />
                      <span>
                        {
                          {
                            'all': 'All Logs',
                            'approved': 'Approved',
                            'pending': 'Pending',
                            'rejected': 'Rejected',
                            'withdrawn': 'Withdrawn',
                            'cancelled': 'Cancelled'
                          }[odFilter] || 'All Logs'
                        }
                      </span>
                    </button>
                    
                    {isOdFilterOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOdFilterOpen(false)} />
                        <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                          {[
                            { id: 'all', label: 'All Logs' },
                            { id: 'approved', label: 'Approved' },
                            { id: 'pending', label: 'Pending' },
                            { id: 'rejected', label: 'Rejected' },
                            { id: 'withdrawn', label: 'Withdrawn' },
                            { id: 'cancelled', label: 'Cancelled' }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              onClick={() => { setOdFilter(opt.id); setIsOdFilterOpen(false); }}
                              className={`px-4 py-2.5 text-left text-[14px] font-bold transition-colors ${odFilter === opt.id ? 'bg-blue-600 text-white' : 'text-slate-800 hover:bg-slate-50'}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dashboard' ? (
            <div className="flex flex-col gap-6">
              {/* Dashboard Overview Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {(() => {
                  const isOrg = currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY;
                  const isStud = currentUser.role === UserRole.STUDENT_GENERAL;
                  const baseEvents = isOrg ? events.filter(e => (e.organizerId === currentUser.id || e.organizerEmail === currentUser.email)) : events;
                  
                  return [
                    { label: isStud ? 'AVAILABLE EVENTS' : 'MY TOTAL EVENTS', value: isStud ? availableEvents.length : baseEvents.length, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
                    { label: isStud ? 'PENDING ODs' : 'PENDING REVIEW', value: (isStud ? filteredODRequests.filter(r => r.status && r.status.startsWith('PENDING')).length : baseEvents.filter(e => e.status?.startsWith('PENDING')).length), icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
                    { label: isStud ? 'ODS USED' : 'TOTAL REGISTRATIONS', value: isStud ? `${currentUser.odUsed || 0} / ${currentUser.odLimit || 7}` : baseEvents.reduce((acc, ev) => acc + (ev.registeredStudents?.length || 0), 0), icon: isStud ? CheckCircle2 : Users, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                    { label: isStud ? 'APPROVED ODs' : 'COMPLETED', value: isStud ? filteredODRequests.filter(r => r.status === 'APPROVED').length : baseEvents.filter(e => e.status === EventStatus.COMPLETED).length, icon: FileText, color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
                    { label: isStud ? 'REJECTED ODs' : 'REJECTED', value: isStud ? filteredODRequests.filter(r => r.status === 'REJECTED').length : baseEvents.filter(e => e.status === EventStatus.REJECTED).length, icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex items-center justify-between relative overflow-hidden group">
                      <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-extrabold text-slate-500 tracking-widest uppercase">{stat.label}</p>
                        <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-none">{stat.value}</p>
                      </div>
                      <div className={`w-8 h-8 rounded-full ${stat.bg} ${stat.color} flex items-center justify-center border ${stat.border} shrink-0`}>
                         <stat.icon size={16} strokeWidth={2.5} />
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Lower Section: Recent Events & Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[360px]">
                  <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                     <Calendar size={18} className="text-blue-500" />
                     <h3 className="font-extrabold text-sm uppercase tracking-wide text-slate-800">Recent Events Summary</h3>
                  </div>
                   <div className="flex-1 p-5 space-y-3">
                     {(() => {
                        const myCreated = events.filter(e => (e.organizerId === currentUser.id || e.organizerEmail === currentUser.email));
                        const myRegistered = events.filter(e => (e.registeredStudents || []).some(s => String(s.userId) === String(currentUser.id)));
                        
                        const combinedMap = new Map();
                        // Store relationship type
                        myRegistered.forEach(e => combinedMap.set(e.id, { ...e, _relation: 'Registered' }));
                        myCreated.forEach(e => combinedMap.set(e.id, { ...e, _relation: 'Created' }));
                        
                        // Sort by ID descending to get newest first, then slice to 4
                        const recentLog = Array.from(combinedMap.values())
                          .sort((a, b) => String(b.id).localeCompare(String(a.id)))
                          .slice(0, 4);

                        return recentLog.length > 0 ? recentLog.map(ev => (
                           <div key={ev.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100 hover:border-blue-100 transition-colors gap-3">
                              <div>
                                 <div className="flex flex-wrap items-center gap-2">
                                   <p className="font-bold text-slate-800 text-sm">{ev.title}</p>
                                   <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                      ev._relation === 'Created' ? 'bg-purple-100 text-purple-700' :
                                      ev._relation === 'Registered' ? 'bg-indigo-100 text-indigo-700' :
                                      'bg-amber-100 text-amber-700'
                                   }`}>{ev._relation}</span>
                                 </div>
                                 <p className="text-xs text-slate-500 mt-1">{ev.date} · {ev.venue || 'To be allocated'}</p>
                              </div>
                              <div className="shrink-0 flex justify-start sm:justify-end">
                                <StatusBadge status={ev.status} />
                              </div>
                           </div>
                        )) : (
                           <p className="text-slate-500 text-sm text-center py-4">No recent events found.</p>
                        );
                     })()}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-slate-100 flex items-center gap-2">
                     <LayoutDashboard size={18} className="text-blue-500" />
                     <h3 className="font-extrabold text-sm uppercase tracking-wide text-slate-800">Quick Actions</h3>
                  </div>
                  <div className="p-5 space-y-3">
                     {canCreateEvent && (
                       <button onClick={() => navigate(`/${expectedRolePrefix}/create-event`)} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all group">
                          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Plus size={20} /></div>
                          <div className="text-left"><p className="font-bold text-slate-800 text-sm">Create Event</p><p className="text-[11px] text-slate-500 font-medium">Initiate a new event</p></div>
                       </button>
                     )}
                     <button onClick={() => navigate(`/${expectedRolePrefix}/od-correction`)} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><AlertCircle size={20} /></div>
                        <div className="text-left"><p className="font-bold text-slate-800 text-sm">OD Corrections</p><p className="text-[11px] text-slate-500 font-medium">Review or submit corrections</p></div>
                     </button>
                     <button onClick={() => navigate(`/${expectedRolePrefix}/explore`)} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Search size={20} /></div>
                        <div className="text-left"><p className="font-bold text-slate-800 text-sm">Explore Events</p><p className="text-[11px] text-slate-500 font-medium">Discover college events</p></div>
                     </button>
                     {canManageStudents && (
                       <button onClick={() => navigate(`/${expectedRolePrefix}/manage-students`)} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all group">
                          <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><Users size={20} /></div>
                          <div className="text-left"><p className="font-bold text-slate-800 text-sm">Explore Student</p><p className="text-[11px] text-slate-500 font-medium">Manage student records</p></div>
                       </button>
                     )}
                     {currentUser?.role === UserRole.IQAC_TEAM && (
                       <button onClick={handleResetAllOD} disabled={isResettingAllOD} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-red-300 hover:shadow-md transition-all group disabled:opacity-50">
                          <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            {isResettingAllOD ? <Loader2 size={20} className="animate-spin" /> : <History size={20} />}
                          </div>
                          <div className="text-left"><p className="font-bold text-red-700 text-sm">Reset All OD</p><p className="text-[11px] text-red-500 font-medium">Reset OD usage for new semester</p></div>
                       </button>
                     )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col flex-1 min-h-0 w-full max-w-[1400px] mx-auto">
                <div className="flex flex-col flex-1 min-h-0 space-y-6 w-full">
                {/* Hide stats for events list, registrations, available events, my registrations, approvals, and modifications */}
                {activeTab !== 'events' && activeTab !== 'registrations' && activeTab !== 'available' && activeTab !== 'my-registrations' && activeTab !== 'approvals' && activeTab !== 'modifications' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                    {(() => {
                      const isOrg = currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY;
                      const isStud = currentUser.role === UserRole.STUDENT_GENERAL;
                      
                      const baseEvents = isOrg ? events.filter(e => (e.organizerId === currentUser.id || e.organizerEmail === currentUser.email)) : events;
                      const getStatItems = () => {
                        const stats = [];
                        stats.push({ label: isOrg ? 'My Total Events' : (isStud ? 'Available Events' : 'Total Events'), value: isStud ? availableEvents.length : baseEvents.length, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' });
                        stats.push({ label: isStud ? 'Approved ODs' : 'Posted', value: isStud ? filteredODRequests.filter(r => r.status === 'APPROVED').length : baseEvents.filter(e => e.status === EventStatus.POSTED || e.status === EventStatus.APPROVED).length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' });
                        stats.push({ label: (isStaff || isMedia) ? (currentUser.role === UserRole.FACULTY ? 'Pending Review' : 'My Queue') : (isStud ? 'My Pending ODs' : 'Pending'), value: (isStaff || isMedia) ? (currentUser.role === UserRole.FACULTY ? filteredEvents.filter(e => e.status === EventStatus.PENDING_FACULTY).length : filteredEvents.length) : (isStud ? filteredODRequests.filter(r => r.status && r.status.startsWith('PENDING')).length : baseEvents.filter(e => e.status?.startsWith('PENDING')).length), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' });
                        stats.push({ label: isStud ? 'My Completed ODs' : 'Completed', value: isStud ? filteredODRequests.filter(r => r.status === 'APPROVED' && events.find(e => e.id === r.eventId)?.status === EventStatus.COMPLETED).length : baseEvents.filter(e => e.status === EventStatus.COMPLETED).length, icon: FileCheck, color: 'text-slate-600', bg: 'bg-slate-100' });
                        stats.push({ label: isStud ? 'My Rejected ODs' : 'Rejected', value: isStud ? filteredODRequests.filter(r => r.status === 'REJECTED').length : baseEvents.filter(e => e.status === EventStatus.REJECTED).length, icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-50' });
                        return stats;
                      };
                      return getStatItems().map((stat, i) => (
                        <div key={i} className="glass-panel px-4 py-3 rounded-2xl flex flex-col justify-center">
                          <div className={`w-8 h-8 ${stat.bg} ${stat.color} rounded-[10px] flex items-center justify-center mb-1.5`}>
                            <stat.icon size={16} />
                          </div>
                          <p className="text-xl font-extrabold leading-none mb-1">{stat.value}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{stat.label}</p>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              <div className="rounded-2xl overflow-hidden bg-white flex flex-col shadow-sm border border-slate-200 flex-1 min-h-0">
                {/* Scrollable container for tab content - now relies on main page scroll */}
                <div className="flex-1 flex flex-col bg-[#f5f7fa] min-h-0">
                  {/* Events Tab Content */}
                  {(activeTab === 'events' || activeTab === 'approvals') && (() => {
                    let displayEvents = [];
                    if (activeTab === 'events') {
                      const rawBaseEvents = currentUser.role === UserRole.FACULTY ? events.filter(e => (e.organizerId === currentUser.id || e.organizerEmail === currentUser.email)) :
                        isDeptOfficer ? [...filteredEvents, ...approvedEvents] :
                          filteredEvents;
                      let baseEvents = Array.from(new Map(rawBaseEvents.map(e => [e.id, e])).values());
                      
                      if (currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.STUDENT_GENERAL) {
                        baseEvents.sort(sortEventsByEventDateDesc);
                      } else {
                        baseEvents.sort(sortEventsBySubmissionDesc);
                      }

                      if (isDeptOfficer) {
                        if (eventFilter === 'all') displayEvents = baseEvents;
                        else if (eventFilter === 'pending') displayEvents = filteredEvents;
                        else if (eventFilter === 'approved') displayEvents = approvedEvents;
                        else displayEvents = baseEvents;
                      } else {
                        if (eventFilter === 'all') displayEvents = baseEvents;
                        else if (eventFilter === 'process') displayEvents = baseEvents.filter(e => e.status && e.status.startsWith('PENDING'));
                        else if (eventFilter === 'approved') displayEvents = baseEvents.filter(e => e.status === EventStatus.APPROVED);
                        else if (eventFilter === 'posted') displayEvents = baseEvents.filter(e => e.status === EventStatus.POSTED);
                        else if (eventFilter === 'completed') displayEvents = baseEvents.filter(e => e.status === EventStatus.COMPLETED);
                        else if (eventFilter === 'rejected') displayEvents = baseEvents.filter(e => e.status === EventStatus.REJECTED);
                      }

                      // Apply Rule 3: Completed events sort by End Date Descending
                      if (eventFilter === 'completed') {
                        displayEvents = [...displayEvents].sort(sortEventsByEndDateDesc);
                      }
                    } else if (activeTab === 'approvals') {
                      let pendingEvents = [];
                      let pastApprovedEvents = [];

                      if (currentUser.role === UserRole.FACULTY) {
                        pendingEvents = events.filter(e => e.status === EventStatus.PENDING_FACULTY);
                        pastApprovedEvents = events.filter(e => e.facultyApproval === 'APPROVED' || e.facultyApprovedAt);
                      } else if (currentUser.role === UserRole.HOD) {
                        pendingEvents = events.filter(e => e.status === EventStatus.PENDING_HOD);
                        pastApprovedEvents = approvedEvents;
                      } else if (currentUser.role === UserRole.IQAC_TEAM) {
                        pendingEvents = events.filter(e => e.status === EventStatus.PENDING_IQAC);
                        pastApprovedEvents = approvedEvents;
                      } else {
                        // For departments (HR_TEAM, AUDIO_TEAM, etc.)
                        pendingEvents = filteredEvents;
                        pastApprovedEvents = approvedEvents;
                      }

                      if (eventFilter === 'approved') {
                        displayEvents = pastApprovedEvents;
                      } else if (eventFilter === 'pending') {
                        displayEvents = pendingEvents;
                      } else if (eventFilter === 'modified') {
                        const allApprovals = Array.from(new Set([...pendingEvents, ...pastApprovedEvents]));
                        displayEvents = allApprovals.filter(e => e.status === 'CANCELLED' || e.status === 'POSTPONED' || e.isPostponed || e.modificationRequest);
                      } else {
                        displayEvents = Array.from(new Set([...pendingEvents, ...pastApprovedEvents])).sort(sortEventsBySubmissionDesc);
                      }
                    }

                    return (
                      <div className="flex flex-col h-full flex-1 min-h-0">
                        {/* Filters are now managed in the top header */}
                        {displayEvents.length > 0 ? (
                          <div className="flex flex-col h-full flex-1 min-h-0">
                            <div className="w-full bg-slate-50/50 border-b border-slate-200 pr-[6px]">
                              <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                  <tr className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                                    <th className="py-3 sm:py-4 px-3 sm:px-6 w-[55%] sm:w-[35%]">EVENT DETAILS</th>
                                    <th className="py-3 sm:py-4 px-3 sm:px-6 hidden sm:table-cell sm:w-[15%]">VENUE</th>
                                    <th className="py-3 sm:py-4 px-3 sm:px-6 hidden sm:table-cell sm:w-[22%]">DATE & TIME</th>
                                    <th className="py-3 sm:py-4 px-3 sm:px-6 w-[25%] sm:w-[15%]">STATUS</th>
                                    <th className="py-3 sm:py-4 px-3 sm:px-6 w-[20%] sm:w-[13%] text-right">ACTIONS</th>
                                  </tr>
                                </thead>
                              </table>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0 bg-white rounded-b-2xl w-full scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                              <table className="w-full text-left border-collapse table-fixed">
                                <tbody className="bg-white">
                                {displayEvents.map(event => (
                                   <tr key={event.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => setSelectedEventDetail(event)}>
                                      <td className="py-3 sm:py-4 px-3 sm:px-6 w-[55%] sm:w-[35%]">
                                         <div className="flex items-center gap-2 sm:gap-4">
                                            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
                                               <Calendar size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
                                            </div>
                                            <div className="min-w-0">
                                               <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">{event.title}</p>
                                               <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 sm:hidden truncate">
                                                  {event.date} • {event.venue && !['to be allocated','tba','n/a',''].includes(String(event.venue).toLowerCase().trim()) ? event.venue : 'TBA'}
                                               </p>
                                               <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-1">
                                                  <span className={`px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[9px] font-extrabold uppercase rounded border ${event.creatorType === 'FACULTY' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                     {event.creatorType || 'STUDENT'}
                                                  </span>
                                                  {event.department && (
                                                     <span className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase truncate max-w-[80px] sm:max-w-none">{event.department}</span>
                                                  )}
                                                  {event.status === 'CANCELLED' && (
                                                     <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[8px] sm:text-[9px] font-extrabold border border-red-200 uppercase flex items-center gap-1"><XCircle size={8}/> CANCELLED</span>
                                                  )}
                                                  {(event.status === 'POSTPONED' || event.isPostponed) && getEventStatus(event) === 'upcoming' && (
                                                     <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[8px] sm:text-[9px] font-extrabold border border-amber-200 uppercase flex items-center gap-1"><Clock size={8}/> POSTPONED</span>
                                                  )}
                                               </div>
                                            </div>
                                         </div>
                                      </td>
                                      <td className="py-3 sm:py-4 px-3 sm:px-6 hidden sm:table-cell sm:w-[15%]">
                                         <p className="text-sm font-medium text-slate-700 truncate">{event.venue && !['to be allocated','tba','n/a',''].includes(String(event.venue).toLowerCase().trim()) ? event.venue : 'TBA'}</p>
                                      </td>
                                      <td className="py-3 sm:py-4 px-3 sm:px-6 hidden sm:table-cell sm:w-[22%]">
                                         <p className="text-sm font-medium text-slate-700 whitespace-nowrap">{event.date}</p>
                                         <p className="text-[11px] font-medium text-slate-500 mt-0.5 whitespace-nowrap">{formatTime12(event.startTime) !== '-' ? formatTime12(event.startTime) : '09:00 AM'}</p>
                                      </td>
                                      <td className="py-3 sm:py-4 px-2 sm:px-6 w-[25%] sm:w-[15%]">
                                         <div className="scale-[0.65] sm:scale-100 origin-left">
                                           <StatusBadge status={event.status} />
                                         </div>
                                      </td>
                                      <td className="py-3 sm:py-4 px-3 sm:px-6 w-[20%] sm:w-[13%] text-right">
                                         <div className="flex items-center justify-end gap-1 sm:gap-2">
                                            {(currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY) && event.status === EventStatus.REJECTED && (event.organizerId === currentUser.id || event.organizerEmail === currentUser.email) && (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); navigate(`/${expectedRolePrefix}/create-event`, { state: { editingEvent: event } }); }}
                                                className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
                                              >
                                                Edit
                                              </button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedEventDetail(event); }} className="px-2 sm:px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] sm:text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm active:scale-95">
                                               View
                                            </button>
                                         </div>
                                      </td>
                                   </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-transparent min-h-[400px]">
                            <div className="w-20 h-20 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300 shadow-sm">
                              <Calendar size={36} />
                            </div>
                            <h3 className="text-slate-800 font-bold text-lg mb-1">No events available</h3>
                            <p className="text-slate-500 font-medium text-sm max-w-sm mx-auto">
                              {(isStaff || isMedia)
                                ? 'There are no events currently waiting for your approval.'
                                : 'There are no events matching your current filters.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  
                  {/* Modification Requests Tab Content */}
                  {activeTab === 'modifications' && (currentUser.role === UserRole.HOD || currentUser.role === UserRole.IQAC_TEAM) && (() => {
                    let modEvents = events.filter(e => e.modificationRequest && ((currentUser.role === UserRole.HOD && e.modificationRequest.status === 'PENDING_HOD_APPROVAL') || (currentUser.role === UserRole.IQAC_TEAM && e.modificationRequest.status === 'PENDING_IQAC_APPROVAL')));
                    
                    if (eventFilter === 'cancellation') {
                        modEvents = modEvents.filter(e => e.modificationRequest.type === 'CANCEL');
                    } else if (eventFilter === 'postponement') {
                        modEvents = modEvents.filter(e => e.modificationRequest.type === 'POSTPONE');
                    }
                    
                    return (
                      <div className="flex flex-col flex-1 min-h-0 bg-slate-50/50">
                        {modEvents.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                            <div className="w-20 h-20 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300 shadow-sm">
                              <ClipboardList size={36} />
                            </div>
                            <h3 className="text-slate-800 font-bold text-lg mb-1">No modification requests</h3>
                            <p className="text-slate-500 font-medium text-sm">There are no pending postponement or cancellation requests.</p>
                          </div>
                        ) : (
                          <div className="flex-1 p-5 space-y-4 flex flex-col overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                            {modEvents.map(event => (
                              <div key={event.id} className="bg-white rounded-2xl border border-slate-200 px-6 py-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] shrink-0 group">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 min-h-[90px]">
                                  <div className="flex items-center gap-5 flex-1 w-full min-w-0">
                                    <div className={`w-14 h-14 bg-gradient-to-br ${event.modificationRequest.type === 'CANCEL' ? 'from-red-50 to-red-100 text-red-500 border-red-200 group-hover:text-red-600 group-hover:border-red-300' : 'from-amber-50 to-amber-100 text-amber-500 border-amber-200 group-hover:text-amber-600 group-hover:border-amber-300'} border rounded-xl flex items-center justify-center transition-all shrink-0 shadow-inner`}>
                                      {event.modificationRequest.type === 'CANCEL' ? <XCircle size={24} /> : <Clock size={24} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                        <h4 className="font-extrabold text-slate-900 text-[16px] xl:text-[18px] truncate max-w-full">
                                          {event.title}
                                        </h4>
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 uppercase tracking-wider ${event.modificationRequest.type === 'CANCEL' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                          {event.modificationRequest.type === 'CANCEL' ? 'Cancellation' : 'Postponement'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4 text-slate-500 text-[13px] font-medium flex-wrap">
                                        <span className="flex items-center gap-1.5 shrink-0 text-slate-600 font-semibold text-xs border border-slate-200 bg-slate-50 px-2 py-1 rounded-md">
                                          Ref: {formatEventRef(event)}
                                        </span>
                                        <span className="flex items-center gap-1.5 shrink-0">
                                          <User size={14} className="text-slate-400" /> By {event.modificationRequest.requestedBy}
                                        </span>
                                        <span className="flex items-center gap-1.5 shrink-0">
                                          <Calendar size={14} className="text-slate-400" /> Submitted: {new Date(event.modificationRequest.requestedAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0 sm:mt-0 mt-2 pl-[76px] sm:pl-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-0 border-slate-100 pt-4 sm:pt-0">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedEventDetail(event); }}
                                      className="px-6 py-2.5 rounded-lg text-[13px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm active:scale-95 whitespace-nowrap"
                                    >
                                      Review Request
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
{/* Available Events Tab Content */}
                  {activeTab === 'available' && (
                    <div className="flex flex-col flex-1 min-h-0 bg-slate-50/50">
                      {availableEvents.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
                          <div className="w-20 h-20 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300 shadow-sm">
                            <Calendar size={36} />
                          </div>
                          <h3 className="text-slate-800 font-bold text-lg mb-1">No available events</h3>
                          <p className="text-slate-500 font-medium text-sm">There are no new events open for registration right now.</p>
                        </div>
                      ) : (
                        <div className="flex-1 overflow-auto min-h-0 bg-white rounded-b-2xl border-t border-slate-100 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                          <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest sticky top-0 z-10">
                                <th className="py-4 px-6">EVENT DETAILS</th>
                                <th className="py-4 px-6">VENUE</th>
                                <th className="py-4 px-6">DATE & TIME</th>
                                <th className="py-4 px-6 text-right">ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {availableEvents.map(event => {
                                const isRegistered = (event.registeredStudents || []).some(s => String(s.userId) === String(currentUser.id));
                                const isProcessing = processingEventId === event.id;

                                return (
                                  <tr key={event.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => setSelectedEventDetail(event)}>
                                     <td className="py-4 px-6">
                                        <div className="flex items-center gap-4">
                                           <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
                                              <Calendar size={20} />
                                           </div>
                                           <div>
                                              <p className="font-extrabold text-slate-900 text-sm max-w-[300px] truncate">{event.title}</p>
                                              <div className="flex items-center gap-1.5 mt-1">
                                                 <span className={`px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded border ${event.creatorType === 'FACULTY' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                    {event.creatorType || 'STUDENT'}
                                                 </span>
                                                 {event.department && (
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">{event.department}</span>
                                                 )}
                                                 {event.status === 'CANCELLED' && (
                                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-extrabold border border-red-200 uppercase flex items-center gap-1"><XCircle size={8}/> CANCELLED</span>
                                                 )}
                                                 {(event.status === 'POSTPONED' || event.isPostponed) && getEventStatus(event) === 'upcoming' && (
                                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-extrabold border border-amber-200 uppercase flex items-center gap-1"><Clock size={8}/> POSTPONED</span>
                                                 )}
                                              </div>
                                           </div>
                                        </div>
                                     </td>
                                     <td className="py-4 px-6">
                                        <p className="text-sm font-semibold text-slate-700 max-w-[150px] truncate">{event.venue && !['to be allocated','tba','n/a',''].includes(String(event.venue).toLowerCase().trim()) ? event.venue : 'TBA'}</p>
                                     </td>
                                     <td className="py-4 px-6">
                                        <p className="text-sm font-bold text-slate-700 whitespace-nowrap">{event.date}</p>
                                        <p className="text-[11px] font-medium text-slate-500 mt-0.5 whitespace-nowrap">{formatTime12(event.startTime) !== '-' ? formatTime12(event.startTime) : '09:00 AM'}</p>
                                     </td>
                                     <td className="py-4 px-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                           {isRegistered ? (
                                             <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                                               <CheckCircle2 size={14} /> Registered
                                             </span>
                                           ) : (
                                             <button
                                               disabled={isProcessing}
                                               onClick={(e) => {
                                                 e.stopPropagation();
                                                 handleRegister(event.id);
                                               }}
                                               className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 active:scale-95"
                                             >
                                               {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                               Register Now
                                             </button>
                                           )}
                                        </div>
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

                  {/* Registrations Tab — organizer sees incoming student OD requests */}
                  {activeTab === 'registrations' && (currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY || hasOrganizedEvents) && (
                    <div className="flex flex-col flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      {groupedOrganizerEvents.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px] bg-slate-50/30">
                          <div className="w-20 h-20 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300 shadow-sm">
                            <Users size={36} />
                          </div>
                          <h3 className="text-slate-800 font-bold text-lg mb-1">No student registrations yet</h3>
                          <p className="text-slate-500 font-medium text-sm">There are no OD requests to review at this time.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col flex-1 min-h-0">
                          {/* Table Header */}
                          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                            <div className="col-span-4">Event Name</div>
                            <div className="col-span-3">Venue</div>
                            <div className="col-span-3">Date</div>
                            <div className="col-span-2 text-right pr-2">Action</div>
                          </div>
                          <div className="divide-y divide-slate-100 overflow-y-auto min-h-0 flex-1">
                            {groupedOrganizerEvents.map(group => {
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
                              <div key={req.id} className="px-4 py-2 bg-white hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors group">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-blue-200 rounded-full flex items-center justify-center text-blue-800 font-bold text-xs shadow-sm shrink-0 border border-white mt-0.5">
                                      {initials}
                                    </div>
                                    <div className="flex flex-col justify-center min-h-[32px]">
                                      <p className="font-bold text-xs text-slate-800 leading-tight">
                                        {formatStudentNameWithRoll(req.studentName, req.rollNo, req.studentId)}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-[10px] text-slate-400 font-medium">{fallbackValue(req.class, 'general')}</span>
                                        {req.registrationType && (
                                          <span className={`text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${req.registrationType === 'VOLUNTEER' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {req.registrationType === 'VOLUNTEER' ? 'Volunteer' : 'Participant'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 sm:mt-0 mt-1">
                                    {req.status === 'PENDING_ORGANIZER' ? (
                                      <div className="flex gap-2 w-full sm:w-auto">
                                        <button
                                          onClick={() => handleOrganizerApproval(req.id, false)}
                                          disabled={isToggling}
                                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-white text-red-600 hover:bg-red-50 border border-red-200 hover:border-red-300 disabled:opacity-50 transition-all shadow-sm"
                                        >
                                          {isToggling ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Reject
                                        </button>
                                        <button
                                          onClick={() => handleOrganizerApproval(req.id, true)}
                                          disabled={isToggling}
                                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-sm"
                                        >
                                          {isToggling ? <Loader2 size={12} className="animate-spin" /> : <UserCheck size={12} />} Approve
                                        </button>
                                      </div>
                                    ) : req.status === 'WITHDRAWN' ? (
                                      <span className="px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400 border border-slate-200">
                                        Withdrawn
                                      </span>
                                    ) : (
                                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 border shadow-sm ${req.status === 'APPROVED'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-red-50 text-red-700 border-red-200'
                                        }`}>
                                        {req.status === 'APPROVED' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
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

                          return (
                            <div key={groupKey} className="flex flex-col group transition-colors hover:bg-slate-50/50">
                              {/* Row Content */}
                              <div className={`sm:grid sm:grid-cols-12 gap-4 items-center px-6 py-4 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                                <div className="col-span-4 mb-3 sm:mb-0">
                                  <p className="text-sm font-bold text-slate-900 leading-tight mb-1">{group.eventTitle}</p>
                                  <div className="flex items-center gap-3 sm:hidden text-xs font-medium text-slate-500 mt-2">
                                    <span className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-400"/> {sourceEvent?.venue || 'TBA'}</span>
                                    <span className="flex items-center gap-1.5"><Calendar size={12} className="text-slate-400"/> {group.eventDate || '-'}</span>
                                  </div>
                                </div>
                                <div className="hidden sm:flex col-span-3 items-center gap-2 text-sm text-slate-600 font-medium">
                                  <MapPin size={14} className="text-slate-400 shrink-0" />
                                  <span className="truncate">{sourceEvent?.venue || 'TBA'}</span>
                                </div>
                                <div className="hidden sm:flex col-span-3 items-center gap-2 text-sm text-slate-600 font-medium">
                                  <Calendar size={14} className="text-slate-400 shrink-0" />
                                  <span>{group.eventDate || '-'}</span>
                                </div>
                                <div className="col-span-2 flex items-center sm:justify-end justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    {pendingCount > 0 ? (
                                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                        {pendingCount} Pending
                                      </span>
                                    ) : (
                                      <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                        {group.requests.length} Total
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => setExpandedRegistrationGroups(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                                      isExpanded 
                                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                        : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                                    }`}
                                  >
                                    {isExpanded ? 'Close' : 'View'}
                                    <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ margin: 0 }}>
                                  <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100">
                                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                       <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                                           <Users className="text-blue-600" size={20} />
                                           Registrations for {group.eventTitle}
                                       </h3>
                                       <button onClick={(e) => { e.stopPropagation(); setExpandedRegistrationGroups(prev => ({ ...prev, [groupKey]: false })) }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                                           <X size={20} />
                                       </button>
                                    </div>
                                    <div className="p-6 flex flex-col flex-1 min-h-0 overflow-hidden">
                                      {/* Filter Search & PDF */}
                                      <div className="mb-4 flex flex-col sm:flex-row gap-3 shrink-0">
                                    <div className="relative flex-1">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                      <input
                                        type="text"
                                        placeholder="Search by student name, roll no, or class..."
                                        value={searchQueries[groupKey] || ''}
                                        onChange={(e) => setSearchQueries(prev => ({ ...prev, [groupKey]: e.target.value }))}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm bg-white cursor-pointer focus:cursor-text"
                                      />
                                    </div>
                                    {(() => {
                                      const approvedStudents = group.requests.filter(req => req.status === 'APPROVED');
                                      const hasApproved = approvedStudents.length > 0;
                                      const listText = approvedStudents.map((s, i) => `${i + 1}. ${formatStudentNameWithRoll(s.studentName, s.rollNo, s.userId)} - ${fallbackValue(s.class, 'general')}`).join('\n');
                                      const copyKey = `${groupKey}-all`;
                                      const isCopied = copiedStates[copyKey];

                                      return (
                                        <div className="flex items-center gap-2 shrink-0">
                                          <button 
                                            type="button"
                                            disabled={!hasApproved}
                                            onClick={(e) => { 
                                              e.stopPropagation();
                                              downloadStudentListPDF(group);
                                            }}
                                            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                              hasApproved 
                                                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md' 
                                                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                            }`}
                                          >
                                            <Download size={14} /> Download
                                          </button>
                                          <button
                                            type="button"
                                            disabled={!hasApproved}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              shareDeptList('All Participants', approvedStudents, group.eventTitle, group.eventDate);
                                            }}
                                            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                              hasApproved 
                                                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200' 
                                                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                            }`}
                                          >
                                            <ArrowUpRight size={14} /> Share
                                          </button>
                                          <button
                                            type="button"
                                            disabled={!hasApproved}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              copyToClipboard(`APPROVED PARTICIPANT OD LIST: ${group.eventTitle}\nDATE: ${group.eventDate || '-'}\n\n${listText}`, copyKey);
                                            }}
                                            className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                              !hasApproved ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' :
                                              isCopied
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                                            }`}
                                          >
                                            {isCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {(() => {
                                    const query = (searchQueries[groupKey] || '').toLowerCase();
                                    const filteredParticipantRequests = participantRequests.filter(r =>
                                      (r.studentName && r.studentName.toLowerCase().includes(query)) ||
                                      (r.rollNo && r.rollNo.toLowerCase().includes(query)) ||
                                      (r.class && r.class.toLowerCase().includes(query))
                                    );
                                    const filteredVolunteerRequests = volunteerRequests.filter(r =>
                                      (r.studentName && r.studentName.toLowerCase().includes(query)) ||
                                      (r.rollNo && r.rollNo.toLowerCase().includes(query)) ||
                                      (r.class && r.class.toLowerCase().includes(query))
                                    );
                                    const filteredAllRequests = group.requests.filter(r =>
                                      (r.studentName && r.studentName.toLowerCase().includes(query)) ||
                                      (r.rollNo && r.rollNo.toLowerCase().includes(query)) ||
                                      (r.class && r.class.toLowerCase().includes(query))
                                    );

                                    const pendingFilteredParticipant = filteredParticipantRequests.filter(r => r.status === 'PENDING_ORGANIZER');
                                    const pendingFilteredVolunteer = filteredVolunteerRequests.filter(r => r.status === 'PENDING_ORGANIZER');
                                    const pendingFilteredAll = filteredAllRequests.filter(r => r.status === 'PENDING_ORGANIZER');

                                    return isVolunteerEnabledEvent ? (
                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                                        <div className="rounded-2xl border-2 border-slate-100 bg-white/50 backdrop-blur-sm flex flex-col overflow-hidden shadow-sm">
                                          <div className="px-5 py-4 bg-slate-50/80 border-b-2 border-slate-100 shrink-0">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2">
                                                <Users size={16} className="text-slate-500" />
                                                <p className="text-sm font-bold uppercase tracking-wider text-slate-700">Participants ({participantRequests.length})</p>
                                              </div>
                                              {pendingFilteredParticipant.length > 0 && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleBulkOrganizerApproval(filteredParticipantRequests, `${groupKey}-participants`)}
                                                  disabled={bulkApprovingGroups[`${groupKey}-participants`]}
                                                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 shadow-sm"
                                                >
                                                  {bulkApprovingGroups[`${groupKey}-participants`] ? 'Approving...' : `Approve All (${pendingFilteredParticipant.length})`}
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          <div className="divide-y divide-slate-100/80 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                                            {filteredParticipantRequests.length > 0 ? filteredParticipantRequests.map(renderRequestRow) : (
                                              <div className="p-8 text-center text-sm font-medium text-slate-400">No participant requests found.</div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="rounded-2xl border-2 border-indigo-100 bg-white/50 backdrop-blur-sm flex flex-col overflow-hidden shadow-sm">
                                          <div className="px-5 py-4 bg-indigo-50/80 border-b-2 border-indigo-100 shrink-0">
                                            <div className="flex items-center justify-between gap-2">
                                              <div className="flex items-center gap-2">
                                                <ShieldCheck size={16} className="text-indigo-500" />
                                                <p className="text-sm font-bold uppercase tracking-wider text-indigo-800">Volunteers ({volunteerRequests.length})</p>
                                              </div>
                                              {pendingFilteredVolunteer.length > 0 && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleBulkOrganizerApproval(filteredVolunteerRequests, `${groupKey}-volunteers`)}
                                                  disabled={bulkApprovingGroups[`${groupKey}-volunteers`]}
                                                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 shadow-sm"
                                                >
                                                  {bulkApprovingGroups[`${groupKey}-volunteers`] ? 'Approving...' : `Approve All (${pendingFilteredVolunteer.length})`}
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          <div className="divide-y divide-indigo-50/80 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                                            {filteredVolunteerRequests.length > 0 ? filteredVolunteerRequests.map(renderRequestRow) : (
                                              <div className="p-8 text-center text-sm font-medium text-slate-400">No volunteer requests found.</div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="rounded-2xl border-2 border-slate-100 bg-white/50 backdrop-blur-sm flex flex-col overflow-hidden shadow-sm">
                                        <div className="px-5 py-4 bg-slate-50/80 border-b-2 border-slate-100 flex items-center justify-between gap-2 shrink-0">
                                          <div className="flex items-center gap-2">
                                            <Users size={16} className="text-slate-500" />
                                            <p className="text-sm font-bold uppercase tracking-wider text-slate-700">Registrations ({group.requests.length})</p>
                                          </div>
                                          {pendingFilteredAll.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => handleBulkOrganizerApproval(filteredAllRequests, `${groupKey}-all`)}
                                              disabled={bulkApprovingGroups[`${groupKey}-all`]}
                                              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60 shadow-sm shadow-emerald-500/20"
                                            >
                                              {bulkApprovingGroups[`${groupKey}-all`] ? 'Approving...' : `Approve All (${pendingFilteredAll.length})`}
                                            </button>
                                          )}
                                        </div>
                                        <div className="divide-y divide-slate-100/80 flex-1 min-h-0 overflow-y-auto scrollbar-thin">
                                          {filteredAllRequests.length > 0 ? filteredAllRequests.map(renderRequestRow) : (
                                            <div className="p-8 text-center text-sm font-medium text-slate-400">No requests found.</div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}


                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* My Registrations Tab — for all students */}
                  {activeTab === 'my-registrations' && (currentUser.role === UserRole.STUDENT_GENERAL || currentUser.role === UserRole.STUDENT_ORGANIZER) && (
                    <div className="flex flex-col flex-1 min-h-0 bg-white rounded-b-2xl overflow-hidden">
                      {filteredODRequests.length > 0 ? (
                        <div className="w-full flex flex-col flex-1 min-h-0">
                          <div className="w-full bg-slate-50 z-10 shadow-sm pr-[6px] overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                              <thead className="bg-slate-50">
                                <tr className="border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                                  <th className="py-4 px-6 w-[22%]">EVENT NAME</th>
                                  <th className="py-4 px-6 w-[25%]">DATE</th>
                                  <th className="py-4 px-6 w-[23%]">VENUE</th>
                                  <th className="py-4 px-6 w-[15%]">STATUS</th>
                                  <th className="py-4 px-6 w-[15%] text-right">ACTION</th>
                                </tr>
                              </thead>
                            </table>
                          </div>
                          <div className="w-full flex-1 min-h-0 overflow-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                              <tbody className="bg-white">
                              {filteredODRequests.map(request => {
                                let regStatus = 'Pending';
                                if (request.status === ODRequestStatus.APPROVED) regStatus = 'Approved';
                                else if (request.status === ODRequestStatus.REJECTED) regStatus = 'Rejected';
                                else if (request.status === ODRequestStatus.WITHDRAWN) regStatus = 'Withdrawn';
                                else if (request.status === 'OD_CANCELLED' || request.status === 'CANCELLED') regStatus = 'Cancelled';
                                else regStatus = 'Pending';

                                let regBadgeClass = '';
                                if (regStatus === 'Approved') regBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                else if (regStatus === 'Rejected') regBadgeClass = 'bg-red-50 text-red-700 border-red-200';
                                else if (regStatus === 'Withdrawn') regBadgeClass = 'bg-slate-100 text-slate-500 border-slate-200';
                                else if (regStatus === 'Cancelled') regBadgeClass = 'bg-red-50 text-red-700 border-red-200';
                                else regBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                                
                                const sourceEvent = events.find(e => e.id === request.eventId);
                                let eventBadge = null;
                                if (sourceEvent) {
                                    const computedStatus = getEventStatus(sourceEvent);
                                    const isPostponed = sourceEvent.status === 'POSTPONED' || sourceEvent.isPostponed;

                                    if (sourceEvent.status === 'CANCELLED') {
                                        eventBadge = { text: '🔴 CANCELLED', class: 'bg-red-50 text-red-700 border-red-200' };
                                    } else if (computedStatus === 'ongoing') {
                                        eventBadge = { text: '🟢 ONGOING', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
                                    } else if (isPostponed && computedStatus === 'upcoming') {
                                        eventBadge = { text: '🟡 POSTPONED', class: 'bg-amber-50 text-amber-700 border-amber-200' };
                                    } else if (computedStatus === 'completed' || sourceEvent.status === 'COMPLETED') {
                                        eventBadge = { text: '✅ COMPLETED', class: 'bg-blue-50 text-blue-700 border-blue-200' };
                                    }
                                }

                                return (
                                  <tr
                                    key={request.id}
                                    onClick={() => setSelectedODRequest(request)}
                                    className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                  >
                                    <td className="py-4 px-6 w-[22%]">
                                      <h4 className="font-bold text-slate-900 text-sm truncate" title={request.eventName || request.eventTitle || 'Untitled Event'}>
                                        {request.eventName || request.eventTitle || 'Untitled Event'}
                                      </h4>
                                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                                        {formatStudentNameWithRoll(request.studentName, request.rollNo, request.studentId)}
                                      </p>
                                    </td>
                                    <td className="py-4 px-6 w-[25%]">
                                      <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                                        <Calendar size={14} className="text-slate-400 shrink-0" />
                                        {request.eventDate}
                                      </p>
                                    </td>
                                    <td className="py-4 px-6 w-[23%]">
                                      <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 truncate" title={sourceEvent?.venue || 'To be allocated'}>
                                        <MapPin size={14} className="text-slate-400 shrink-0" />
                                        {sourceEvent?.venue || 'To be allocated'}
                                      </p>
                                    </td>
                                    <td className="py-4 px-6 w-[15%]">
                                      <div className="flex items-start">
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border shadow-sm ${regBadgeClass}`}>
                                          {regStatus}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-4 px-6 w-[15%] text-right">
                                      <div className="flex flex-row items-center justify-end gap-4">
                                        {(() => {
                                          const isEventStartedLocal = () => {
                                              if (!sourceEvent) return false;
                                              const sDate = sourceEvent.requisition?.step1?.eventStartDate || sourceEvent.date;
                                              const sTime = sourceEvent.requisition?.step1?.eventStartTime || sourceEvent.startTime || '00:00';
                                              if (!sDate) return false;
                                              const [y, mo, d] = String(sDate).split('-').map(Number);
                                              const [h, m] = String(sTime).split(':').map(Number);
                                              const eventStart = new Date(y, mo - 1, d, h, m, 0, 0).getTime();
                                              return new Date().getTime() >= eventStart;
                                          };
                                          
                                          const isLocked = isRegistrationLocked(sourceEvent) || isEventStartedLocal();
                                          const isCancelled = sourceEvent?.status === 'CANCELLED';
                                          const isValidStatus = request.status && (request.status.startsWith('PENDING') || request.status === ODRequestStatus.APPROVED);
                                          const canWithdraw = isValidStatus && !isLocked && !isCancelled;

                                          if (canWithdraw) {
                                            return (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleWithdraw(request.id); }}
                                                disabled={withdrawingOD[request.id]}
                                                className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-semibold bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 disabled:opacity-60 transition-colors"
                                              >
                                                {withdrawingOD[request.id] ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                                                Withdraw
                                              </button>
                                            );
                                          } else if (request.status === ODRequestStatus.APPROVED && isLocked) {
                                            return (
                                              <span className="flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 text-center w-full max-w-[120px]">
                                                <Lock size={10} /> Locked
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()}
                                        <div className="flex items-center text-[10px] text-slate-400 font-medium group-hover:text-purple-500 transition-colors cursor-pointer">
                                          View Details <ChevronRight size={12} />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px] bg-slate-50/30">
                          <div className="w-20 h-20 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300 shadow-sm">
                            <FileText size={36} />
                          </div>
                          <h3 className="text-slate-800 font-bold text-lg mb-1">No registrations found</h3>
                          <p className="text-slate-500 font-medium text-sm">You haven't registered for any events yet.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
            </>
          )}
        </div>
      </div>
      {/* OD Request Detail Modal — students only */}
      {selectedODRequest && !isStaff && (
        <ODRequestDetailModal
          request={selectedODRequest}
          events={events}
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
    </Layout>
  );
};

export default Dashboard;
