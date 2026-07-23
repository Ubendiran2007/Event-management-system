const { dbAdmin } = require('../../firebaseAdmin');

class ReminderService {
  /**
   * Checks if a reminder was already generated for this window.
   * Uses Firestore to persist idempotency records.
   * @param {Object} item 
   * @param {string} windowKey 
   * @returns {Promise<boolean>}
   */
  async isReminderAlreadyEmitted(item, windowKey) {
    try {
      const db = dbAdmin.firestore();
      
      // Idempotency key: recipient_policy_entity_window
      // Hash or combine to make document ID
      const idempotencyKey = `${item.recipientId}_${item.policyType}_${item.entityId}_${windowKey}`
        .replace(/[^a-zA-Z0-9_-]/g, '_'); // sanitize for firestore doc id

      const docRef = db.collection('reminderEmissions').doc(idempotencyKey);
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        return true;
      }

      // Mark as emitted
      await docRef.set({
        recipientId: item.recipientId,
        policyType: item.policyType,
        entityId: item.entityId,
        windowKey: windowKey,
        emittedAt: new Date().toISOString(),
        ttl: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Auto-delete after 7 days
      });

      return false;
    } catch (error) {
      console.error(`[ReminderService] Idempotency check failed:`, error);
      return false; // Fail open for safety, though it might cause duplicates
    }
  }
}

module.exports = new ReminderService();
