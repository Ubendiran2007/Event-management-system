const ReasoningEngine = require('../interfaces/ReasoningEngine');
const { PRIORITY_LEVELS, CHANNELS } = require('../../../utils/notificationConstants');

class MockReasoningEngine extends ReasoningEngine {
  /**
   * Evaluates context using deterministic business intelligence rules.
   * 
   * @param {Object} context
   * @returns {Promise<Object>} Decision object
   */
  async analyze(context) {
    const { event, metrics } = context;

    // RULE 1: Wait if reminded recently to prevent fatigue
    // If the user was reminded about an event in the last 24 hours, don't spam.
    if (metrics.lastReminderHoursAgo < 24) {
      return {
        action: 'WAIT',
        reason: `Reminded ${metrics.lastReminderHoursAgo.toFixed(1)} hours ago. Wait for 24h window.`
      };
    }

    // RULE 2: Escalate if pending approval for too long
    if (metrics.pendingApprovalHours > 48) {
      // In a real system, you'd lookup the HOD or Principal's ID
      // For this mock, we flag the escalation type.
      return {
        action: 'ESCALATE',
        type: 'ESCALATION_ALERT',
        priority: PRIORITY_LEVELS.HIGH,
        channels: [CHANNELS.IN_APP, CHANNELS.EMAIL],
        reason: `Event pending for ${metrics.pendingApprovalHours.toFixed(1)} hours. Escalate to next authority.`
      };
    }

    // RULE 3: Low Registration Alert
    // If the event is PUBLISHED and registration rate is terribly low (< 20%)
    if (event.status === 'PUBLISHED' && metrics.registrationRate < 20) {
      return {
        action: 'SEND_NOTIFICATION',
        type: 'LOW_REGISTRATION_ALERT',
        priority: PRIORITY_LEVELS.MEDIUM,
        // Since registration is low, maybe push them via In-App first, delay email
        channels: [CHANNELS.IN_APP],
        reason: `Registration is only ${metrics.registrationRate.toFixed(1)}%. Triggering gentle in-app nudge.`
      };
    }

    // Default: No action required
    return {
      action: 'NO_ACTION',
      reason: 'All metrics within normal operating parameters.'
    };
  }
}

module.exports = new MockReasoningEngine();
