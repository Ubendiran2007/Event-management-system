import { api } from '../utils/api';

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
      const res = await api.get('/api/notifications', { userId, ...filters });
      if (res && res.success === false) throw new Error(res.message || 'Failed to fetch notifications');
      return res;
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
      const res = await api.get('/api/notifications/unread', { userId });
      if (res && res.success === false) throw new Error(res.message || 'Failed to fetch unread summary');
      return res;
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
      const res = await api.patch(`/api/notifications/${notificationId}/read`, {});
      if (res && res.success === false) throw new Error(res.message || 'Failed to mark as read');
      return res;
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
      const res = await api.patch('/api/notifications/read-all', { userId });
      if (res && res.success === false) throw new Error(res.message || 'Failed to mark all as read');
      return res;
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
      const res = await api.patch(`/api/notifications/${notificationId}/archive`, {});
      if (res && res.success === false) throw new Error(res.message || 'Failed to archive');
      return res;
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
      const res = await api.delete(`/api/notifications/${notificationId}`);
      if (res && res.success === false) throw new Error(res.message || 'Failed to delete');
      return res;
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
      const res = await api.get('/api/preferences', { userId });
      if (res && res.success === false) throw new Error(res.message || 'Failed to fetch preferences');
      return res;
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
      const res = await api.put('/api/preferences', { userId, ...preferences });
      if (res && res.success === false) throw new Error(res.message || 'Failed to update preferences');
      return res;
    } catch (error) {
      console.error('[notificationService] updatePreferences error:', error);
      throw error;
    }
  },

  // ==================== ADMIN TOOLS ====================

  async sendTestNotification(userId, payload) {
    try {
      const res = await api.post('/api/notifications/test', { userId, ...payload });
      if (res && res.success === false) throw new Error(res.message || 'Failed to send test notification');
      return res;
    } catch (error) {
      console.error('Test notification error:', error);
      throw error;
    }
  },

  async sendBroadcast(payload) {
    try {
      const res = await api.post('/api/notifications/broadcast', payload);
      if (res && res.success === false) throw new Error(res.message || 'Failed to send broadcast');
      return res;
    } catch (error) {
      console.error('Broadcast error:', error);
      throw error;
    }
  },

  async getQueueStatus() {
    try {
      const res = await api.get('/api/notifications/queue-status');
      if (res && res.success === false) throw new Error(res.message || 'Failed to get queue status');
      return res;
    } catch (error) {
      console.error('Queue status error:', error);
      throw error;
    }
  },

  async getDLQ() {
    try {
      const res = await api.get('/api/notifications/dlq');
      if (res && res.success === false) throw new Error(res.message || 'Failed to get DLQ');
      return res;
    } catch (error) {
      console.error('DLQ error:', error);
      throw error;
    }
  }
};
