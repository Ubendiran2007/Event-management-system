const { getFirestore } = require('firebase-admin/firestore');

/**
 * System Configuration
 * Fetches dynamic operational settings from the 'systemConfig' collection.
 * Includes fallback defaults so the system works even if the document isn't populated yet.
 */
class SystemConfig {
  static DEFAULTS = {
    venueReservationDuration: 60, // minutes
    draftExpiryDays: 30,
    managerInvitationExpiryDays: 7,
    maxManagersPerEvent: 10,
    allowVenueOverbooking: false,
    maintenanceLeadTimeHours: 24
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
