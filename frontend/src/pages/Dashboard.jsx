import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
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
  ArrowUpRight,
  Clock3,
  LayoutDashboard,
  History,
  Info
} from 'lucide-react';

const formatTime12 = (t24) => {
  if (!t24) return "-";
  try {
    const [h, m] = String(t24).split(':');
    const hh = parseInt(h, 10);
    const suffix = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${m} ${suffix}`;
  } catch (e) {
    return t24;
  }
};
import { useAppContext } from '../context/AppContext';
import { UserRole, EventStatus, ODRequestStatus } from '../types';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';
import ODRequestDetailModal from '../components/ODRequestDetailModal';
import EventDetailModal from '../components/EventDetailModal';
import cseDeptImg from '../assets/cse_b.jpg';
import seceHeader from '../assets/sece header.jpeg';

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
  const [copiedStates, setCopiedStates] = useState({});
  const [showAllEvents, setShowAllEvents] = useState(false);
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
      [UserRole.HR_TEAM]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.AUDIO_TEAM]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.SYSTEM_ADMIN]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.TRANSPORT_TEAM]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.BOYS_WARDEN]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.GIRLS_WARDEN]: EventStatus.PENDING_DEPARTMENTS,
      [UserRole.IQAC_TEAM]: EventStatus.PENDING_IQAC,
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
      if (currentUser.role === UserRole.HOD) return ev.status === EventStatus.PENDING_HOD;
      if (currentUser.role === UserRole.MEDIA) {
        const posterWorkflowStatus = String(ev.posterWorkflow?.status || '').toUpperCase();
        return ['REQUESTED', 'REWORK_REQUESTED'].includes(posterWorkflowStatus);
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
  }, [currentUser, events]);

  // For organizer: incoming registrations from students for their events
  const organizerIncomingOD = useMemo(() => {
    if (!currentUser) return [];
    return (currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY)
      ? odRequests.filter(r => r.organizerId === currentUser.id)
      : [];
  }, [currentUser, odRequests]);

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
  }, [organizerIncomingOD, currentUser]);

  const organizerEventsById = useMemo(() => (
    events.reduce((acc, ev) => {
      acc[ev.id] = ev;
      return acc;
    }, {})
  ), [events]);

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

  // Is this user a staff member?
  const isStaff = [
    UserRole.FACULTY, UserRole.HOD, UserRole.HR_TEAM,
    UserRole.AUDIO_TEAM, UserRole.SYSTEM_ADMIN, UserRole.TRANSPORT_TEAM,
    UserRole.BOYS_WARDEN, UserRole.GIRLS_WARDEN, UserRole.IQAC_TEAM
  ].includes(currentUser.role?.toUpperCase());

  // Filter OD requests for student view only
  const getFilteredODRequests = () => {
    const role = currentUser.role?.toUpperCase();
    if (role === UserRole.STUDENT_GENERAL || role === UserRole.STUDENT_ORGANIZER) {
      return odRequests
        .filter(r => r.studentId === currentUser.id)
        .sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));
    }
    return [];
  };

  const filteredODRequests = getFilteredODRequests();
  const pendingODCount = filteredODRequests.filter(r => r.status && r.status.startsWith('PENDING')).length;

  const pendingOrganizerOD = organizerIncomingOD.filter(r => r.status === 'PENDING_ORGANIZER');



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

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const shareDeptList = async (dept, students, eventTitle, eventDate) => {
    const listText = students.map((s, i) => `${i + 1}. ${s.studentName} (${s.rollNo}) - ${s.class}`).join('\n');
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
      return String(a.studentName || '').localeCompare(String(b.studentName || ''));
    });

    const classCounts = sortedStudents.reduce((acc, s) => {
      acc[s.class] = (acc[s.class] || 0) + 1;
      return acc;
    }, {});
    const renderedClasses = new Set();
    let hodRendered = false;

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

    const listHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title></title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { 
      size: A4; 
      margin: 0; 
    }
    body { 
      font-family: 'Times New Roman', Times, serif; 
      color: #1a202c; 
      background: #fff; 
      padding: 18mm 15mm;
    }
    .header { border-bottom: 3px double #1a3a6b; margin-bottom: 25px; padding-bottom: 12px; }
    .header-image { width: 100%; max-height: 90px; object-fit: contain; }
    .doc-title { text-align: center; font-size: 16pt; font-weight: bold; color: #1a3a6b; margin-top: 15px; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-info { margin-bottom: 25px; font-size: 13pt; line-height: 1.6; color: #2d3748; border: 1px solid #cbd5e0; padding: 20px; border-radius: 8px; background: #f8fafc; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #cbd5e0; }
    th, td { border: 1px solid #cbd5e0; padding: 10px 12px; text-align: left; font-size: 10pt; }
    th { background-color: #f1f5f9; color: #1e293b; font-weight: bold; text-transform: uppercase; font-size: 9pt; }
    .sig-cell { vertical-align: middle; text-align: center; color: #718096; font-size: 8pt; font-weight: normal; background: #fff !important; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer { margin-top: 40px; font-size: 9.5pt; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
    .sig-space { margin-top: 50px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 40px 20px; align-items: flex-end; }
    .sig-box { text-align: center; }
    .sig-label { font-size: 10pt; font-weight: bold; margin-top: 8px; color: #1e293b; }
    
    .e-stamp {
      display: inline-block;
      border: 2px solid #059669;
      border-radius: 8px;
      padding: 6px 12px;
      background: #ecfdf5;
      margin-bottom: 4px;
      min-width: 140px;
    }
    .e-stamp .check { font-size: 16pt; color: #059669; display: block; line-height: 1; margin-bottom: 2px; }
    .e-stamp .esigned { font-size: 8pt; font-weight: bold; color: #059669; text-transform: uppercase; letter-spacing: 0.5px; }
    .e-stamp .ename { font-size: 10pt; font-weight: bold; color: #1a3a6b; display: block; margin-top: 4px; }
    .e-stamp .edate { font-size: 8pt; color: #475569; font-family: 'Courier New', monospace; display: block; }
    
    .sig-line { border-top: 1.5px solid #1e293b; width: 180px; margin: 30px auto 5px; }

    @media print {
      body { padding: 0; }
      .meta-info { background: #fff !important; }
      th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
      .e-stamp { background: #ecfdf5 !important; border-color: #059669 !important; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="${seceHeader}" alt="Sri Eshwar College header" class="header-image" />
    <div class="doc-title">Approved On-Duty (OD) Participant List</div>
  </div>
  
  <div class="meta-info">
    <div style="display: flex; justify-content: space-between;">
      <span><strong>Event Title:</strong> ${group.eventTitle}</span>
      <span><strong>Event Date:</strong> ${displayDate}</span>
    </div>
    <div style="margin-top: 10px; display: flex; justify-content: space-between;">
      <span><strong>Department:</strong> ${dept}</span>
      <span><strong>Total Students:</strong> ${students.length}</span>
    </div>
    <div style="margin-top: 10px;">
      <strong>Academic Year:</strong> ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}
    </div>
  </div>

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
      ${sortedStudents.map((s, i) => {
        const isFirstInClass = !renderedClasses.has(s.class);
        if (isFirstInClass) renderedClasses.add(s.class);
        const isFirstRow = !hodRendered;
        if (isFirstRow) hodRendered = true;

        return `
        <tr>
          <td>${i + 1}</td>
          <td style="font-weight: bold; color: #1e293b;">${s.studentName}</td>
          <td style="font-family: 'Courier New', monospace; font-weight: 600;">${s.rollNo}</td>
          <td>${s.class}</td>
          ${isFirstInClass ? `<td rowspan="${classCounts[s.class]}" class="sig-cell"></td>` : ''}
          ${isFirstRow ? `<td rowspan="${sortedStudents.length}" class="sig-cell"></td>` : ''}
        </tr>
      `;
      }).join('')}
    </tbody>
  </table>

  <div class="sig-space" style="display: flex; justify-content: flex-end; margin-top: 60px;">
    <!-- Organizer Signature -->
    <div class="sig-box" style="width: 200px; text-align: center;">
      <div class="sig-line"></div>
      <div class="sig-label">
        <strong>Event Organizer Signature</strong><br/>
        ${currentUser?.name || ''}<br/>
        ${currentUser?.rollNo || ''}
      </div>
    </div>
  </div>

  <div class="footer">
    This document is digitally verified by the CSE Event Management Portal.<br/>
    Authorized for On-Duty (OD) attendance purposes.
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to download the OD list.');
      return;
    }
    printWindow.document.write(listHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50/50">
      <Navbar />

      <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
        <div className="max-w-7xl mx-auto px-6 py-8 pb-20">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h2>
              <p className="text-slate-500 font-medium mt-1">Manage and track your department events.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/explore')}
                className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              >
                <Calendar size={18} /> Explore Events
              </button>
              {canCreateEvent && (
                <button
                  onClick={() => navigate('/create-event')}
                  className="px-6 py-2.5 bg-cse-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-blue-900/10 active:scale-95"
                >
                  <Plus size={18} /> Create Event
                </button>
              )}
              {isStaff && (
                <button
                  onClick={() => navigate('/manage-students')}
                  className="px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                >
                  <Users size={18} /> Manage Students
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {(() => {
                  const isOrg = currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY;
                  const isStud = currentUser.role === UserRole.STUDENT_GENERAL;
                  
                  // Base events for counts
                  const baseEvents = isOrg ? events.filter(e => e.organizerId === currentUser.id) : events;
                  
                  // Value mapping based on role
                  const getStatItems = () => {
                    const stats = [];

                    // 1. TOTAL EVENTS
                    stats.push({
                      label: isOrg ? 'My Total Events' : (isStud ? 'Available Events' : 'Total Events'),
                      value: isStud ? events.filter(e => e.status === EventStatus.POSTED).length : baseEvents.length,
                      icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50'
                    });

                    // 2. POSTED / ACTIVE
                    stats.push({
                      label: 'Posted',
                      value: baseEvents.filter(e => e.status === EventStatus.POSTED || e.status === EventStatus.APPROVED).length,
                      icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50'
                    });

                    // 3. PENDING
                    stats.push({
                      label: isStaff ? (currentUser.role === UserRole.FACULTY ? 'Pending Review' : 'My Queue') : (isStud ? 'My Pending ODs' : 'Pending'),
                      value: isStaff 
                        ? (currentUser.role === UserRole.FACULTY 
                            ? filteredEvents.filter(e => e.status === EventStatus.PENDING_FACULTY).length 
                            : filteredEvents.length)
                        : (isStud ? filteredODRequests.filter(r => r.status && r.status.startsWith('PENDING')).length : baseEvents.filter(e => e.status?.startsWith('PENDING')).length),
                      icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50'
                    });

                    // 4. COMPLETED
                    stats.push({
                      label: isStud ? 'My Completed ODs' : 'Completed',
                      value: isStud 
                        ? filteredODRequests.filter(r => r.status === 'APPROVED' && events.find(e => e.id === r.eventId)?.status === EventStatus.COMPLETED).length
                        : baseEvents.filter(e => e.status === EventStatus.COMPLETED).length,
                      icon: FileCheck, color: 'text-slate-600', bg: 'bg-slate-100'
                    });

                    // 5. REJECTED
                    stats.push({
                      label: isStud ? 'My Rejected ODs' : 'Rejected',
                      value: isStud ? filteredODRequests.filter(r => r.status === 'REJECTED').length : baseEvents.filter(e => e.status === EventStatus.REJECTED).length,
                      icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-50'
                    });

                    // 6. REGISTRATIONS / PARTICIPANTS
                    if (isOrg) {
                      stats.push({
                        label: 'Total Participants',
                        value: organizerIncomingOD.length,
                        icon: Users, color: 'text-purple-600', bg: 'bg-purple-50'
                      });
                    } else if (isStud) {
                      stats.push({
                        label: 'My Total ODs',
                        value: filteredODRequests.length,
                        icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50'
                      });
                    } else {
                      // For other staff, maybe show global registrations or a filler
                      stats.push({
                        label: 'Total Registrations',
                        value: odRequests.length,
                        icon: Users, color: 'text-purple-600', bg: 'bg-purple-50'
                      });
                    }

                    return stats;
                  };

                  return getStatItems().map((stat, i) => (
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

                {/* Fixed-height scrollable container for tab content */}
                <div className="h-[385px] overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  {/* Events Tab Content */}
                  {(activeTab === 'events' || activeTab === 'approvals') && (() => {
                    let displayEvents = [];
                    if (activeTab === 'events') {
                      displayEvents = currentUser.role === UserRole.FACULTY ? events.filter(e => e.organizerId === currentUser.id) : filteredEvents;
                    } else if (activeTab === 'approvals') {
                      displayEvents = events.filter(e => e.status === EventStatus.PENDING_FACULTY);
                    }

                    const totalEventCount = displayEvents.length;
                    const EVENT_DISPLAY_LIMIT = 3;
                    const needsPagination = !showAllEvents && totalEventCount > EVENT_DISPLAY_LIMIT;
                    const limitedEvents = needsPagination ? displayEvents.slice(0, EVENT_DISPLAY_LIMIT) : displayEvents;

                    return (
                      <div className="flex flex-col h-full">
                        <div className="divide-y divide-slate-100">
                          {limitedEvents.map(event => (
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
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-bold border ${event.creatorType === 'FACULTY' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                        }`}>
                                        {event.creatorType === 'FACULTY' ? 'Faculty Event' : 'Student Event'}
                                      </span>
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <MapPin size={12} /> {event.venue}
                                      </span>
                                      <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <Clock size={12} /> {event.date} · {formatTime12(event.startTime)}
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
                                    // Use eventEndDate (not startDate) for correct multi-day event support
                                    const endDate = event.requisition?.step1?.eventEndDate || event.date;
                                    const endTime = event.requisition?.step1?.eventEndTime || event.endTime;
                                    if (!endDate || !endTime) return null;
                                    const eventEnd = new Date(`${endDate}T${endTime}`);
                                    if (isNaN(eventEnd.getTime())) return null;
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
                                  {(currentUser.role === UserRole.STUDENT_ORGANIZER || currentUser.role === UserRole.FACULTY || currentUser.role === UserRole.IQAC_TEAM) && event.iqacSubmittedAt && (
                                    <div className="flex items-center gap-2">
                                      <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                        <FileCheck size={12} /> IQAC Submitted
                                      </span>
                                      {currentUser.role === UserRole.IQAC_TEAM && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); navigate('/explore', { state: { openIQAC: event.id } }); }}
                                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
                                        >
                                          View Responses
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {displayEvents.length === 0 && (
                          <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                              <Calendar size={32} />
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
                        {needsPagination && (
                          <div className="p-4 bg-slate-50 border-t border-slate-100 mt-auto">
                            <button
                              onClick={() => setShowAllEvents(true)}
                              className="w-full py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-cse-accent hover:bg-cse-accent hover:text-white hover:border-cse-accent transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                              View All Events ({totalEventCount}) <ChevronDown size={14} />
                            </button>
                          </div>
                        )}
                        {showAllEvents && totalEventCount > EVENT_DISPLAY_LIMIT && (
                          <div className="p-4 bg-slate-50 border-t border-slate-100 mt-auto">
                            <button
                              onClick={() => setShowAllEvents(false)}
                              className="w-full py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                              Show Less
                            </button>
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
                                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${req.registrationType === 'VOLUNTEER' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
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
                                      <span className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border shadow-sm ${req.status === 'APPROVED'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-red-50 text-red-700 border-red-200'
                                        }`}>
                                        {req.status === 'APPROVED' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
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
                                className={`w-full transition-all duration-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left border ${isExpanded
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

                                  {/* ── Approved OD Lists by Department ── */}
                                  {(() => {
                                    const approvedRequests = group.requests.filter(r => r.status === 'APPROVED' && (r.registrationType || 'PARTICIPANT') === 'PARTICIPANT');
                                    if (approvedRequests.length === 0) return null;

                                    const byDept = approvedRequests.reduce((acc, r) => {
                                      // Priority 1: Use student's explicit department if available
                                      let d = r.department ? r.department.toUpperCase().trim() : '';
                                      
                                      // Priority 2: Try to extract from the class/section name
                                      if (!d && r.class) {
                                        const cls = r.class.toUpperCase();
                                        if (cls.includes('CSE')) d = 'CSE';
                                        else if (cls.includes('ECE')) d = 'ECE';
                                        else if (cls.includes('EEE')) d = 'EEE';
                                        else if (cls.includes('IT')) d = 'IT';
                                        else if (cls.includes('MECH')) d = 'MECH';
                                        else if (cls.includes('CIVIL')) d = 'CIVIL';
                                        else if (cls.includes('AIDS') || cls.includes('AI&DS') || cls.includes('AI & DS') || (cls.includes('AI') && !cls.includes('CIVIL'))) d = 'AI & DS';
                                        else d = r.class.replace(/[0-9]/g, '').replace(/-/g, '').trim() || 'General';
                                      }

                                      if (!d) d = 'General';

                                      if (!acc[d]) acc[d] = [];
                                      acc[d].push(r);
                                      return acc;
                                    }, {});

                                    return (
                                      <div className="mt-8 border-t-2 border-slate-100 pt-6">
                                        <div className="flex items-center gap-2 mb-4">
                                          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                                            <ClipboardCopy size={18} />
                                          </div>
                                          <div>
                                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Approved Participant OD Lists by Dept</h4>
                                            <p className="text-[10px] text-slate-500 font-medium">Grouped and ready to send to respectivos HODs</p>
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {Object.entries(byDept).sort().map(([dept, students]) => {
                                            const listText = students.map((s, i) => `${i + 1}. ${s.studentName} (${s.rollNo}) - ${s.class}`).join('\n');
                                            const copyKey = `${groupKey}-${dept}`;
                                            const isCopied = copiedStates[copyKey];

                                            return (
                                              <div key={dept} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-xs font-bold text-slate-700 uppercase">{dept}</span>
                                                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">{students.length}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <button
                                                      onClick={() => downloadDeptListAsPDF(dept, students, group)}
                                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white text-blue-600 hover:bg-blue-50 border border-slate-200 transition-all shadow-sm"
                                                      title="Download as PDF"
                                                    >
                                                      <Download size={12} /> Download
                                                    </button>
                                                    <button
                                                      onClick={() => shareDeptList(dept, students, group.eventTitle, group.eventDate)}
                                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-all shadow-sm"
                                                      title="Share List"
                                                    >
                                                      <ArrowUpRight size={12} /> Share
                                                    </button>
                                                    <button
                                                      onClick={() => copyToClipboard(`APPROVED PARTICIPANT OD LIST: ${group.eventTitle}\nDATE: ${group.eventDate || '-'}\nDEPARTMENT: ${dept}\n\n${listText}`, copyKey)}
                                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${isCopied
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                                        }`}
                                                    >
                                                      {isCopied ? (
                                                        <><Check size={12} /> Copied!</>
                                                      ) : (
                                                        <><Copy size={12} /> Copy</>
                                                      )}
                                                    </button>
                                                  </div>
                                                </div>
                                                <div className="p-3 max-h-40 overflow-y-auto">
                                                  <ol className="space-y-1.5">
                                                    {students.map((s, idx) => (
                                                      <li key={s.id} className="text-xs text-slate-600 flex items-start gap-2">
                                                        <span className="text-[10px] font-bold text-slate-400 mt-0.5 w-4 shrink-0">{idx + 1}.</span>
                                                        <div className="min-w-0">
                                                          <span className="font-semibold text-slate-800">{s.studentName}</span>
                                                          <span className="text-[10px] text-slate-500 ml-1.5">{s.rollNo} · {s.class}</span>
                                                        </div>
                                                      </li>
                                                    ))}
                                                  </ol>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
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
                                 <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                    <Clock size={12} />
                                    {request.eventDate}
                                 </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${request.status === ODRequestStatus.APPROVED
                                ? 'bg-emerald-50 text-emerald-600'
                                : request.status === ODRequestStatus.REJECTED
                                  ? 'bg-red-50 text-red-600'
                                  : request.status === ODRequestStatus.WITHDRAWN
                                    ? 'bg-slate-100 text-slate-400 line-through'
                                    : 'bg-amber-50 text-amber-600'
                                }`}>
                                {(request.status || '').replace(/_/g, ' ')}
                              </span>
                              {(request.status === ODRequestStatus.APPROVED || (request.status && request.status.startsWith('PENDING'))) && (
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
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions (Context-Aware for All Users) */}
              <div className="glass-panel rounded-2xl p-6 space-y-3">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Plus size={18} className="text-cse-accent" /> Quick Actions
                </h3>
                
                {/* 1. Explore Events - For Everyone */}
                <div
                  onClick={() => navigate('/explore')}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-cse-accent/40 hover:bg-cse-accent/5 transition-all group"
                >
                  <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-cse-accent group-hover:text-white transition-all">
                    <Calendar size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">Explore Events</p>
                    <p className="text-xs text-slate-500 font-medium">Browse department events</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-cse-accent" />
                </div>

                {/* 2. Create Event - For Faculty and Approved Student Organizers */}
                {(currentUser.role === UserRole.FACULTY || currentUser.isApprovedOrganizer) && (
                  <div
                    onClick={() => navigate('/create-event')}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-cse-accent/40 hover:bg-cse-accent/5 transition-all group"
                  >
                    <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-cse-accent group-hover:text-white transition-all">
                      <Plus size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">Create Event</p>
                      <p className="text-xs text-slate-500 font-medium">Submit new proposal</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-cse-accent" />
                  </div>
                )}

                {/* 3. Manage Students - For Staff (merged into quick actions) */}
                {isStaff && (
                  <div
                    onClick={() => navigate('/manage-students')}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-cse-accent/40 hover:bg-cse-accent/5 transition-all group"
                  >
                    <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-cse-accent group-hover:text-white transition-all">
                      <Users size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">Manage Students</p>
                      <p className="text-xs text-slate-500 font-medium">Grant organizer rights</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-cse-accent" />
                  </div>
                )}
              </div>

              {/* Quick Resources */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <ClipboardList size={18} className="text-cse-accent" /> Quick Resources
                </h3>
                <div className="space-y-1.5 mb-4">
                  {[
                    { label: 'Venue Booking Policy', href: '/resources/venue-booking-policy.html' },
                    { label: 'IQAC Guidelines', href: '/resources/iqac-guidelines.html' },
                    { label: 'Budget Templates', href: '/resources/budget-template.csv', download: true },
                    { label: 'Guest Protocol', href: '/resources/guest-protocol.html' },
                  ].map((item, idx, arr) => (
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
