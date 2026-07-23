const notificationService = require('../../services/notificationService');
const analyticsService = require('../../analytics/notificationAnalyticsService');

class InAppChannel {
  /**
   * Sends (persists) an In-App Notification.
   * @param {Object} notification 
   */
  async send(notification) {
    try {
      // For IN_APP, "sending" just means saving it to the database for the client to read
      console.log(`[InAppChannel] Persisting notification to DB [Correlation: ${notification.correlationId}]`);
      
      // Extend timeline
      const dbNotification = {
        ...notification,
        status: 'DELIVERED', // For In-App, saving it means it is delivered
        timeline: [
          { status: 'CREATED', timestamp: new Date().toISOString() },
          { status: 'DELIVERED', timestamp: new Date().toISOString() }
        ]
      };

      await notificationService.saveNotification(dbNotification);
      
      // Track metrics
      analyticsService.trackMetric('DELIVERY', 'sent');
      analyticsService.trackMetric('DELIVERY', 'delivered');

      return { success: true, channel: 'IN_APP' };
    } catch (error) {
      console.error(`[InAppChannel] Failed to save In-App notification:`, error);
      throw error;
    }
  }
}

module.exports = InAppChannel;
