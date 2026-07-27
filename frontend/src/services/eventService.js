import { collection, getDocs, doc, getDoc, query, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { where, subscribeWithRetry } from './firebaseService';
import { getAuthToken } from '../utils/api';

/**
 * EVENT OWNERSHIP MATRIX
 * Query        | Owner           | Realtime
 * -------------------------------------------
 * Dashboard    | Dashboard       | ✅
 * Organizer    | Tracking        | ✅
 * Explore      | Explore         | ❌
 * Calendar     | Calendar        | ❌
 * Analytics    | Analytics       | ❌
 * Venue        | Create Event    | ❌
 */

const logQuery = (name, docsCount, realtime, startTime) => {
  if (import.meta.env.DEV) {
    const duration = performance.now() - startTime;
    console.log(`[eventService]
Query: ${name}
Documents: ${docsCount}
Realtime: ${realtime}
Duration: ${duration.toFixed(2)} ms`);
  }
};

const eventsCollection = collection(db, 'events');

// ==================== STATIC FETCHES ====================

export const fetchExploreEvents = async (currentUser, cursor = null, pageSize = 20) => {
  const startTime = performance.now();
  try {
    const token = getAuthToken();
    const baseUrl = import.meta.env.VITE_BACKEND_URL || 'https://event-management-system-dpzc.onrender.com';
    
    let url = `${baseUrl}/api/events/explore?pageSize=${pageSize}`;
    if (cursor) {
      url += `&lastEventId=${cursor}`;
    }

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error('Failed to fetch explore events from backend');
    }

    const data = await res.json();
    logQuery('Explore (Backend API)', data.events?.length || 0, false, startTime);
    
    return {
      events: data.events || [],
      nextCursor: data.nextCursor || null,
      hasMore: data.hasMore || false
    };
  } catch (err) {
    console.error('Error fetching explore events via API:', err);
    return { events: [], nextCursor: null, hasMore: false };
  }
};

export const fetchCalendarEvents = async () => {
  const startTime = performance.now();
  try {
    const q = query(
      eventsCollection,
      where('status', 'in', ['POSTED', 'COMPLETED'])
    );
    const snapshot = await getDocs(q);
    logQuery('Calendar', snapshot.size, false, startTime);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error fetching calendar events:', err);
    return [];
  }
};

export const fetchAnalyticsEvents = async (filters = {}) => {
  const startTime = performance.now();
  try {
    // Designed for future backend pagination/filtering. 
    // For now, fetches all events for analytics parsing.
    const snapshot = await getDocs(eventsCollection);
    let events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Future-proofing client-side filters
    if (filters.academicYear) {
      events = events.filter(e => e.academicYear === filters.academicYear);
    }
    if (filters.department) {
      events = events.filter(e => e.department === filters.department);
    }
    
    logQuery('Analytics', snapshot.size, false, startTime);
    return events;
  } catch (err) {
    console.error('Error fetching analytics events:', err);
    return [];
  }
};

export const checkVenueAvailability = async (dateStr, venue) => {
  const startTime = performance.now();
  if (!dateStr || !venue) return false;
  try {
    // Only check active events that have a date
    const q = query(
      eventsCollection,
      where('date', '==', dateStr)
    );
    const snapshot = await getDocs(q);
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter by venue and active status client-side
    const booked = events.filter(e => 
      e.venue === venue && 
      !['REJECTED', 'CANCELLED'].includes(e.status)
    );
    
    logQuery('Venue', snapshot.size, false, startTime);
    return booked.length > 0;
  } catch (err) {
    console.error('Error checking venue:', err);
    return false;
  }
};

// ==================== REALTIME SUBSCRIPTIONS ====================

export const subscribeToWorkflowEvents = (currentUser, callback) => {
  if (!currentUser) return () => {};
  
  const startTime = performance.now();
  
  // Students do not require global workflow events (handled by OrganizerEventsContext)
  if (currentUser.role === 'STUDENT_ORGANIZER' || currentUser.role === 'STUDENT_GENERAL') {
    callback([]);
    return () => {};
  }

  // ── Scoped queries by role to minimize Firestore reads ────────────────────
  // FACULTY: only their own events (as organizer) + events pending their review
  if (currentUser.role === 'FACULTY') {
    const q = query(
      eventsCollection,
      where('organizerId', '==', currentUser.id)
    );
    return subscribeWithRetry(q, (snapshot) => {
      logQuery(`Dashboard/Workflow (FACULTY:own)`, snapshot.size, true, startTime);
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error(err), { collectionName: 'events' });
  }

  // HOD: only their department's events (scoped by department field)
  if (currentUser.role === 'HOD' && currentUser.department) {
    const deptStatuses = [
      'PENDING_FACULTY', 'PENDING_CLASS_ADVISOR', 'PENDING_HOD',
      'APPROVED', 'POSTED', 'COMPLETED', 'REJECTED', 'POSTPONED', 'CANCELLED', 'REVISION'
    ];
    const q = query(
      eventsCollection,
      where('department', '==', currentUser.department),
      where('status', 'in', deptStatuses)
    );
    return subscribeWithRetry(q, (snapshot) => {
      logQuery(`Dashboard/Workflow (HOD:${currentUser.department})`, snapshot.size, true, startTime);
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error(err), { collectionName: 'events' });
  }

  // IQAC_TEAM, SYSTEM_ADMIN, and department officers (HR_TEAM, AUDIO_TEAM, etc.) 
  // need institution-wide visibility for approval workflows — keep full subscription
  // but limit to active workflow + recent completed (exclude very old CANCELLED events)
  // Firestore 'in' supports max 30 values — keep a focused list
  const roleStatuses = [
    'PENDING_FACULTY',
    'PENDING_CLASS_ADVISOR',
    'PENDING_HOD',
    'PENDING_DEPARTMENTS',
    'PENDING_IQAC',
    'PENDING_PRINCIPAL',
    'APPROVED',
    'POSTED',
    'COMPLETED',
    'REJECTED',
    'POSTPONED',
    'CANCELLED',
    'REVISION'
  ];
  
  const q = query(eventsCollection, where('status', 'in', roleStatuses));
  
  return subscribeWithRetry(q, (snapshot) => {
    logQuery(`Dashboard/Workflow (${currentUser.role})`, snapshot.size, true, startTime);
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (err) => console.error(err), { collectionName: 'events' });
};

export const subscribeToOrganizerEvents = (currentUser, callback) => {
  if (!currentUser?.id) return () => {};
  
  const startTime = performance.now();
  const q = query(eventsCollection, where('organizerId', '==', currentUser.id));
  
  return subscribeWithRetry(q, (snapshot) => {
    logQuery('Organizer', snapshot.size, true, startTime);
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(events);
  }, (err) => console.error(err), { collectionName: 'events' });
};
