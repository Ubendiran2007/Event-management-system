const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class OdHodApprovedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.OD_HOD_APPROVED,
      entityType: 'OD',
      entityId: payload.odId,
      actor: payload.hodId,
      recipients: [payload.studentId], // Student is notified of final approval
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

module.exports = OdHodApprovedV1;
