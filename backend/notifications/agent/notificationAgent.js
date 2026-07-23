const contextCollector = require('./context/contextCollector');
const mockReasoningEngine = require('./reasoning/mockReasoningEngine');
const decisionEngine = require('./decision/decisionEngine');

class NotificationAgent {
  constructor(strategy = 'MOCK') {
    // Strategy Pattern: Allow injecting Gemini or Mock engine
    this.strategy = strategy;
    this.engine = strategy === 'MOCK' ? mockReasoningEngine : mockReasoningEngine; // Default to mock for now
  }

  /**
   * The core agent execution loop.
   * 1. Observe (ContextCollector)
   * 2. Reason (ReasoningEngine)
   * 3. Decide & Act (DecisionEngine)
   * 
   * @param {string} eventId 
   */
  async runAnalysisForEvent(eventId) {
    try {
      console.log(`[NotificationAgent] Starting analysis for Event=${eventId} using ${this.strategy} strategy.`);
      
      // 1. Observe
      const context = await contextCollector.collectEventContext(eventId);
      
      // 2. Reason
      const decision = await this.engine.analyze(context);
      
      // 3. Act
      await decisionEngine.executeDecision(context, decision);

      console.log(`[NotificationAgent] Finished analysis for Event=${eventId}.`);
    } catch (error) {
      console.error(`[NotificationAgent] Error running analysis:`, error);
    }
  }
}

module.exports = new NotificationAgent('MOCK');
