const { getFirestore } = require('firebase-admin/firestore');

/**
 * System Configuration
 * Fetches dynamic operational settings from the 'systemConfig' collection.
 * Includes fallback defaults so the system works even if the document isn't populated yet.
 */
class SystemConfig {
  static DEFAULTS = {
    venueReservationDuration: 60, // legacy alias (minutes)
    venueHoldDurationMinutes: 30, // canonical hold duration (10/15/30/45/60 allowed)
    draftExpiryDays: 30,
    managerInvitationExpiryDays: 7,
    maxManagersPerEvent: 10,
    allowVenueOverbooking: false,
    maintenanceLeadTimeHours: 24,
    // Notification delivery modes: 'BCC_ORGANIZER' (default, privacy-first) | 'VISIBLE_TO_RECIPIENTS' (institution policy)
    notificationDeliveryMode: 'BCC_ORGANIZER',
    // Maximum recipients per email batch. Recipient lists exceeding this size
    // are transparently split into multiple batches (e.g. SES ~50/100, Gmail ~99).
    maxRecipientsPerEmailBatch: parseInt(process.env.MAX_RECIPIENTS_PER_EMAIL_BATCH, 10) || 100,
    // Maximum retries for a single batch before moving on to the next one.
    notificationBatchMaxRetries: 3,
    // Default From address (falls back to EMAIL_FROM env var)
    notificationFromEmail: process.env.EMAIL_FROM || process.env.EMAIL_USER || null,
    // No-reply address used when the organizer doesn't have a confirmed contact email
    notificationNoReplyEmail: process.env.NO_REPLY_EMAIL || process.env.EMAIL_FROM || process.env.EMAIL_USER || null
  };

  /**
   * Fetch a config value, falling back to defaults if not found.
   */
  static async get(key) {
    try {
      const db = getFirestore();
      const doc = await db.collection('systemConfig').doc('operationalSettings').get();
      
      if (doc.exists) {
        const data = doc.data();
        if (data[key] !== undefined) {
          return data[key];
        }
      }
    } catch (err) {
      console.warn(`[SystemConfig] Failed to fetch config for ${key}. Using default.`);
    }

    return this.DEFAULTS[key];
  }

  /**
   * Pre-load all settings to avoid multiple reads (useful for synchronous flows)
   */
  static async loadAll() {
    try {
      const db = getFirestore();
      const doc = await db.collection('systemConfig').doc('operationalSettings').get();
      
      if (doc.exists) {
        return { ...this.DEFAULTS, ...doc.data() };
      }
    } catch (err) {
      console.warn(`[SystemConfig] Failed to fetch config block. Using defaults.`);
    }

    return { ...this.DEFAULTS };
  }
}

module.exports = SystemConfig;
