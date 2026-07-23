const { dbAdmin } = require('../../firebaseAdmin');
const { PRIORITY_LEVELS, CHANNELS } = require('../../utils/notificationConstants');

class PreferenceResolver {
  /**
   * Evaluates the notification's requested channels against the user's saved preferences.
   * Hierarchy: Priority Override -> Global Setting -> Category Setting -> Channel Setting
   * @param {Object} notification 
   * @returns {Promise<Array<string>>} The allowed delivery channels.
   */
  async resolveChannels(notification) {
    const { recipientId, channels = [], priority, category } = notification;

    // 1. Priority Override (e.g. CRITICAL bypasses all preferences)
    if (priority === PRIORITY_LEVELS.CRITICAL) {
      console.log(`[PreferenceResolver] CRITICAL priority bypass for ${recipientId}. Channels: ${channels.join(', ')}`);
      return channels;
    }

    if (!recipientId || channels.length === 0) {
      return channels;
    }

    try {
      const db = dbAdmin;
      const prefDoc = await db.collection('notification_preferences').doc(recipientId).get();

      // If user has no preferences saved, default to allowing all requested channels
      if (!prefDoc.exists) {
        return channels;
      }

      const prefs = prefDoc.data();
      const allowedChannels = [];

      // 2. Evaluate Preferences
      for (const channel of channels) {
        let isAllowed = true;

        // A. Global Level Override (e.g., global 'email: false')
        if (prefs.global && prefs.global[channel] === false) {
          isAllowed = false;
        }

        // B. Category Level Override
        if (prefs.categories && prefs.categories[category]) {
          if (prefs.categories[category][channel] === false) {
            isAllowed = false;
          } else if (prefs.categories[category][channel] === true) {
            // Category setting can re-enable it if global disabled it?
            // Usually, specific overrides override global. Let's make category override global.
            isAllowed = true;
          }
        }

        // IN_APP is almost always forced for core app functionality unless explicitly disabled everywhere
        // But we respect the resolved isAllowed.

        if (isAllowed) {
          allowedChannels.push(channel);
        } else {
          console.log(`[PreferenceResolver] Dropped channel ${channel} for ${recipientId} due to preferences.`);
        }
      }

      return allowedChannels;
    } catch (error) {
      console.error(`[PreferenceResolver] Error resolving preferences for ${recipientId}:`, error);
      // Fail open: send to all requested channels if DB fails
      return channels;
    }
  }
}

module.exports = new PreferenceResolver();
