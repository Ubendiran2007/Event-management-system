class RetryPolicy {
  constructor() {
    this.maxRetries = 3;
  }

  /**
   * Determines if a job should be retried based on its current attempt count.
   * @param {number} attempts - Current number of attempts
   * @returns {boolean}
   */
  shouldRetry(attempts) {
    return attempts < this.maxRetries;
  }

  /**
   * Calculates the exponential backoff delay in milliseconds.
   * Attempt 1 = 2s, Attempt 2 = 4s, Attempt 3 = 8s
   * @param {number} attempts 
   * @returns {number} Delay in ms
   */
  getBackoffDelay(attempts) {
    return Math.pow(2, attempts) * 1000;
  }
}

module.exports = new RetryPolicy();
