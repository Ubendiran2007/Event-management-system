import { collection, getDocs, doc, getDoc, query, orderBy, onSnapshot, limit, startAfter, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { where } from './firebaseService';
import { ODRequestStatus, UserRole } from '../types';

const logQuery = (name, docsCount, realtime, startTime) => {
  if (import.meta.env.DEV) {
    const duration = performance.now() - startTime;
    console.log(`[odService] Query: ${name}, Documents: ${docsCount}, Realtime: ${realtime}, Duration: ${duration.toFixed(2)} ms`);
  }
};

/**
 * Fetches all OD requests for a specific student (historical and active).
 * Used by students to view their own OD history.
 */
export const fetchStudentODHistory = async (studentId) => {
  const startTime = performance.now();
  if (!studentId) {
    console.warn('[odService] fetchStudentODHistory called with invalid studentId');
    return [];
  }
  try {
    const q = query(
      collection(db, 'odRequests'),
      where('studentId', '==', studentId)
    );
    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logQuery('fetchStudentODHistory', requests.length, false, startTime);
    return requests;
  } catch (error) {
    console.error('Error in fetchStudentODHistory:', error);
    return [];
  }
};

/**
 * Fetches all OD requests for a specific event.
 * Used by organizers to track ODs for their event.
 */
export const fetchEventODs = async (eventId) => {
  const startTime = performance.now();
  if (!eventId) {
    console.warn('[odService] fetchEventODs called with invalid eventId');
    return [];
  }
  try {
    const q = query(
      collection(db, 'odRequests'),
      where('eventId', '==', eventId)
    );
    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logQuery('fetchEventODs', requests.length, false, startTime);
    return requests;
  } catch (error) {
    console.error('Error in fetchEventODs:', error);
    return [];
  }
};

/**
 * Fetches all OD requests broadly for analytics.
 * Supports parameterization for scalability (department, date range, etc).
 */
export const fetchAnalyticsODs = async (filters = {}) => {
  const startTime = performance.now();
  try {
    let q = collection(db, 'odRequests');
    
    // Example of future filter implementation:
    // const queryConstraints = [];
    // if (filters.department) queryConstraints.push(where('department', '==', filters.department));
    // if (queryConstraints.length > 0) q = query(q, ...queryConstraints);

    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logQuery('fetchAnalyticsODs', requests.length, false, startTime);
    return requests;
  } catch (error) {
    console.error('Error in fetchAnalyticsODs:', error);
    return [];
  }
};

/**
 * Subscribes to active OD workflows based on the user's role.
 * Used by Dashboard and NotificationCenter.
 */
export const subscribeToODWorkflows = (currentUser, callback) => {
  if (!currentUser) return () => {};
  const startTime = performance.now();
  
  let q;
  if (currentUser.role === UserRole.STUDENT_GENERAL || currentUser.role === UserRole.STUDENT_ORGANIZER) {
    // Students only need to track their active workflows (pending, or recently updated).
    // Note: If they want to see COMPLETED ODs they use fetchStudentODHistory.
    if (!currentUser.id) return () => {};
    q = query(collection(db, 'odRequests'), where('studentId', '==', currentUser.id));
  } else if (currentUser.role === UserRole.FACULTY || currentUser.role === UserRole.HOD) {
    // Faculty/HOD should only subscribe to pending requests in their department.
    if (!currentUser.department) {
      console.warn('[odService] Faculty/HOD missing department, cannot subscribe');
      return () => {};
    }
    // If your Firestore schema lacks 'department' on odRequests, you MUST add it for security/performance.
    // Assuming 'department' exists (as AppContext previously filtered by it client-side):
    q = query(
      collection(db, 'odRequests'),
      where('department', '==', currentUser.department),
      where('status', 'in', [ODRequestStatus.PENDING_FACULTY, ODRequestStatus.PENDING_HOD, ODRequestStatus.PENDING_IQAC])
    );
  } else if (currentUser.role === UserRole.IQAC_TEAM || currentUser.role === UserRole.SYSTEM_ADMIN) {
    // IQAC team watches for ODs pending IQAC approval
    q = query(
      collection(db, 'odRequests'),
      where('status', '==', ODRequestStatus.PENDING_IQAC)
    );
  } else {
    // Fallback for unexpected roles
    return () => {};
  }

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logQuery('subscribeToODWorkflows', requests.length, true, startTime);
    callback(requests);
  });

  return unsubscribe;
};
