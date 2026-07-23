const BaseReminderPolicy = require('./basePolicy');
const { dbAdmin } = require('../../firebaseAdmin');

class ComplianceReminderPolicy extends BaseReminderPolicy {
  constructor() {
    super();
    this.policyType = 'COMPLIANCE_REMINDER';
    this.severity = 'CRITICAL';
    this.cronSchedule = '0 0 * * *'; // Daily at midnight
  }

  async evaluate() {
    const eligibleItems = [];
    try {
      const db = dbAdmin.firestore();
      
      // Look for events that are COMPLETED but post-event report is still PENDING
      const snapshot = await db.collection('events')
        .where('status', '==', 'COMPLETED')
        .where('postEventReportStatus', '==', 'PENDING')
        .get();

      snapshot.forEach(doc => {
        const event = doc.data();
        
        // Check if event ended more than 2 days ago
        if (event.endDate) {
          const endDate = new Date(event.endDate);
          const now = new Date();
          const daysPast = (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24);

          if (daysPast > 2) {
            eligibleItems.push({
              recipientId: event.organizerId, // Organizer must submit the report
              policyType: this.policyType,
              entityId: doc.id,
              entityTitle: event.title,
              reason: `Post-event report for "${event.title}" is overdue by ${Math.floor(daysPast)} days.`,
              severity: this.severity,
            });
          }
        }
      });
    } catch (error) {
      console.error(`[ComplianceReminderPolicy] Evaluate error:`, error);
    }
    return eligibleItems;
  }

  getCurrentWindow() {
    // Daily schedule: YYYY-MM-DD
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  }
}

module.exports = new ComplianceReminderPolicy();
