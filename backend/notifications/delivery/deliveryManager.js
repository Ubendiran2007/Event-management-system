const { CHANNELS } = require('../../utils/notificationConstants');
const preferenceResolver = require('./preferenceResolver');
const InAppChannel = require('./channels/inAppChannel');
const EmailChannel = require('./channels/emailChannel');
// Import future channels here (e.g. PushChannel, SMSChannel)

class DeliveryManager {
  constructor() {
    this.channels = {
      [CHANNELS.IN_APP]: new InAppChannel(),
      [CHANNELS.EMAIL]: new EmailChannel(),
    };
  }

  /**
   * Route the notification to the appropriate channels.
   * @param {Object} notification - The standardized notification object.
   */
  async dispatch(notification) {
    const { correlationId } = notification;
    let { channels = [] } = notification;

    if (!channels || channels.length === 0) {
      console.warn(`[DeliveryManager] Notification ${notification.id || 'unknown'} has no initial delivery channels specified.`);
      return;
    }

    // Phase 5.6: Resolve Preferences
    channels = await preferenceResolver.resolveChannels(notification);
    
    // Update the notification object so downstream workers know which channels are active
    notification.channels = channels;

    if (channels.length === 0) {
      console.log(`[DeliveryManager] Notification delivery skipped: All channels suppressed by preferences [Correlation: ${correlationId}]`);
      return;
    }

    const deliveryPromises = channels.map(async (channelKey) => {
      const channelHandler = this.channels[channelKey];
      if (!channelHandler) {
        console.warn(`[DeliveryManager] Unsupported channel requested: ${channelKey}`);
        return null;
      }

      try {
        console.log(`[DeliveryManager] Dispatching to ${channelKey} [Correlation: ${correlationId}]`);
        return await channelHandler.send(notification);
      } catch (error) {
        console.error(`[DeliveryManager] Failed to dispatch via ${channelKey}:`, error);
        // Note: Individual channels should handle their own queues/retries if applicable.
        return null;
      }
    });

    await Promise.allSettled(deliveryPromises);
  }
}

module.exports = new DeliveryManager();
