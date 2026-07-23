import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../context/AuthContext'; // Assuming AuthContext exists

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth() || { currentUser: { uid: 'student_1' } }; // Fallback for dev if needed
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  
  // Current active filters
  const [filters, setFilters] = useState({});

  const userId = currentUser?.uid;

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
      
      const currentFilters = { ...filters, ...newFilters };
      if (!isLoadMore) {
        setFilters(currentFilters);
      }

      let startAfter = null;
      if (isLoadMore && notifications.length > 0) {
        startAfter = notifications[notifications.length - 1].id;
      }

      const response = await notificationService.fetchNotifications(userId, {
        ...currentFilters,
        startAfter,
        limit: 20
      });

      if (response.success) {
        if (isLoadMore) {
          setNotifications(prev => [...prev, ...response.data]);
        } else {
          setNotifications(response.data);
        }
        setHasMore(response.data.length === 20);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, filters, notifications]);

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
