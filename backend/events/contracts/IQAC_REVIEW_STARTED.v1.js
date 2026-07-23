const BaseEventContract = require('./BaseEventContract');
const EVENT_TYPES = require('../constants/eventTypes');

class IqacReviewStartedV1 extends BaseEventContract {
  constructor(payload) {
    super({
      type: EVENT_TYPES.IQAC_REVIEW_STARTED,
      entityType: 'REPORT',
      entityId: payload.reportId,
      actor: payload.iqacUserId,
      recipients: payload.organizerIds || [], // Notify organizer that review started
      correlationId: payload.correlationId,
      metadata: {
        eventId: payload.eventId,
        eventTitle: payload.eventTitle
      },
      version: '1.0'
    });
  }
}

module.exports = IqacReviewStartedV1;
