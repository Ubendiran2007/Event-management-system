const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class RegistrationApprovedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.REGISTRATION_APPROVED,
      entityType: 'REGISTRATION',
      entityId: payload.registrationId,
      actor: payload.organizerId || 'SYSTEM', // The organizer who approved
      recipients: [payload.studentId], // The student who got approved
      correlationId: payload.correlationId,
      metadata: {
        eventId: payload.eventId,
        eventTitle: payload.eventTitle
      },
      version: '1.0'
    });
  }
}

module.exports = RegistrationApprovedV1;
