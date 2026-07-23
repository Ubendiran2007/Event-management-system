class SuppressionRules {
  /**
   * Applies suppression logic to an array of eligible items.
   * Note: Most suppression is inherently handled by the Policies themselves,
   * since they query for live "PENDING" states. If a state resolves, 
   * the policy won't pick it up.
   * This class allows for cross-policy suppression or specific business logic
   * overrides (e.g. "Do not send any reminders during holidays").
   * @param {Array} items 
   * @returns {Array} Filtered items
   */
  apply(items) {
    return items.filter(item => {
      // Example global suppression:
      // if (isCollegeHoliday()) return false;
      return true;
    });
  }
}

module.exports = new SuppressionRules();
