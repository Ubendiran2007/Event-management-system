import React, { createContext, useContext, useEffect, useState } from 'react';
import { subscribeToOrganizerEvents } from '../services/eventService';
import { useAppContext } from './AppContext';
import { UserRole } from '../types';

const OrganizerEventsContext = createContext({
  events: [],
  loading: true
});

export const OrganizerEventsProvider = ({ children }) => {
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only organizers/faculty need to subscribe to organizer events
    const isOrganizer = currentUser?.role === UserRole.FACULTY || 
                        currentUser?.role === UserRole.STUDENT_ORGANIZER || 
                        currentUser?.isApprovedOrganizer;
                        
    if (!currentUser || !isOrganizer) {
      setEvents(prev => prev.length > 0 ? [] : prev);
      setLoading(prev => prev ? false : prev);
      return;
    }

    setLoading(true);
    if (import.meta.env.DEV) console.log('[eventService] Organizer subscription created');
    
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToOrganizerEvents(currentUser, (fetchedEvents) => {
        setEvents(fetchedEvents);
        setLoading(false);
      });
    } catch (error) {
      console.error('[OrganizerEventsContext] Subscription error:', error);
      setEvents([]);
      setLoading(false);
    }

    return () => {
      if (import.meta.env.DEV) console.log('[eventService] Organizer subscription closed');
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.role]);

  return (
    <OrganizerEventsContext.Provider value={{ events, loading }}>
      {children}
    </OrganizerEventsContext.Provider>
  );
};

export const useOrganizerEvents = () => useContext(OrganizerEventsContext);
