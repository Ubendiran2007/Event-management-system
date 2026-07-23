import { useState, useEffect, useCallback } from 'react';
import { fetchCalendarEvents } from '../services/eventService';
import { useAppContext } from '../context/AppContext';

export const useCalendarEvents = () => {
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const data = await fetchCalendarEvents();
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
