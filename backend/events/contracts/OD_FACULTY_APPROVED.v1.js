const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class OdFacultyApprovedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.OD_FACULTY_APPROVED,
      entityType: 'OD',
      entityId: payload.odId,
      actor: payload.facultyId,
      recipients: payload.hodIds || [], // Need HOD approval next
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

module.exports = OdFacultyApprovedV1;
