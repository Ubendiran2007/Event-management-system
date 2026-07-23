const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class OdRejectedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.OD_REJECTED,
      entityType: 'OD',
      entityId: payload.odId,
      actor: payload.actorId, // Faculty or HOD who rejected
      recipients: [payload.studentId],
      correlationId: payload.correlationId,
      metadata: {
        eventId: payload.eventId,
        eventTitle: payload.eventTitle,
        studentName: payload.studentName,
        reason: payload.reason || ''
      },
      version: '1.0'
    });
  }
}

module.exports = OdRejectedV1;
