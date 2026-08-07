import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where as fsWhere,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { Status } from '../types';
import { getAuthToken } from '../utils/api';

export const where = (field, op, value) => {
  if (value === undefined) {
    console.error(`[FIRESTORE FATAL] Frontend safeWhere() blocked undefined query on field: "${field}"`);
    return fsWhere(field, op, '__UNDEFINED_DATA_FLOW_ERROR__');
  }
  return fsWhere(field, op, value);
};

/**
 * Robust Firestore snapshot listener that automatically reconnects on transient failures
 * (like quota exhaustion or network unavailability) using exponential backoff with jitter.
 */
export const subscribeWithRetry = (queryOrRef, onNext, onError, options = {}) => {
  const { maxRetries = 10, baseDelay = 1000, maxDelay = 30000, collectionName = 'Unknown' } = options;
  
  let isUnsubscribed = false;
  let currentUnsubscribe = null;
  let retryCount = 0;
  let timeoutId = null;

  const cleanupListener = () => {
    if (currentUnsubscribe) {
      currentUnsubscribe();
      currentUnsubscribe = null;
    }
  };

  const connect = () => {
    if (isUnsubscribed) return;
    cleanupListener();

    currentUnsubscribe = onSnapshot(queryOrRef, (snapshot) => {
      if (isUnsubscribed) return;
      retryCount = 0; // Reset on success
      onNext(snapshot);
    }, (error) => {
      cleanupListener();
      if (isUnsubscribed) return;

      const code = error.code;
      const isTransient = 
        code === 'resource-exhausted' || 
        code === 'unavailable' || 
        code === 'deadline-exceeded' || 
        code === 'aborted';

      if (isTransient) {
        if (retryCount >= maxRetries) {
          console.error(`[Firestore] Max retries (${maxRetries}) reached for ${collectionName}. Failing.`);
          if (onError) onError(error);
          return;
        }

        // Exponential backoff with jitter to prevent reconnect storms
        const backoff = Math.min(maxDelay, baseDelay * Math.pow(2, retryCount));
        const jitter = Math.random() * (backoff * 0.5); 
        const delay = Math.floor(backoff + jitter);

        // Audit/Log the retry
        console.warn(`[Firestore] Snapshot Retry | Collection: ${collectionName} | Attempt: ${retryCount + 1} | Delay: ${delay}ms | Reason: ${code}`);

        // Pass transient error to UI in case it wants to show a temporary warning
        if (onError) onError({ ...error, isTransient: true, willRetryIn: delay });

        retryCount++;
        timeoutId = setTimeout(connect, delay);
      } else {
        // Fatal error (permission-denied, unauthenticated, etc)
        console.error(`[Firestore] Fatal listener error on ${collectionName}:`, error);
        if (onError) onError(error);
      }
    });
  };

  connect();

  // Return a standard unsubscribe function
  return () => {
    isUnsubscribed = true;
    cleanupListener();
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
};

// ==================== MASTER COLLECTIONS ====================
export const fetchDepartments = async () => {
  try {
    const q = query(collection(db, 'departments'), where('status', '==', Status.ACTIVE));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching departments:', error);
    return [];
  }
};

export const fetchAcademicBatches = async () => {
  try {
    const q = query(collection(db, 'academicBatches'), where('status', '==', Status.ACTIVE));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching academic batches:', error);
    return [];
  }
};

export const fetchSections = async (departmentId = null, batchId = null) => {
  try {
    let q = query(collection(db, 'sections'), where('status', '==', Status.ACTIVE));
    if (departmentId) q = query(q, where('departmentId', '==', departmentId));
    if (batchId) q = query(q, where('batchId', '==', batchId));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching sections:', error);
    return [];
  }
};

export const fetchVenues = async () => {
  try {
    const q = query(collection(db, 'venues'), where('status', '==', Status.ACTIVE));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching venues:', error);
    return [];
  }
};

export const fetchSystemSettings = async () => {
  try {
    const docRef = doc(db, 'systemSettings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return null;
  }
};

// ==================== STUDENTS ====================
const ALL_CLASSES = [
  'CSE-B', 'CSE-D',
  'ECE-A', 'ECE-B',
  'CCE-A',
  'CSBS-A',
  'MECH-A',
  'CYBER-A',
  'EEE-A',
  'AIML-A',
  'AIDS-A'
];

// Fetch all students
export const fetchStudents = async () => {
  try {
    const API_BASE = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'http://localhost:5001');
    const res = await fetch(`${API_BASE}/api/students`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.students || [];
  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
};

// Fetch students by class
export const fetchStudentsByClass = async (className) => {
  try {
    const membersSnapshot = await getDocs(collection(db, 'students', className, 'members'));
    return membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching students from class ${className}:`, error);
    return [];
  }
};

// Fetch all available classes
export const fetchClasses = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'students'));
    return snapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return [];
  }
};

export const getStudentById = async (studentId, className = null) => {
  try {
    const API_BASE = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'http://localhost:5001');
    const res = await fetch(`${API_BASE}/api/students`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data.students || []).find(s => s.id === studentId) || null;
  } catch (error) {
    console.error('Error getting student:', error);
    return null;
  }
};

export const updateStudentRole = async (studentId, role, className, isApprovedOrganizer = false) => {
  try {
    const studentRef = doc(db, 'students', className, 'members', studentId);
    await updateDoc(studentRef, { role, isApprovedOrganizer, updatedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    console.error('Error updating student role:', error);
    return false;
  }
};

// Authenticate student by username (email) and password (roll number)
export const authenticateStudent = async (username, password) => {
  if (!username || !password) {
    console.warn('authenticateStudent called with missing credentials');
    return null;
  }
  try {
    console.log('Authenticating student:', username);
    // Optimized: using collectionGroup query for the specific username instead of reading all students
    const membersGroup = collectionGroup(db, 'members');
    const q = query(membersGroup, where('username', '==', username), limit(1));
    const snapshot = await getDocs(q);
    
    // If no exact match (perhaps due to case), we fall back to parallel class-level queries 
    // to preserve existing case-insensitive behavior if the query doesn't catch it
    if (!snapshot.empty) {
      for (const memberDoc of snapshot.docs) {
        const student = memberDoc.data();
        if (student.password?.toUpperCase() === password.toUpperCase()) {
          const className = memberDoc.ref.parent.parent.id;
          console.log('Student authenticated successfully via collectionGroup:', student.name);
          return { id: memberDoc.id, ...student, className };
        }
      }
    }

    // Fallback: Case-insensitive search across all classes sequentially to minimize Firestore reads
    for (const className of ALL_CLASSES) {
      const membersSnapshot = await getDocs(collection(db, 'students', className, 'members'));
      for (const memberDoc of membersSnapshot.docs) {
        const student = memberDoc.data();
        if (
          student.username?.toLowerCase() === username.toLowerCase() &&
          student.password?.toUpperCase() === password.toUpperCase()
        ) {
          console.log('Student authenticated successfully (fallback):', student.name);
          return { id: memberDoc.id, ...student, className };
        }
      }
    }
    
    console.log('No matching student found');
    return null;
  } catch (error) {
    console.error('Error authenticating student:', error);
    return null;
  }
};


// ==================== USERS ====================
export const fetchUsers = async () => {
  try {
    const usersCollection = collection(db, 'users');
    const snapshot = await getDocs(usersCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};



// ==================== EVENTS ====================
export const fetchEvents = async () => {
  try {
    const eventsCollection = collection(db, 'events');
    const snapshot = await getDocs(eventsCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};

export const createEvent = async (eventData) => {
  try {
    const eventsCollection = collection(db, 'events');
    const docRef = await addDoc(eventsCollection, {
      ...eventData,
      createdAt: new Date().toISOString(),
    });
    return { id: docRef.id, ...eventData };
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};

export const updateEventStatus = async (eventId, status) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      status,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error updating event status:', error);
    throw error;
  }
};

export const saveIQACSubmission = async (eventId, iqacDocuments) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      status: 'COMPLETED',
      iqacSubmittedAt: new Date().toISOString(),
      iqacDocuments,
      needsFeedbackReminders: true,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('Error saving IQAC submission:', error);
    throw error;
  }
};

// ==================== OD REQUESTS ====================
export const fetchODRequests = async () => {
  try {
    const odCollection = collection(db, 'odRequests');
    const snapshot = await getDocs(odCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching OD requests:', error);
    return [];
  }
};

export const createODRequest = async (odData) => {
  try {
    const odCollection = collection(db, 'odRequests');
    const docRef = await addDoc(odCollection, {
      ...odData,
      status: 'PENDING_FACULTY',
      createdAt: new Date().toISOString(),
    });
    return { id: docRef.id, ...odData, status: 'PENDING_FACULTY' };
  } catch (error) {
    console.error('Error creating OD request:', error);
    throw error;
  }
};

export const updateODRequestStatus = async (requestId, status, approverInfo = {}) => {
  try {
    const odRef = doc(db, 'odRequests', requestId);
    await updateDoc(odRef, {
      status,
      ...approverInfo,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error updating OD request status:', error);
    throw error;
  }
};

export const getODRequestById = async (requestId) => {
  try {
    const docRef = doc(db, 'odRequests', requestId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching OD request:', error);
    return null;
  }
};

// ==================== REAL-TIME LISTENERS ====================
export const subscribeToODRequests = (currentUser, callback) => {
  if (!currentUser) return () => {};
  
  let q;
  if (currentUser.role === 'STUDENT_GENERAL' || currentUser.role === 'STUDENT_ORGANIZER') {
    if (!currentUser.id) return () => {};
    q = query(collection(db, 'odRequests'), where('studentId', '==', currentUser.id));
  } else {
    // For now, faculty and global roles still subscribe to all to do client-side filtering.
    // Optimization here would require a 'department' field on odRequests.
    q = collection(db, 'odRequests');
  }
  
  return subscribeWithRetry(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(requests);
  }, (err) => console.error(err), { collectionName: 'odRequests' });
};

export const subscribeToEvents = (currentUser, callback) => {
  if (!currentUser) return () => {};
  
  const eventsCollection = collection(db, 'events');
  let q = eventsCollection;
  
  // Example of strict filtering if they only need their department
  // If role is HOD or FACULTY, they usually only look at their department.
  // Note: HODs might need to see other departments if they are part of multi-department workflows,
  // but this query cuts down reads if they mostly stay in their lane.
  // For safety, we can just fetch all and let AppContext filter until complex OR queries are added.
  
  return subscribeWithRetry(q, (snapshot) => {
    const events = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    callback(events);
  }, (err) => console.error(err), { collectionName: 'events' });
};

let studentsFetchPromise = null;

export const fetchStudentsDirect = async (currentUser) => {
  // Students don't need the full student list — it's a staff-only endpoint.
  // Returning early prevents unauthorized 401 that loops them back to /login.
  if (currentUser?.role === 'STUDENT_GENERAL' || currentUser?.role === 'STUDENT_ORGANIZER') {
    return [];
  }

  if (studentsFetchPromise) return studentsFetchPromise;

  studentsFetchPromise = (async () => {
    try {
      console.log('Students API called');
      const token = getAuthToken();
      const API_BASE = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'http://localhost:5001');
      const res = await fetch(`${API_BASE}/api/students?limit=200`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.data || data.students || [];
      } else if (res.status === 401) {
        console.warn('[fetchStudentsDirect] 401 — session expired, clearing token');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        // Let React Router / ProtectedRoute handle the redirect — no hard reload
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      studentsFetchPromise = null;
    }
    return [];
  })();

  return studentsFetchPromise;
};

export const subscribeToStudents = (currentUser, callback) => {
  let isMounted = true;
  fetchStudentsDirect(currentUser).then(data => {
    if (isMounted) callback(data);
  });
  return () => {
    isMounted = false;
  };
};

let usersFetchPromise = null;

export const fetchUsersDirect = async () => {
  if (usersFetchPromise) return usersFetchPromise;

  usersFetchPromise = (async () => {
    try {
      console.log('Users API called');
      const token = getAuthToken();
      const API_BASE = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'http://localhost:5001');
      const res = await fetch(`${API_BASE}/api/users?limit=200`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.data || data.users || [];
      } else if (res.status === 401) {
        console.warn('[fetchUsersDirect] 401 — session expired, clearing token');
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        // Let React Router / ProtectedRoute handle the redirect — no hard reload
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      usersFetchPromise = null;
    }
    return [];
  })();

  return usersFetchPromise;
};

export const subscribeToUsers = (callback) => {
  let isMounted = true;
  fetchUsersDirect().then(data => {
    if (isMounted) callback(data);
  });
  return () => {
    isMounted = false;
  };
};

// ==========================================
// ACADEMIC CALENDAR LISTENERS
// ==========================================

export const subscribeToAcademicYears = (callback) => {
  return subscribeWithRetry(collection(db, 'academicYears'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (err) => console.error(err), { collectionName: 'academicYears' });
};

export const subscribeToSemesters = (callback) => {
  return subscribeWithRetry(collection(db, 'semesters'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (err) => console.error(err), { collectionName: 'semesters' });
};

export const subscribeToHolidays = (callback) => {
  return subscribeWithRetry(collection(db, 'holidays'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (err) => console.error(err), { collectionName: 'holidays' });
};

export const subscribeToExams = (callback) => {
  return subscribeWithRetry(collection(db, 'exams'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (err) => console.error(err), { collectionName: 'exams' });
};

export const subscribeToWorkingDays = (callback) => {
  return subscribeWithRetry(doc(db, 'settings', 'workingDays'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    } else {
      callback({}); // Return empty if not configured
    }
  }, (err) => console.error(err), { collectionName: 'workingDays' });
};

export const subscribeToDepartmentCalendar = (callback) => {
  return subscribeWithRetry(collection(db, 'departmentCalendar'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (err) => console.error(err), { collectionName: 'departmentCalendar' });
};

export const subscribeToAcademicBatches = (callback) => {
  const q = query(collection(db, 'academicBatches'));
  return subscribeWithRetry(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (err) => console.error(err), { collectionName: 'events' });
};
