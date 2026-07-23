const cron = require('node-cron');
const eventBus = require('../../events/eventBus');
const { NOTIFICATION_TYPES } = require('../../utils/notificationConstants');

const approvalReminderPolicy = require('../policies/approvalReminderPolicy');
const registrationReminderPolicy = require('../policies/registrationReminderPolicy');
const odReminderPolicy = require('../policies/odReminderPolicy');
const complianceReminderPolicy = require('../policies/complianceReminderPolicy');

const reminderService = require('../services/reminderService');
const suppressionRules = require('../suppression/suppressionRules');
const aggregationEngine = require('../aggregation/aggregationEngine');
const analyticsService = require('../../notifications/analytics/notificationAnalyticsService');

class ReminderScheduler {
  constructor() {
    this.policies = [
      approvalReminderPolicy,
      registrationReminderPolicy,
      odReminderPolicy,
      complianceReminderPolicy
    ];
  }

  /**
   * Initializes cron jobs for each policy based on its inherent schedule.
   */
  start() {
    console.log('[ReminderScheduler] Initializing policy schedules...');
    
    this.policies.forEach(policy => {
      console.log(`[ReminderScheduler] Scheduling ${policy.policyType} with cron: ${policy.cronSchedule}`);
      
      cron.schedule(policy.cronSchedule, async () => {
        await this.runPolicy(policy);
      });
    });
  }

  /**
   * Evaluates a single policy, applies idempotency & suppression, and routes to aggregation.
   * @param {Object} policy 
   */
  async runPolicy(policy) {
    console.log(`[ReminderScheduler] Running policy: ${policy.policyType}`);
    
    try {
      // 1. Evaluate Policy -> Eligible Items
      const items = await policy.evaluate();
      if (!items || items.length === 0) return;

      // 2. Apply Idempotency
      const windowKey = policy.getCurrentWindow();
      const validItems = [];
      let suppressedCount = 0;
      for (const item of items) {
        const alreadyEmitted = await reminderService.isReminderAlreadyEmitted(item, windowKey);
        if (!alreadyEmitted) {
          validItems.push(item);
        } else {
          suppressedCount++;
        }
      }

      // 3. Apply Global Suppression
      const finalItems = suppressionRules.apply(validItems);
      suppressedCount += (validItems.length - finalItems.length);
      
      if (suppressedCount > 0) {
        analyticsService.trackMetric('REMINDER', 'suppressed', suppressedCount);
      }

      if (finalItems.length === 0) return;

      // 4. Aggregate
      const aggregatedPayloads = aggregationEngine.aggregate(finalItems);

      analyticsService.trackMetric('REMINDER', 'generated', aggregatedPayloads.length);

      // 5. Emit to Event Bus
      aggregatedPayloads.forEach(payload => {
        eventBus.publish(NOTIFICATION_TYPES.SYSTEM_ALERT, { // Using SYSTEM_ALERT as the base for reminders
          recipientId: payload.recipientId,
          title: payload.title,
          message: payload.message,
          metadata: {
            severity: payload.severity,
            items: payload.items
          }
        });
      });

    } catch (error) {
      console.error(`[ReminderScheduler] Failed running policy ${policy.policyType}:`, error);
    }
  }
}

module.exports = new ReminderScheduler();
