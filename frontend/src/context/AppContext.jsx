import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { EventStatus, ODRequestStatus, UserRole } from '../types';
import {
  fetchEvents,
  fetchStudents,
  fetchODRequests,
  createEvent as createEventInDB,
  updateEventStatus,
  saveIQACSubmission,
  createODRequest as createODRequestInDB,
  updateODRequestStatus,
  updateStudentRole,
  subscribeToEvents,
  subscribeToODRequests,
  subscribeToStudents,
} from '../services/firebaseService';

const AppContext = createContext(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [events, setEvents] = useState([]);
  const [students, setStudents] = useState([]);
  const [odRequests, setODRequests] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedODRequest, setSelectedODRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  // IDs confirmed to not exist on the Firestore server — filtered out of every snapshot
  const ghostIdsRef = useRef(new Set());
  const [organizerRequests, setOrganizerRequests] = useState([
    { id: 's2', name: 'Jane Smith', status: 'pending' }
  ]);

  // Subscribe to real-time updates from Firebase
  useEffect(() => {
    setLoading(true);

    // Subscribe to events — filter out any known ghost IDs on every delivery
    const unsubscribeEvents = subscribeToEvents((fetchedEvents) => {
      const filtered = ghostIdsRef.current.size
        ? fetchedEvents.filter(e => !ghostIdsRef.current.has(e.id))
        : fetchedEvents;
      setEvents(filtered);
    });

    // Subscribe to OD requests
    const unsubscribeOD = subscribeToODRequests((fetchedOD) => {
      setODRequests(fetchedOD);
    });

    // Subscribe to students
    const unsubscribeStudents = subscribeToStudents((fetchedStudents) => {
      setStudents(fetchedStudents);
      setLoading(false);
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeEvents();
      unsubscribeOD();
      unsubscribeStudents();
    };
  }, []);

  const handleLogin = (user) => {
    const formattedUser = user ? { ...user, role: user.role?.toUpperCase() } : user;
    setCurrentUser(formattedUser);
    if (formattedUser) {
      localStorage.setItem('currentUser', JSON.stringify(formattedUser));
    } else {
      localStorage.removeItem('currentUser');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const createEvent = async (newEvent) => {
    try {
      // If the creator is Faculty, skip Faculty approval step and go directly to HOD
      const isFacultyOrganizer = currentUser?.role === UserRole.FACULTY;
      const createdEvent = await createEventInDB({
        ...newEvent,
        status: isFacultyOrganizer ? EventStatus.PENDING_HOD : EventStatus.PENDING_FACULTY,
        creatorType: isFacultyOrganizer ? 'FACULTY' : 'STUDENT',
      });
      return createdEvent;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  };

  const handleApproval = async (eventId, approve, rejectionReason = '') => {
    const event = events.find(e => e.id === eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    let newStatus;
    if (!approve) {
      newStatus = EventStatus.REJECTED;
    } else {
      switch (event.status) {
        case EventStatus.PENDING_FACULTY:
          newStatus = EventStatus.PENDING_HOD;
          break;
        case EventStatus.PENDING_HOD:
          // Immediately route to departments
          newStatus = EventStatus.PENDING_DEPARTMENTS;
          break;
        case EventStatus.PENDING_DEPARTMENTS:
          newStatus = EventStatus.PENDING_IQAC;
          break;
        case EventStatus.PENDING_IQAC:
          newStatus = EventStatus.POSTED;
          break;
        default:
          throw new Error(`Unexpected event status: ${event.status}`);
      }
    }

    try {
      const body = {
        status: newStatus,
        approvedBy: currentUser?.name || 'Unknown Approver',
      };

      if (!approve) {
        body.rejectionReason = String(rejectionReason || '').trim();
        body.rejectedByRole = String(currentUser?.role || 'UNKNOWN').toUpperCase();
      }

      const response = await fetch(`http://localhost:5001/api/events/${eventId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update event status');
      }
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('event not found')) {
        ghostIdsRef.current.add(eventId); // blacklist so future snapshots skip it
        setEvents(prev => prev.filter(e => e.id !== eventId));
        throw new Error('GHOST_EVENT');
      }
      throw error;
    }
  };

  const handleDepartmentApproval = async (eventId, department, status = 'APPROVED', reason = '') => {
    try {
      const response = await fetch(`http://localhost:5001/api/events/${eventId}/department-approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department,
          approvedBy: currentUser?.name || 'Unknown Approver',
          status,
          reason,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update department approval');
      }
    } catch (error) {
      console.error('Error updating department approval:', error);
      throw error;
    }
  };

  // OD Request functions
  const createODRequest = async (odData) => {
    try {
      const createdOD = await createODRequestInDB(odData);
      return createdOD;
    } catch (error) {
      console.error('Error creating OD request:', error);
      throw error;
    }
  };

  const handleODApproval = async (requestId, approve, approverInfo = {}) => {
    const request = odRequests.find(r => r.id === requestId);
    if (!request) return;

    let newStatus;
    if (!approve) {
      newStatus = ODRequestStatus.REJECTED;
    } else {
      switch (request.status) {
        case ODRequestStatus.PENDING_FACULTY:
          newStatus = ODRequestStatus.PENDING_HOD;
          break;
        case ODRequestStatus.PENDING_HOD:
          newStatus = ODRequestStatus.PENDING_PRINCIPAL;
          break;
        case ODRequestStatus.PENDING_PRINCIPAL:
          newStatus = ODRequestStatus.APPROVED;
          break;
        default:
          return;
      }
    }

    try {
      await updateODRequestStatus(requestId, newStatus, {
        [`${request.status.replace('PENDING_', '').toLowerCase()}ApprovedBy`]: approverInfo.name,
        [`${request.status.replace('PENDING_', '').toLowerCase()}ApprovedAt`]: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating OD request:', error);
    }
  };

  const approveOrganizer = (studentId) => {
    setOrganizerRequests(organizerRequests.map(req =>
      req.id === studentId ? { ...req, status: 'approved' } : req
    ));
  };

  // Grant event organizer privilege to a student
  const makeEventOrganizer = async (studentId) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    setStudents(prev => prev.map(s =>
      s.id === studentId ? { ...s, role: UserRole.STUDENT_ORGANIZER, isApprovedOrganizer: true } : s
    ));
    // Convert "CSE A" to "CSE-A" format for path
    const className = student.class.replace(/\s+/g, '-');
    await updateStudentRole(studentId, UserRole.STUDENT_ORGANIZER, className, true);
  };

  // Revoke event organizer privilege from a student
  const revokeOrganizer = async (studentId) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    setStudents(prev => prev.map(s =>
      s.id === studentId ? { ...s, role: UserRole.STUDENT_GENERAL, isApprovedOrganizer: false } : s
    ));
    // Convert "CSE A" to "CSE-A" format for path
    const className = student.class.replace(/\s+/g, '-');
    await updateStudentRole(studentId, UserRole.STUDENT_GENERAL, className, false);
  };

  const completeEvent = async (eventId, iqacDocuments) => {
    try {
      if (iqacDocuments) {
        await saveIQACSubmission(eventId, iqacDocuments);
      } else {
        await updateEventStatus(eventId, EventStatus.COMPLETED);
      }
    } catch (error) {
      console.error('Error completing event:', error);
      throw error;
    }
  };

  const value = {
    currentUser,
    events,
    students,
    odRequests,
    selectedEvent,
    selectedODRequest,
    organizerRequests,
    loading,
    setSelectedEvent,
    setSelectedODRequest,
    handleLogin,
    handleLogout,
    createEvent,
    handleApproval,
    createODRequest,
    handleODApproval,
    approveOrganizer,
    makeEventOrganizer,
    revokeOrganizer,
    completeEvent,
    handleDepartmentApproval,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
