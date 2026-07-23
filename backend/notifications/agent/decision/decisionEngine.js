const eventBus = require('../../../events/eventBus');
const { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } = require('../../../utils/notificationConstants');

class DecisionEngine {
  /**
   * Evaluates the Decision output from the Reasoning Engine and publishes
   * to the EventBus if action is required.
   * 
   * @param {Object} context - The original context
   * @param {Object} decision - The decision output from the Reasoning Engine
   */
  async executeDecision(context, decision) {
    const { event, metrics } = context;

    if (decision.action === 'WAIT' || decision.action === 'NO_ACTION') {
      console.log(`[DecisionEngine] Action=${decision.action} for Event=${event.id}. Reason: ${decision.reason}`);
      return;
    }

    if (decision.action === 'SEND_NOTIFICATION' || decision.action === 'ESCALATE') {
      console.log(`[DecisionEngine] Action=${decision.action} for Event=${event.id}. Executing EventBus dispatch.`);
      
      // Standardize the payload to match what the Orchestrator expects
      const payload = {
        _eventId: decision.type, // correlation tracking
        entityId: event.id,
        eventTitle: event.title,
        recipientId: event.organizerId, // Can be overridden for escalation
        recipientRole: 'USER', // Defaulting to avoid undefined errors in DB
        title: decision.type === 'LOW_REGISTRATION_ALERT' ? 'Low Registration Alert' : 'System Escalation',
        message: decision.reason,
        metadata: {
          severity: decision.priority === 'CRITICAL' ? 'CRITICAL' : 
                   decision.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
          aiDecision: true // tag it so we know AI sent it
        },
        // We override requested channels if the ReasoningEngine specifically asked for it.
        // The orchestrator will pass this to the DeliveryManager which applies user preferences.
        forceChannels: decision.channels
      };

      // We use SYSTEM_ALERT as a generic vehicle for these agent decisions
      // The Orchestrator handles mapping SYSTEM_ALERT to standard formats
      eventBus.publish(NOTIFICATION_TYPES.SYSTEM_ALERT, payload);
      
      console.log(`[DecisionEngine] Published ${decision.type} to EventBus for Event=${event.id}`);
    }
  }
}

module.exports = new DecisionEngine();
