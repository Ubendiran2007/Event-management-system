import React, { createContext, useContext, useEffect, useState } from 'react';
import { subscribeToOrganizerEvents } from '../services/eventService';
import { useAppContext } from './AppContext';
import { UserRole } from '../types';

const OrganizerEventsContext = createContext({
  events: [],
  loading: true,
  error: null
});

export const OrganizerEventsProvider = ({ children }) => {
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const isOrganizer = currentUser?.role === UserRole.FACULTY || 
                        currentUser?.role === UserRole.STUDENT_ORGANIZER || 
                        currentUser?.isApprovedOrganizer;
                        
    if (!currentUser || !isOrganizer) {
      setEvents(prev => prev.length > 0 ? [] : prev);
      setLoading(prev => prev ? false : prev);
      return;
    }

    setLoading(true);
    setError(null);
    if (import.meta.env.DEV) console.log('[eventService] Organizer subscription created');
    
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToOrganizerEvents(currentUser, (fetchedEvents) => {
        setEvents(fetchedEvents);
        setLoading(false);
      }, (err) => {
        // subscribeWithRetry passes isTransient=true while retrying — don't surface those as errors
        if (err?.isTransient) return;
        console.error('[OrganizerEventsContext] Subscription error:', err);
        const msg = err?.code === 'resource-exhausted' || err?.message?.includes('quota')
          ? 'quota'
          : err?.message || 'Failed to load events';
        setError(msg);
        setLoading(false);
      });
    } catch (error) {
      console.error('[OrganizerEventsContext] Subscription error:', error);
      setError(error?.message || 'Failed to load events');
      setEvents([]);
      setLoading(false);
    }

    return () => {
      if (import.meta.env.DEV) console.log('[eventService] Organizer subscription closed');
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.role]);

  return (
    <OrganizerEventsContext.Provider value={{ events, loading, error }}>
      {children}
    </OrganizerEventsContext.Provider>
  );
};

export const useOrganizerEvents = () => useContext(OrganizerEventsContext);
