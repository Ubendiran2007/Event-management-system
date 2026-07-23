const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class RegistrationRejectedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.REGISTRATION_REJECTED,
      entityType: 'REGISTRATION',
      entityId: payload.registrationId,
      actor: payload.organizerId || 'SYSTEM', // The organizer who rejected
      recipients: [payload.studentId], // The student who got rejected
      correlationId: payload.correlationId,
      metadata: {
        eventId: payload.eventId,
        eventTitle: payload.eventTitle,
        reason: payload.reason || ''
      },
      version: '1.0'
    });
  }
}

module.exports = RegistrationRejectedV1;
