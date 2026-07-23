const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class RegistrationCancelledV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.REGISTRATION_CANCELLED,
      entityType: 'REGISTRATION',
      entityId: payload.registrationId,
      actor: payload.studentId, // The student who cancelled
      recipients: payload.organizerIds || [], // Inform organizers
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

module.exports = RegistrationCancelledV1;
