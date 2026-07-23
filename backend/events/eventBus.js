const EventEmitter = require('events');
const crypto = require('crypto');

class EventBus extends EventEmitter {
  constructor() {
    super();
    // Keep track of recently seen event signatures to enforce idempotency at the bus level
    // In a distributed system, this would be Redis. Here, we use an in-memory map.
    this.processedEvents = new Map();
    
    // Cleanup old event signatures every hour to prevent memory leaks
    setInterval(() => {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      for (const [key, timestamp] of this.processedEvents.entries()) {
        if (timestamp < oneHourAgo) {
          this.processedEvents.delete(key);
        }
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Generates a unique signature for an event to ensure idempotency.
   */
  _generateSignature(eventType, entityId, timestamp) {
    // If the caller provides a distinct timestamp (e.g. from Firestore update time),
    // it helps ensure exactly-once processing for that specific state change.
    return crypto.createHash('sha256').update(`${eventType}:${entityId}:${timestamp}`).digest('hex');
  }

  /**
   * Publish an event to the bus.
   * @param {string} eventType - The type of event (e.g. EVENT_APPROVED)
   * @param {object} payload - The event payload
   * @param {string} payload.entityId - The unique ID of the entity that changed
   * @param {number|string} payload.timestamp - The timestamp of the change
   */
  publish(eventType, payload) {
    if (!payload || !payload.entityId || !payload.timestamp) {
      console.warn(`[EventBus] Warning: Emitted event ${eventType} missing entityId or timestamp for idempotency.`);
    }

    const signature = this._generateSignature(eventType, payload?.entityId, payload?.timestamp);
    
    if (this.processedEvents.has(signature)) {
      console.log(`[EventBus] Idempotency catch: Ignoring duplicate event ${eventType} for ${payload?.entityId}`);
      return false;
    }

    this.processedEvents.set(signature, Date.now());

    // Inject versioning and correlation tracking
    const enrichedPayload = {
      ...payload,
      _eventId: signature, // For internal tracing
      _eventType: eventType,
      correlationId: payload.correlationId || crypto.randomUUID(),
      eventVersion: payload.eventVersion || "1.0",
      emittedAt: new Date().toISOString()
    };

    console.log(`[EventBus] Emitting ${eventType} [Correlation: ${enrichedPayload.correlationId}]`);
    
    // Consumer Isolation: Safely trigger each listener without crashing the others
    const triggerListeners = (eventName, data) => {
      const listeners = this.listeners(eventName);
      for (const listener of listeners) {
        try {
          // If listener is async, the error might be unhandled promise rejection
          // We wrap it in a Promise.resolve to catch async errors too
          Promise.resolve(listener(data)).catch(err => {
            console.error(`[EventBus] Consumer Error for ${eventName}:`, err);
          });
        } catch (err) {
          console.error(`[EventBus] Consumer Sync Error for ${eventName}:`, err);
        }
      }
    };

    triggerListeners(eventType, enrichedPayload);
    // Also emit a catch-all for listeners that want everything (like Audit Logs)
    triggerListeners('*', enrichedPayload);
    
    return true;
  }
}

// Export a singleton instance
const eventBus = new EventBus();
module.exports = eventBus;
