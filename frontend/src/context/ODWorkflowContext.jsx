import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppContext } from './AppContext';
import { subscribeToODWorkflows } from '../services/odService';

const ODWorkflowContext = createContext({
  odRequests: [],
  loading: true,
  error: null,
});

export const ODWorkflowProvider = ({ children }) => {
  const { currentUser } = useAppContext();
  const [odRequests, setOdRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setOdRequests(prev => prev.length > 0 ? [] : prev);
      setLoading(prev => prev ? false : prev);
      return;
    }

    // Guard: Prevent infinite loading if a staff member lacks a department
    if (['FACULTY', 'HOD'].includes(currentUser.role) && !currentUser.department) {
      console.warn('ODWorkflowContext: Missing department for staff user');
      setOdRequests(prev => prev.length > 0 ? [] : prev);
      setLoading(prev => prev ? false : prev);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    console.log('[odService] OD Workflow subscription created');
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToODWorkflows(currentUser, (requests) => {
        setOdRequests(requests);
        setLoading(false);
        if (!requests.__isTransientError) setError(null);
      }, (err) => {
        if (err?.isTransient) return; // subscribeWithRetry will retry
        console.error('[ODWorkflowContext] Subscription error:', err);
        const msg = err?.code === 'resource-exhausted' || err?.message?.includes('quota')
          ? 'quota'
          : err?.message || 'Failed to load OD requests';
        setError(msg);
        setLoading(false);
      });
    } catch (error) {
      console.error('[ODWorkflowContext] Subscription error:', error);
      setError(error?.message || 'Failed to load OD requests');
      setOdRequests([]);
      setLoading(false);
    }

    return () => {
      console.log('[odService] OD Workflow subscription closed');
      unsubscribe();
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.department]);

  return (
    <ODWorkflowContext.Provider value={{ odRequests, loading, error }}>
      {children}
    </ODWorkflowContext.Provider>
  );
};

export const useODWorkflow = () => useContext(ODWorkflowContext);
