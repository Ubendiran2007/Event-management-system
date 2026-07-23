const { v4: uuidv4 } = require('uuid');

/**
 * The universal shape that EVERY domain event must follow when published to the EventBus.
 */
class BaseEventContract {
  constructor(payload) {
    if (!payload.type) throw new Error('Event Contract requires a type.');
    if (!payload.entityType) throw new Error('Event Contract requires an entityType.');
    if (!payload.entityId) throw new Error('Event Contract requires an entityId.');
    if (!payload.actor) throw new Error('Event Contract requires an actor.');
    if (!Array.isArray(payload.recipients)) throw new Error('Event Contract requires recipients array.');
    if (!payload.correlationId) throw new Error('Event Contract requires a correlationId.');
    if (!payload.version) throw new Error('Event Contract requires a version.');
    
    this.id = uuidv4();
    this.correlationId = payload.correlationId || uuidv4();
    this.type = payload.type;
    this.entityType = payload.entityType;
    this.entityId = payload.entityId;
    this.actor = payload.actor || 'SYSTEM';
    this.recipients = payload.recipients || [];
    this.metadata = payload.metadata || {};
    this.timestamp = new Date().toISOString();
    this.version = payload.version || '1.0';
  }

  toJSON() {
    return {
      id: this.id,
      correlationId: this.correlationId,
      type: this.type,
      entityType: this.entityType,
      entityId: this.entityId,
      actor: this.actor,
      recipients: this.recipients,
      metadata: this.metadata,
      timestamp: this.timestamp,
      version: this.version
    };
  }
}

module.exports = BaseEventContract;
