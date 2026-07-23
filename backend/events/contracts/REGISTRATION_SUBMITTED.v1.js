const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class RegistrationSubmittedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.REGISTRATION_SUBMITTED,
      entityType: 'REGISTRATION',
      entityId: payload.registrationId,
      actor: payload.studentId, // The student registering
      recipients: payload.organizerIds || [], // Organizers who need to review
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

module.exports = RegistrationSubmittedV1;
