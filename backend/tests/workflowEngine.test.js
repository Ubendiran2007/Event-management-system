const WorkflowEngine = require('../utils/workflowEngine');
const { EventStatus } = require('../events/constants/eventTypes');

describe('WorkflowEngine - Transitions', () => {
  it('should ALLOW transition from DRAFT to READY_FOR_APPROVAL', () => {
    const currentState = EventStatus.DRAFT;
    const targetState = 'READY_FOR_APPROVAL'; // Or use EventStatus.READY_FOR_APPROVAL if defined
    
    expect(WorkflowEngine.isValidTransition(currentState, targetState)).toBe(true);
  });

  it('should DENY transition from DRAFT directly to PUBLISHED', () => {
    const currentState = EventStatus.DRAFT;
    const targetState = EventStatus.PUBLISHED;
    
    expect(WorkflowEngine.isValidTransition(currentState, targetState)).toBe(false);
  });

  it('should ALLOW transition to CANCELLED from any state', () => {
    expect(WorkflowEngine.isValidTransition(EventStatus.DRAFT, EventStatus.CANCELLED)).toBe(true);
    expect(WorkflowEngine.isValidTransition(EventStatus.PUBLISHED, EventStatus.CANCELLED)).toBe(true);
  });
});
