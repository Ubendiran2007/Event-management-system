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

export const fetchExploreEvents = async (currentUser) => {
  const startTime = performance.now();
  try {
    const q = query(
      eventsCollection, 
      where('status', 'in', ['POSTED', 'POSTPONED', 'COMPLETED', 'CANCELLED'])
    );
    const snapshot = await getDocs(q);
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Client side filtering exactly matching ExploreEventsNew logic
    const filtered = events.filter(e => {
        if (e.status === 'CANCELLED' && !e.iqacApprovedAt) return false;
        if (currentUser) {
            const globalRoles = [
              'IQAC_TEAM', 'SYSTEM_ADMIN', 'HR_TEAM', 'AUDIO_TEAM',
              'TRANSPORT_TEAM', 'BOYS_WARDEN', 'GIRLS_WARDEN', 'MEDIA'
            ];
            const hasGlobalVisibility = globalRoles.includes(currentUser?.role);
            const isOpenToAll = e.openToAllDepartments === true || e.audienceScope === 'Open To All' || String(e.department).toLowerCase() === 'overall';
            const isMyDept = String(e.department).toLowerCase() === String(currentUser?.department).toLowerCase() || (e?.requisition?.step1?.department === currentUser?.department);
            const isSelectedDept = Array.isArray(e.selectedDepartments) && e.selectedDepartments.includes(currentUser?.department);
            
            if (!hasGlobalVisibility && !isOpenToAll && !isMyDept && !isSelectedDept) {
              return false;
            }
        }
        return true;
    });
    
    logQuery('Explore', snapshot.size, false, startTime);
    return filtered;
  } catch (err) {
    console.error('Error fetching explore events:', err);
    return [];
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
  // Limit to events that are actively in the workflow or recently completed/posted
  const activeStatuses = [
    'PENDING_FACULTY',
    'PENDING_HOD',
    'PENDING_DEPARTMENTS',
    'PENDING_IQAC',
    'POSTED',
    'COMPLETED'
  ];
  
  let q = query(eventsCollection, where('status', 'in', activeStatuses));
  
  return onSnapshot(q, (snapshot) => {
    logQuery('Dashboard/Workflow', snapshot.size, true, startTime);
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
