import { useState, useEffect, useCallback } from 'react';
import { fetchAnalyticsEvents } from '../services/eventService';
import { useAppContext } from '../context/AppContext';

export const useAnalyticsEvents = () => {
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expose a function to fetch with filters, supporting the future-ready design
  const loadEvents = useCallback(async (filters = {}) => {
    setLoading(true);
    const data = await fetchAnalyticsEvents(filters);
    setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadEvents();
    }
  }, [currentUser, loadEvents]);

  return { events, loading, refresh: loadEvents };
};
