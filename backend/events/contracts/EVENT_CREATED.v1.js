const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class EventCreatedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.EVENT_CREATED,
      entityType: 'EVENT',
      entityId: payload.eventId,
      actor: payload.organizerId, // The person who created the event
      // Usually recipients might be empty initially, or target HOD for approval
      recipients: payload.targetApprovers || [], 
      correlationId: payload.correlationId,
      metadata: {
        eventTitle: payload.eventTitle,
        eventType: payload.eventType,
        department: payload.department
      },
      version: '1.0'
    });
  }
}

module.exports = EventCreatedV1;
