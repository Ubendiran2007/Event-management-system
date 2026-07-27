import React, { createContext, useContext, useEffect, useState } from 'react';
import { subscribeToWorkflowEvents } from '../services/eventService';
import { useAppContext } from './AppContext';

const WorkflowEventsContext = createContext({
  events: [],
  loading: true,
  error: null
});

export const WorkflowEventsProvider = ({ children }) => {
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setEvents(prev => prev.length > 0 ? [] : prev);
      setLoading(prev => prev ? false : prev);
      return;
    }

    setLoading(true);
    setError(null);
    if (import.meta.env.DEV) console.log('[eventService] Workflow subscription created');
    
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToWorkflowEvents(currentUser, (fetchedEvents) => {
        setEvents(fetchedEvents);
        setLoading(false);
      }, (err) => {
        // subscribeWithRetry passes isTransient=true while retrying — don't surface those as errors
        if (err?.isTransient) return;
        console.error('[WorkflowEventsContext] Subscription error:', err);
        const msg = err?.code === 'resource-exhausted' || err?.message?.includes('quota')
          ? 'quota'
          : err?.message || 'Failed to load events';
        setError(msg);
        setLoading(false);
      });
    } catch (error) {
      console.error('[WorkflowEventsContext] Subscription error:', error);
      setError(error?.message || 'Failed to load events');
      setEvents([]);
      setLoading(false);
    }

    return () => {
      if (import.meta.env.DEV) console.log('[eventService] Workflow subscription closed');
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.department]);

  return (
    <WorkflowEventsContext.Provider value={{ events, loading, error }}>
      {children}
    </WorkflowEventsContext.Provider>
  );
};

export const useWorkflowEvents = () => useContext(WorkflowEventsContext);
