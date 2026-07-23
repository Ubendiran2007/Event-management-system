class AggregationEngine {
  /**
   * Batches multiple reminder items into a single payload per recipient.
   * @param {Array} items 
   * @returns {Array} Aggregated payloads
   */
  aggregate(items) {
    if (!items || items.length === 0) return [];

    const grouped = items.reduce((acc, item) => {
      if (!acc[item.recipientId]) {
        acc[item.recipientId] = [];
      }
      acc[item.recipientId].push(item);
      return acc;
    }, {});

    const aggregatedPayloads = [];

    for (const [recipientId, userItems] of Object.entries(grouped)) {
      if (userItems.length === 1) {
        // No need to aggregate a single item, just format it
        const item = userItems[0];
        aggregatedPayloads.push({
          recipientId,
          title: 'Action Required',
          message: item.reason,
          severity: item.severity,
          items: [item]
        });
      } else {
        // Batch them together
        const typesCount = {};
        userItems.forEach(i => {
          typesCount[i.policyType] = (typesCount[i.policyType] || 0) + 1;
        });

        // E.g. "3 pending event approvals, 2 pending OD approvals"
        const summaryStrings = [];
        if (typesCount['APPROVAL_REMINDER']) summaryStrings.push(`${typesCount['APPROVAL_REMINDER']} pending event approvals`);
        if (typesCount['OD_REMINDER']) summaryStrings.push(`${typesCount['OD_REMINDER']} pending OD requests`);
        if (typesCount['REGISTRATION_REMINDER']) summaryStrings.push(`${typesCount['REGISTRATION_REMINDER']} approaching registration deadlines`);
        if (typesCount['COMPLIANCE_REMINDER']) summaryStrings.push(`${typesCount['COMPLIANCE_REMINDER']} overdue post-event reports`);

        // Get max severity
        const hasCritical = userItems.some(i => i.severity === 'CRITICAL');
        const hasHigh = userItems.some(i => i.severity === 'HIGH');
        const severity = hasCritical ? 'CRITICAL' : (hasHigh ? 'HIGH' : 'MEDIUM');

        aggregatedPayloads.push({
          recipientId,
          title: `You have ${userItems.length} pending actions`,
          message: `Please review: ${summaryStrings.join(', ')}.`,
          severity,
          items: userItems
        });
      }
    }

    return aggregatedPayloads;
  }
}

module.exports = new AggregationEngine();
