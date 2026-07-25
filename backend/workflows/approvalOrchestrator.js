const WorkflowEngine = require('../utils/workflowEngine');
const PermissionEngine = require('../utils/permissions');
const { EventStatus, UserRole } = require('../events/constants/eventTypes');
const eventBus = require('../notifications/eventBus');

/**
 * Approval Orchestration Engine
 * Centralizes all approval logic to prevent duplication and easily scale for future workflows.
 */
class ApprovalOrchestrator {
  /**
   * Main entry point to submit an event for approval.
   */
  static async submitForApproval(event, user, context = {}) {
    // 1. Validation Engine
    if (!event || !event.eventId) {
      throw new Error("Invalid event data.");
    }

    // 2. Policy Engine (via PermissionEngine & WorkflowEngine)
    const targetState = EventStatus.PENDING_HOD_APPROVAL; // First step in standard flow
    
    // This validates state machine constraints and business rules (like acceptedManagersCount)
    const newState = WorkflowEngine.transition(event, targetState, user, context);

    // 3. Determine Required Approvers (Simplified for now based on HOD)
    // A more complex system would dynamically resolve the HOD's UID based on the creator's department
    const nextApproverRole = UserRole.HOD;

    // 4. Generate Workflow Context
    const workflowData = {
      eventId: event.eventId,
      currentStep: 'HOD_APPROVAL',
      requiredRole: nextApproverRole,
      submittedBy: user.uid,
      submittedAt: new Date().toISOString()
    };

    // 5. Apply the transition (this would normally be done in a Firestore transaction in the route)
    // event.status = newState;
    
    // 6. Notify First Approver
    // In a real implementation, we emit an event. The router will commit to Firestore, then the bus fires.
    // eventBus.emit('EVENT_SUBMITTED', { eventId: event.eventId, workflowData });

    return {
      newState,
      workflowData
    };
  }
}

module.exports = ApprovalOrchestrator;
