const { dbAdmin } = require('../../firebaseAdmin');
const { NOTIFICATION_STATUS } = require('../../utils/notificationConstants');

class NotificationService {
  /**
   * Persist a standardized notification to Firestore.
   */
  async saveNotification(notificationPayload) {
    try {
      const { id, ...data } = notificationPayload;
      // We use the idempotency signature (_eventId) as the document ID if provided
      const docId = id || data._eventId; 
      
      const docRef = docId 
        ? dbAdmin.collection('notifications').doc(docId)
        : dbAdmin.collection('notifications').doc();

      const finalPayload = {
        ...data,
        id: docRef.id,
        status: NOTIFICATION_STATUS.CREATED,
        createdAt: data.createdAt || new Date().toISOString()
      };

      await docRef.set(finalPayload, { merge: true });
      return finalPayload;
    } catch (error) {
      console.error('[NotificationService] Failed to save notification:', error);
      throw error;
    }
  }

  /**
   * Update the status of a notification (e.g. Delivered, Viewed, Failed)
   */
  async updateStatus(notificationId, status, extraData = {}) {
    try {
      const updatePayload = {
        status,
        ...extraData
      };
      
      if (status === NOTIFICATION_STATUS.VIEWED) {
        updatePayload.viewedAt = new Date().toISOString();
      } else if (status === NOTIFICATION_STATUS.ARCHIVED) {
        updatePayload.archivedAt = new Date().toISOString();
      }

      await dbAdmin.collection('notifications').doc(notificationId).update(updatePayload);
    } catch (error) {
      console.error(`[NotificationService] Failed to update status for ${notificationId}:`, error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
