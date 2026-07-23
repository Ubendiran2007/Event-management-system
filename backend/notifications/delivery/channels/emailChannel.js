const emailQueue = require('../../queue/emailQueue');
const analyticsService = require('../../analytics/notificationAnalyticsService');

class EmailChannel {
  /**
   * Pushes the notification to the Email Queue for asynchronous processing.
   * @param {Object} notification 
   */
  async send(notification) {
    try {
      console.log(`[EmailChannel] Queuing notification [Correlation: ${notification.correlationId}]`);
      
      // We don't send synchronously. We enqueue it.
      await emailQueue.enqueue({
        ...notification,
        timeline: [
          { status: 'CREATED', timestamp: new Date().toISOString() },
          { status: 'QUEUED', timestamp: new Date().toISOString() }
        ]
      });

      // Track metric
      analyticsService.trackMetric('DELIVERY', 'queued');

      return { success: true, channel: 'EMAIL', queued: true };
    } catch (error) {
      console.error(`[EmailChannel] Failed to queue email notification:`, error);
      throw error;
    }
  }
}

module.exports = EmailChannel;
