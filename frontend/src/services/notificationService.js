const API_BASE = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://event-management-system-dpzc.onrender.com');

/**
 * Service for Notification API calls
 */
export const notificationService = {
  /**
   * Fetch paginated notifications with optional filters
   * @param {string} userId - Current user ID
   * @param {Object} filters - limit, status, category, priority, startAfter
   */
  async fetchNotifications(userId, filters = {}) {
    try {
      const queryParams = new URLSearchParams({ userId, ...filters });
      const res = await fetch(`${API_BASE}/api/notifications?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return await res.json();
    } catch (error) {
      console.error('[notificationService] fetchNotifications error:', error);
      throw error;
    }
  },

  /**
   * Fetch unread count and latest notifications
   * @param {string} userId 
   */
  async fetchUnreadSummary(userId) {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/unread?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch unread summary');
      return await res.json();
    } catch (error) {
      console.error('[notificationService] fetchUnreadSummary error:', error);
      throw error;
    }
  },

  /**
   * Mark a single notification as read
   * @param {string} notificationId 
   */
  async markAsRead(notificationId) {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: 'PATCH'
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      return await res.json();
    } catch (error) {
      console.error('[notificationService] markAsRead error:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read for a user
   * @param {string} userId 
   */
  async markAllAsRead(userId) {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) throw new Error('Failed to mark all as read');
      return await res.json();
    } catch (error) {
      console.error('[notificationService] markAllAsRead error:', error);
      throw error;
    }
  },

  /**
   * Archive a single notification
   * @param {string} notificationId 
   */
  async archiveNotification(notificationId) {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${notificationId}/archive`, {
        method: 'PATCH'
      });
      if (!res.ok) throw new Error('Failed to archive');
      return await res.json();
    } catch (error) {
      console.error('[notificationService] archiveNotification error:', error);
      throw error;
    }
  },

  /**
   * Delete a single notification
   * @param {string} notificationId 
   */
  async deleteNotification(notificationId) {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete');
      return await res.json();
    } catch (error) {
      console.error('[notificationService] deleteNotification error:', error);
      throw error;
    }
  },
  
  /**
   * Fetch notification preferences
   * @param {string} userId 
   */
  async fetchPreferences(userId) {
    try {
      const res = await fetch(`${API_BASE}/api/preferences?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch preferences');
      return await res.json();
    } catch (error) {
      console.error('[notificationService] fetchPreferences error:', error);
      throw error;
    }
  },

  /**
   * Update notification preferences
   * @param {string} userId 
   * @param {Object} preferences - { global, categories }
   */
  async updatePreferences(userId, preferences) {
    try {
      const res = await fetch(`${API_BASE}/api/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...preferences })
      });
      if (!res.ok) throw new Error('Failed to update preferences');
      return await res.json();
    } catch (error) {
      console.error('[notificationService] updatePreferences error:', error);
      throw error;
    }
  },

  // ==================== ADMIN TOOLS ====================

  async sendTestNotification(userId, payload) {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...payload })
      });
      return await res.json();
    } catch (error) {
      console.error('Test notification error:', error);
      throw error;
    }
  },

  async sendBroadcast(payload) {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (error) {
      console.error('Broadcast error:', error);
      throw error;
    }
  },

  async getQueueStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/queue-status`);
      return await res.json();
    } catch (error) {
      console.error('Queue status error:', error);
      throw error;
    }
  },

  async getDLQ() {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/dlq`);
      return await res.json();
    } catch (error) {
      console.error('DLQ error:', error);
      throw error;
    }
  }
};
