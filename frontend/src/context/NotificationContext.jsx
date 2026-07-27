import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationService } from '../services/notificationService';
import { useAppContext } from './AppContext';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAppContext() || { currentUser: { id: 'student_1' } }; // Fallback for dev if needed

  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  
  // Current active filters
  const [filters, setFilters] = useState({});
  const filtersRef = useRef(filters);
  const notificationsRef = useRef(notifications);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const userId = currentUser?.id;

  // Poll for unread count every 30 seconds
  useEffect(() => {
    if (!userId) return;
    
    const fetchUnread = async () => {
      try {
        const { unreadCount } = await notificationService.fetchUnreadSummary(userId);
        setUnreadCount(unreadCount);
      } catch (err) {
        console.error('Failed to fetch unread summary', err);
      }
    };
    
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadNotifications = useCallback(async (newFilters = {}, isLoadMore = false) => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const currentFilters = { ...filtersRef.current, ...newFilters };
      if (!isLoadMore) {
        filtersRef.current = currentFilters;
        setFilters((previous) => {
          const previousKeys = Object.keys(previous);
          const currentKeys = Object.keys(currentFilters);
          const unchanged = previousKeys.length === currentKeys.length && currentKeys.every((key) => previous[key] === currentFilters[key]);
          return unchanged ? previous : currentFilters;
        });
      }

      let startAfter = null;
      if (isLoadMore && notificationsRef.current.length > 0) {
        startAfter = notificationsRef.current[notificationsRef.current.length - 1].id;
      }

      const response = await notificationService.fetchNotifications(userId, {
        ...currentFilters,
        startAfter,
        limit: 20
      });

      if (response.success) {
        const nextNotifications = isLoadMore ? [...notificationsRef.current, ...response.data] : response.data;
        notificationsRef.current = nextNotifications;
        setNotifications(nextNotifications);
        setHasMore(response.data.length === 20);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const refreshNotifications = useCallback((newFilters) => {
    loadNotifications(newFilters, false);
  }, [loadNotifications]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadNotifications({}, true);
    }
  }, [hasMore, loading, loadNotifications]);

  const markAsRead = useCallback(async (id) => {
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, status: 'VIEWED', viewedAt: new Date().toISOString() } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await notificationService.markAsRead(id);
    } catch (err) {
      // Revert if failed
      refreshNotifications();
    }
  }, [refreshNotifications]);

  const markAllRead = useCallback(async () => {
    const previousUnread = unreadCount;
    setNotifications(prev => 
      prev.map(n => n.status === 'DELIVERED' ? { ...n, status: 'VIEWED', viewedAt: new Date().toISOString() } : n)
    );
    setUnreadCount(0);

    try {
      await notificationService.markAllAsRead(userId);
    } catch (err) {
      setUnreadCount(previousUnread);
      refreshNotifications();
    }
  }, [userId, unreadCount, refreshNotifications]);

  const archiveNotification = useCallback(async (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, status: 'ARCHIVED', archivedAt: new Date().toISOString() } : n)
    );

    try {
      await notificationService.archiveNotification(id);
    } catch (err) {
      refreshNotifications();
    }
  }, [refreshNotifications]);

  const deleteNotification = useCallback(async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await notificationService.deleteNotification(id);
    } catch (err) {
      refreshNotifications();
    }
  }, [refreshNotifications]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      hasMore,
      error,
      filters,
      refreshNotifications,
      loadMore,
      markAsRead,
      markAllRead,
      archiveNotification,
      deleteNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  return {
    showToast: (msg, type) => console.log('Toast:', msg),
    showDialog: (props) => console.log('Dialog:', props),
    showNotification: (msg, type) => console.log('Notification:', msg)
  };
};
