import { collection, getDocs, doc, getDoc, query, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { where } from './firebaseService';

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
    const token = localStorage.getItem('sessionToken') || localStorage.getItem('token') || '';
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
  
  // Phase 3A: Role-specific subscriptions
  // Determine which event statuses this role actually needs to see in the Workflow context
  let roleStatuses = [];
  
  switch(currentUser.role) {
    case 'FACULTY':
      // Faculty needs to approve pending requests and see past requests they approved
      roleStatuses = ['PENDING_FACULTY']; 
      break;
    case 'HOD':
      // HOD needs to approve their pending requests
      roleStatuses = ['PENDING_HOD'];
      break;
    case 'IQAC_TEAM':
      roleStatuses = ['PENDING_IQAC'];
      break;
    case 'STUDENT_ORGANIZER':
    case 'STUDENT_GENERAL':
      // Students don't need a global workflow listener (handled by OrganizerEventsContext for their own events)
      // Return early with empty to save reads entirely
      callback([]);
      return () => {};
    default:
      // Admins/Principals might want to see posted/completed
      roleStatuses = ['POSTED', 'COMPLETED'];
      break;
  }
  
  let q = query(eventsCollection, where('status', 'in', roleStatuses));
  
  return onSnapshot(q, (snapshot) => {
    logQuery(`Dashboard/Workflow (${currentUser.role})`, snapshot.size, true, startTime);
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(events);
  });
};

export const subscribeToOrganizerEvents = (currentUser, callback) => {
  if (!currentUser?.id) return () => {};
  
  const startTime = performance.now();
  const q = query(eventsCollection, where('organizerId', '==', currentUser.id));
  
  return onSnapshot(q, (snapshot) => {
    logQuery('Organizer', snapshot.size, true, startTime);
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(events);
  });
};
