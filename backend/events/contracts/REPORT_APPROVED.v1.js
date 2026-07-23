const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class ReportApprovedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.REPORT_APPROVED,
      entityType: 'REPORT',
      entityId: payload.reportId,
      actor: payload.iqacUserId,
      recipients: payload.organizerIds || [], 
      correlationId: payload.correlationId,
      metadata: {
        eventId: payload.eventId,
        eventTitle: payload.eventTitle
      },
      version: '1.0'
    });
  }
}

module.exports = ReportApprovedV1;
