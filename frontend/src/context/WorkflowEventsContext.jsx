import React, { createContext, useContext, useEffect, useState } from 'react';
import { subscribeToWorkflowEvents } from '../services/eventService';
import { useAppContext } from './AppContext';

const WorkflowEventsContext = createContext({
  events: [],
  loading: true
});

export const WorkflowEventsProvider = ({ children }) => {
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (import.meta.env.DEV) console.log('[eventService] Workflow subscription created');
    
    const unsubscribe = subscribeToWorkflowEvents(currentUser, (fetchedEvents) => {
      setEvents(fetchedEvents);
      setLoading(false);
    });

    return () => {
      if (import.meta.env.DEV) console.log('[eventService] Workflow subscription closed');
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.department]);

  return (
    <WorkflowEventsContext.Provider value={{ events, loading }}>
      {children}
    </WorkflowEventsContext.Provider>
  );
};

export const useWorkflowEvents = () => useContext(WorkflowEventsContext);
