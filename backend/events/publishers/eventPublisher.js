const eventBus = require('../eventBus');
const EventCreatedV1 = require('../contracts/EVENT_CREATED.v1');
const EventApprovedV1 = require('../contracts/EVENT_APPROVED.v1');
const RegistrationSubmittedV1 = require('../contracts/REGISTRATION_SUBMITTED.v1');
const RegistrationApprovedV1 = require('../contracts/REGISTRATION_APPROVED.v1');
const RegistrationRejectedV1 = require('../contracts/REGISTRATION_REJECTED.v1');
const RegistrationCancelledV1 = require('../contracts/REGISTRATION_CANCELLED.v1');
const OdRequestedV1 = require('../contracts/OD_REQUESTED.v1');
const OdFacultyApprovedV1 = require('../contracts/OD_FACULTY_APPROVED.v1');
const OdHodApprovedV1 = require('../contracts/OD_HOD_APPROVED.v1');
const OdRejectedV1 = require('../contracts/OD_REJECTED.v1');
const ReportSubmittedV1 = require('../contracts/REPORT_SUBMITTED.v1');
const IqacReviewStartedV1 = require('../contracts/IQAC_REVIEW_STARTED.v1');
const ReportApprovedV1 = require('../contracts/REPORT_APPROVED.v1');
const ReportRejectedV1 = require('../contracts/REPORT_REJECTED.v1');

/**
 * Publisher SDK for Event Workflow.
 * Abstracts eventBus.publish from routes, enforcing standard event contracts.
 */
class EventPublisher {
  /**
   * Publishes an EVENT_CREATED event.
   */
  publishEventCreated(payload) {
    try {
      const contract = new EventCreatedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for Event=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish EVENT_CREATED:`, error);
    }
  }

  /**
   * Publishes an EVENT_APPROVED event.
   */
  publishEventApproved(payload) {
    try {
      const contract = new EventApprovedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for Event=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish EVENT_APPROVED:`, error);
    }
  }

  // --- Registration Flow ---

  publishRegistrationSubmitted(payload) {
    try {
      const contract = new RegistrationSubmittedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for Registration=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish REGISTRATION_SUBMITTED:`, error);
    }
  }

  publishRegistrationApproved(payload) {
    try {
      const contract = new RegistrationApprovedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for Registration=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish REGISTRATION_APPROVED:`, error);
    }
  }

  publishRegistrationRejected(payload) {
    try {
      const contract = new RegistrationRejectedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for Registration=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish REGISTRATION_REJECTED:`, error);
    }
  }

  publishRegistrationCancelled(payload) {
    try {
      const contract = new RegistrationCancelledV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for Registration=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish REGISTRATION_CANCELLED:`, error);
    }
  }

  // --- OD Flow ---

  publishOdRequested(payload) {
    try {
      const contract = new OdRequestedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for OD=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish OD_REQUESTED:`, error);
    }
  }

  publishOdFacultyApproved(payload) {
    try {
      const contract = new OdFacultyApprovedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for OD=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish OD_FACULTY_APPROVED:`, error);
    }
  }

  publishOdHodApproved(payload) {
    try {
      const contract = new OdHodApprovedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for OD=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish OD_HOD_APPROVED:`, error);
    }
  }

  publishOdRejected(payload) {
    try {
      const contract = new OdRejectedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for OD=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish OD_REJECTED:`, error);
    }
  }

  // --- Post-Event Flow ---

  publishReportSubmitted(payload) {
    try {
      const contract = new ReportSubmittedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for Report=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish REPORT_SUBMITTED:`, error);
    }
  }

  publishIqacReviewStarted(payload) {
    try {
      const contract = new IqacReviewStartedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for Report=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish IQAC_REVIEW_STARTED:`, error);
    }
  }

  publishReportApproved(payload) {
    try {
      const contract = new ReportApprovedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for Report=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish REPORT_APPROVED:`, error);
    }
  }

  publishReportRejected(payload) {
    try {
      const contract = new ReportRejectedV1(payload);
      eventBus.publish(contract.type, contract.toJSON());
      console.log(`[EventPublisher] Published ${contract.type} for Report=${contract.entityId}`);
    } catch (error) {
      console.error(`[EventPublisher] Failed to publish REPORT_REJECTED:`, error);
    }
  }
}

module.exports = new EventPublisher();
