import { useState, useEffect, useCallback } from 'react';
import { fetchExploreEvents } from '../services/eventService';
import { useAppContext } from '../context/AppContext';

export const useExploreEvents = () => {
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadEvents = useCallback(async (isInitial = true) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    const currentCursor = isInitial ? null : cursor;
    const data = await fetchExploreEvents(currentUser, currentCursor, 20);
    
    if (isInitial) {
      setEvents(data.events);
    } else {
      setEvents(prev => {
        // Prevent duplicates
        const newEvents = data.events.filter(e => !prev.find(p => p.id === e.id));
        return [...prev, ...newEvents];
      });
    }
    
    setHasMore(data.hasMore);
    setCursor(data.nextCursor);
    
    if (isInitial) setLoading(false);
    else setLoadingMore(false);
  }, [currentUser, cursor]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadEvents(false);
    }
  }, [loadingMore, hasMore, loadEvents]);

  useEffect(() => {
    if (currentUser) {
      loadEvents(true);
    }
  }, [currentUser]); // Deliberately omit loadEvents to avoid loops on cursor change

  return { events, loading, hasMore, loadingMore, loadMore, refresh: () => loadEvents(true) };
};
