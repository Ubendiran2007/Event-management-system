/**
 * Reasoning Engine Interface
 * 
 * Defines the contract that any AI or Mock engine must implement
 * to reason about notification context.
 */
class ReasoningEngine {
  /**
   * Analyzes the provided context and returns a Decision.
   * 
   * @param {Object} context - The structured context gathered by the Context Collector.
   * @returns {Promise<Object>} The decision object containing:
   *  {
   *    action: 'SEND_NOTIFICATION' | 'WAIT' | 'ESCALATE',
   *    type: string, (e.g. 'LOW_REGISTRATION_ALERT')
   *    priority: string, (e.g. 'HIGH')
   *    channels: Array<string>,
   *    reason: string
   *  }
   */
  async analyze(context) {
    throw new Error('Method "analyze()" must be implemented.');
  }
}

module.exports = ReasoningEngine;
