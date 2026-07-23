const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class EventApprovedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.EVENT_APPROVED,
      entityType: 'EVENT',
      entityId: payload.eventId,
      actor: payload.actorId, // e.g. HOD or Principal ID
      recipients: [payload.organizerId],
      correlationId: payload.correlationId,
      metadata: {
        eventTitle: payload.eventTitle,
        approverRole: payload.approverRole,
        approvalTimestamp: payload.approvalTimestamp || new Date().toISOString()
      },
      version: '1.0'
    });
  }
}

module.exports = EventApprovedV1;
