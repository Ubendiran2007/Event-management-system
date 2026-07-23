const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class OdRequestedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.OD_REQUESTED,
      entityType: 'OD',
      entityId: payload.odId,
      actor: payload.studentId,
      recipients: payload.approverIds || [],
      correlationId: payload.correlationId,
      metadata: {
        eventId: payload.eventId,
        eventTitle: payload.eventTitle,
        studentName: payload.studentName
      },
      version: '1.0'
    });
  }
}

module.exports = OdRequestedV1;
