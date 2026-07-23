import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
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
  subscribeToUsers,
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
  const [students, setStudents] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedODRequest, setSelectedODRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [organizerRequests, setOrganizerRequests] = useState([
    { id: 's2', name: 'Jane Smith', status: 'pending' }
  ]);

  // Manual fetch for students and users (Phase 2 architecture)
  const loadStudents = React.useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await import('../services/firebaseService').then(m => m.fetchStudentsDirect(currentUser));
      setStudents(data);
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  }, [currentUser]);

  const loadUsers = React.useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await import('../services/firebaseService').then(m => m.fetchUsersDirect());
      setStaffUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [currentUser]);

  const refreshStudents = loadStudents;
  const refreshUsers = loadUsers;

  // Subscribe to real-time updates from Firebase for OD Requests (temporary until Phase 4)
  useEffect(() => {
    if (!currentUser) {
      setODRequests([]);
      setStudents([]);
      setStaffUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // OD Requests are now handled by ODWorkflowProvider and useMyODs in Phase 4.
    setLoading(false);

    return () => {
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.department]);

  // Real-time sync for currentUser if they are a student — patch ONLY OD fields from the live DB snapshot
  useEffect(() => {
    if (!currentUser) return;
    const isStudent = currentUser.role === 'STUDENT_GENERAL' || currentUser.role === 'STUDENT_ORGANIZER';
    if (!isStudent || students.length === 0) return;

    const updatedStudent = students.find(s => 
      (s.rollNo && currentUser.rollNo && s.rollNo === currentUser.rollNo) || 
      s.id === currentUser.id
    );
    if (!updatedStudent) return;

    const odChanged =
      updatedStudent.odUsed !== currentUser.odUsed ||
      updatedStudent.odLimit !== currentUser.odLimit ||
      updatedStudent.odResetTimestamp !== currentUser.odResetTimestamp;

    if (odChanged) {
      const patched = {
        ...currentUser,
        odUsed: updatedStudent.odUsed ?? currentUser.odUsed,
        odLimit: updatedStudent.odLimit ?? currentUser.odLimit,
        odResetTimestamp: updatedStudent.odResetTimestamp ?? currentUser.odResetTimestamp,
      };
      setCurrentUser(patched);
      localStorage.setItem('currentUser', JSON.stringify(patched));
    }
  }, [students]);

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
    localStorage.removeItem('sessionToken');
    sessionStorage.clear();
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

  const handleApproval = async (event, approve, rejectionReason = '') => {
    if (!event) {
      throw new Error(`Event not found`);
    }

    const eventId = event.id;

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
        body.rejectedByName = String(currentUser?.name || 'Unknown Approver');
        body.rejectedByDept = String(currentUser?.department || 'N/A');
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${eventId}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
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
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/events/${eventId}/department-approval`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
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

  const handleODApproval = async (request, approve, approverInfo = {}, odLetterBase64 = null, remarks = '') => {
    if (!request || !request.id) return;

    let newStatus;
    if (!approve) {
      newStatus = ODRequestStatus.REJECTED;
    } else {
      switch (request.status) {
        case ODRequestStatus.PENDING_FACULTY:
          newStatus = ODRequestStatus.PENDING_HOD;
          break;
        case ODRequestStatus.PENDING_HOD:
          newStatus = ODRequestStatus.PENDING_IQAC;
          break;
        case ODRequestStatus.PENDING_IQAC:
          newStatus = ODRequestStatus.APPROVED;
          break;
        default:
          return;
      }
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com'}/api/od-requests/${request.id}/status`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({
          status: newStatus,
          approvedBy: approverInfo.name || currentUser?.name || 'Authorized Personnel',
          odLetterBase64: odLetterBase64,
          remarks: remarks
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update OD status');
      }
    } catch (error) {
      console.error('Error updating OD request:', error);
      throw error;
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
    students,
    staffUsers,
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
    setStudents,
    setStaffUsers,
    loadStudents,
    refreshStudents,
    loadUsers,
    refreshUsers
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
