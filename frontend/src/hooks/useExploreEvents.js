import { useState, useEffect, useCallback } from 'react';
import { fetchExploreEvents } from '../services/eventService';
import { useAppContext } from '../context/AppContext';

export const useExploreEvents = () => {
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const data = await fetchExploreEvents(currentUser);
    setEvents(data);
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadEvents();
    }
  }, [currentUser, loadEvents]);

  return { events, loading, refresh: loadEvents };
};
