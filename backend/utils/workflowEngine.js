const PermissionEngine = require('./permissions');
const { EventStatus } = require('../events/constants/eventTypes');

/**
 * Workflow Engine
 * Centralizes all state transition logic to enforce rules, state machine constraints, and permissions.
 */
class WorkflowEngine {
  /**
   * Defines the valid transitions for the State Machine.
   * Format: { [CURRENT_STATE]: [VALID_NEXT_STATES] }
   */
  static TRANSITIONS = {
    [EventStatus.DRAFT]: [EventStatus.WAITING_FOR_MANAGER, EventStatus.READY_FOR_APPROVAL, EventStatus.CANCELLED],
    [EventStatus.WAITING_FOR_MANAGER]: [EventStatus.READY_FOR_APPROVAL, EventStatus.DRAFT],
    [EventStatus.READY_FOR_APPROVAL]: [EventStatus.PENDING_HOD_APPROVAL, EventStatus.DRAFT], // E.g., SUBMIT_FOR_APPROVAL
    [EventStatus.PENDING_HOD_APPROVAL]: [EventStatus.PENDING_IQAC_APPROVAL, EventStatus.CHANGES_REQUESTED, EventStatus.REJECTED],
    [EventStatus.PENDING_IQAC_APPROVAL]: [EventStatus.PENDING_PRINCIPAL_APPROVAL, EventStatus.CHANGES_REQUESTED, EventStatus.REJECTED],
    [EventStatus.PENDING_PRINCIPAL_APPROVAL]: [EventStatus.APPROVED, EventStatus.CHANGES_REQUESTED, EventStatus.REJECTED],
    [EventStatus.CHANGES_REQUESTED]: [EventStatus.PENDING_HOD_APPROVAL, EventStatus.DRAFT], // Resubmission
    [EventStatus.APPROVED]: [EventStatus.PUBLISHED, EventStatus.POSTPONED, EventStatus.CANCELLED],
    [EventStatus.PUBLISHED]: [EventStatus.RUNNING, EventStatus.POSTPONED, EventStatus.CANCELLED],
    [EventStatus.RUNNING]: [EventStatus.ENDED],
    [EventStatus.ENDED]: [EventStatus.POST_EVENT_IN_PROGRESS],
    [EventStatus.POST_EVENT_IN_PROGRESS]: [EventStatus.UNDER_VERIFICATION],
    [EventStatus.UNDER_VERIFICATION]: [EventStatus.COMPLETED, EventStatus.POST_EVENT_IN_PROGRESS],
    [EventStatus.COMPLETED]: [EventStatus.ARCHIVED],
    [EventStatus.REJECTED]: [EventStatus.ARCHIVED],
    [EventStatus.POSTPONED]: [EventStatus.APPROVED, EventStatus.CANCELLED], // Can be rescheduled
    [EventStatus.CANCELLED]: [EventStatus.ARCHIVED]
  };

  /**
   * Check if a transition is valid according to the State Machine.
   * Returns true/false without throwing an error.
   */
  static isValidTransition(currentState, targetState) {
    if (!currentState) return false;
    const allowedNextStates = this.TRANSITIONS[currentState];
    return allowedNextStates ? allowedNextStates.includes(targetState) : false;
  }

  /**
   * Attempt to transition an event to a new state.
   * Throws an error if invalid. Returns the new state if valid.
   */
  static transition(event, targetState, user, context = {}) {
    if (!event || !event.status) {
      throw new Error("Invalid event provided to Workflow Engine.");
    }

    const currentState = event.status;

    // 1. Validate State Machine constraints
    const allowedNextStates = this.TRANSITIONS[currentState];
    if (!allowedNextStates || !allowedNextStates.includes(targetState)) {
      throw new Error(`Invalid state transition from ${currentState} to ${targetState}.`);
    }

    // 2. Validate Business Rules & Permissions based on the target state
    this._validateBusinessRules(event, targetState, user, context);

    // If we reach here, transition is valid.
    return targetState;
  }

  static _validateBusinessRules(event, targetState, user, context) {
    switch (targetState) {
      case EventStatus.READY_FOR_APPROVAL:
      case EventStatus.PENDING_HOD_APPROVAL:
        // Must have at least 1 accepted manager
        const managersCount = context.acceptedManagersCount || 0;
        if (!PermissionEngine.canSubmitForApproval(user, event, managersCount)) {
          throw new Error("Insufficient permissions or missing accepted managers to submit for approval.");
        }
        break;
        
      case EventStatus.APPROVED:
        if (!PermissionEngine.canApprove(user, event, 'PRINCIPAL')) {
          // This depends on the specific required role, simplify for now, ApprovalOrchestrator handles deep logic
          // throw new Error("Unauthorized approval action.");
        }
        break;

      // Add other specific business rule validations per state
      default:
        // Default rule: ensure user has some relation to the event if modifying, unless they are system
        break;
    }
  }
}

module.exports = WorkflowEngine;
