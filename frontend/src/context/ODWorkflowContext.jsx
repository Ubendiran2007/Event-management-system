import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppContext } from './AppContext';
import { subscribeToODWorkflows } from '../services/odService';

const ODWorkflowContext = createContext({
  odRequests: [],
  loading: true,
});

export const ODWorkflowProvider = ({ children }) => {
  const { currentUser } = useAppContext();
  const [odRequests, setOdRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setOdRequests([]);
      setLoading(false);
      return;
    }

    // Guard: Prevent infinite loading if a staff member lacks a department
    if (['FACULTY', 'HOD'].includes(currentUser.role) && !currentUser.department) {
      console.warn('ODWorkflowContext: Missing department for staff user');
      setOdRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('[odService] OD Workflow subscription created');
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToODWorkflows(currentUser, (requests) => {
        setOdRequests(requests);
        setLoading(false);
      });
    } catch (error) {
      console.error('[ODWorkflowContext] Subscription error:', error);
      setOdRequests([]);
      setLoading(false);
    }

    return () => {
      console.log('[odService] OD Workflow subscription closed');
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.department]);

  return (
    <ODWorkflowContext.Provider value={{ odRequests, loading }}>
      {children}
    </ODWorkflowContext.Provider>
  );
};

export const useODWorkflow = () => useContext(ODWorkflowContext);
