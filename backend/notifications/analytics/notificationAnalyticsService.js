const { dbAdmin } = require('../../firebaseAdmin');

class NotificationAnalyticsService {
  constructor() {
    this.db = dbAdmin;
    this.analyticsCollection = this.db.collection('notification_analytics');
  }

  /**
   * Tracks a simple metric by incrementing a counter.
   * Useful for high-volume metrics like "sent", "delivered", "viewed".
   * 
   * @param {string} metricCategory - 'DELIVERY', 'ENGAGEMENT', 'REMINDER', 'SYSTEM_HEALTH'
   * @param {string} metricName - e.g. 'sent', 'viewed', 'generated'
   * @param {number} count - default 1
   */
  async trackMetric(metricCategory, metricName, count = 1) {
    try {
      // Group by Day (YYYY-MM-DD) for time-series analytics
      const today = new Date().toISOString().split('T')[0];
      const docId = `${today}_${metricCategory}`;
      
      const docRef = this.analyticsCollection.doc(docId);
      
      // We use Firestore FieldValue.increment
      const { FieldValue } = require('firebase-admin/firestore');
      
      await docRef.set({
        date: today,
        category: metricCategory,
        [metricName]: FieldValue.increment(count),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      
      console.log(`[Analytics] Tracked ${count} x ${metricName} in ${metricCategory}`);
    } catch (error) {
      console.error(`[Analytics] Failed to track metric ${metricCategory}:${metricName}`, error);
    }
  }

  /**
   * Records a snapshot of system health.
   * Instead of a counter, this logs point-in-time metrics.
   */
  async recordHealthSnapshot(queueDepth, dlqSize, processTimeMs) {
    try {
      await this.analyticsCollection.add({
        type: 'HEALTH_SNAPSHOT',
        timestamp: new Date().toISOString(),
        metrics: {
          queueDepth,
          dlqSize,
          processTimeMs
        }
      });
    } catch (error) {
      console.error(`[Analytics] Failed to record health snapshot`, error);
    }
  }
}

module.exports = new NotificationAnalyticsService();
