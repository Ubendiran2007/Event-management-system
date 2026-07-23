const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class ReportSubmittedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.REPORT_SUBMITTED,
      entityType: 'REPORT',
      entityId: payload.reportId,
      actor: payload.organizerId,
      recipients: payload.iqacIds || [], // To IQAC team
      correlationId: payload.correlationId,
      metadata: {
        eventId: payload.eventId,
        eventTitle: payload.eventTitle
      },
      version: '1.0'
    });
  }
}

module.exports = ReportSubmittedV1;
