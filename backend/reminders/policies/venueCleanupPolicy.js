const BasePolicy = require('./basePolicy');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ReservationStatus } = require('../../services/venueAvailabilityService'); // Wait, let me just hardcode 'EXPIRED' to avoid circular/import issues if it's not exported that way.

class VenueCleanupPolicy extends BasePolicy {
  constructor() {
    super();
    this.policyType = 'VENUE_CLEANUP_POLICY';
    // Run every 1 hour (as per user instruction: "Run: Every 1 hour. The scheduler should clean abandoned reservations only.")
    this.cronSchedule = '0 * * * *';
  }

  async execute() {
    console.log(`[VenueCleanupPolicy] Starting background sweep for abandoned reservations...`);
    const db = getFirestore();
    const now = new Date();

    try {
      // Find all reservations that are still 'RESERVED' but past their expiresAt
      const snapshot = await db.collection('venueReservations')
        .where('status', '==', 'RESERVED')
        .where('expiresAt', '<', now)
        .get();

      if (snapshot.empty) {
        console.log(`[VenueCleanupPolicy] No expired reservations found.`);
        return;
      }

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'EXPIRED',
          updatedAt: FieldValue.serverTimestamp(),
          cleanedBy: 'SYSTEM_SCHEDULER'
        });
      });

      await batch.commit();
      console.log(`[VenueCleanupPolicy] Successfully cleaned up ${snapshot.size} expired venue reservations.`);
    } catch (error) {
      console.error(`[VenueCleanupPolicy] Error during cleanup:`, error);
      throw error;
    }
  }
}

module.exports = new VenueCleanupPolicy();
