const notificationService = require('../services/notificationService');
const analyticsService = require('../../notifications/analytics/notificationAnalyticsService');

class DeadLetterQueue {
  /**
   * Pushes a permanently failed notification to the Dead Letter Queue (Firestore/DB)
   * for manual review or auditing.
   * @param {Object} job - The failed notification job
   * @param {Error} error - The final error that caused the failure
   */
  async push(job, error) {
    try {
      console.error(`[DeadLetterQueue] Storing failed job [Correlation: ${job.correlationId}]`);
      
      const dlqEntry = {
        ...job,
        status: 'FAILED',
        errorDetails: {
          message: error.message,
          stack: error.stack,
          failedAt: new Date().toISOString()
        }
      };
      
      dlqEntry.timeline.push({ status: 'FAILED', timestamp: new Date().toISOString(), reason: error.message });

      // Save it to Firestore using the notification service, but marked as FAILED
      await notificationService.saveNotification(dlqEntry);

      analyticsService.trackMetric('DELIVERY', 'dead_lettered');

    } catch (dbError) {
      console.error(`[DeadLetterQueue] CRITICAL: Failed to write to DLQ:`, dbError);
    }
  }
}

module.exports = new DeadLetterQueue();
