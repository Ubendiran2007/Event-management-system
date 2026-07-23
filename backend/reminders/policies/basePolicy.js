class BaseReminderPolicy {
  constructor() {
    this.policyType = 'BASE_POLICY';
    this.severity = 'LOW';
    this.cronSchedule = '0 * * * *'; // Default to hourly
  }

  /**
   * Evaluates the current state of the database to find items eligible for a reminder.
   * Should return an array of objects representing items due for reminder.
   * Example return: [{ recipientId: 'user1', entityId: 'event123', reason: 'Missing approval' }]
   * @returns {Promise<Array>} 
   */
  async evaluate() {
    throw new Error('evaluate() must be implemented by concrete policy');
  }

  /**
   * Generates a deterministic scheduling window key based on the current time and policy schedule.
   * e.g., for an hourly schedule, it might return '2026-07-23-14'
   * This is used for idempotency to ensure we only send one reminder per window.
   * @returns {string}
   */
  getCurrentWindow() {
    // Basic implementation: if hourly, return YYYY-MM-DD-HH
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  }
}

module.exports = BaseReminderPolicy;
