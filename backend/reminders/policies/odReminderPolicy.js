const BaseReminderPolicy = require('./basePolicy');
const { dbAdmin } = require('../../firebaseAdmin');

class ODReminderPolicy extends BaseReminderPolicy {
  constructor() {
    super();
    this.policyType = 'OD_REMINDER';
    this.severity = 'MEDIUM';
    this.cronSchedule = '0 8 * * *'; // Daily at 8 AM
  }

  async evaluate() {
    const eligibleItems = [];
    try {
      const db = dbAdmin.firestore();
      
      // Find pending OD requests
      const snapshot = await db.collection('odRequests')
        .where('status', '==', 'PENDING')
        .get();

      snapshot.forEach(doc => {
        const req = doc.data();
        
        const lastUpdated = new Date(req.updatedAt || req.createdAt);
        const now = new Date();
        const hoursPending = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

        // Remind faculty/advisor if OD pending > 24 hrs
        if (hoursPending > 24) {
          eligibleItems.push({
            recipientId: 'FACULTY', // Needs mapping to specific faculty if class advisors are known
            policyType: this.policyType,
            entityId: doc.id,
            entityTitle: req.eventTitle,
            reason: `OD Request for student ${req.studentRollNumber || ''} is awaiting approval.`,
            severity: this.severity,
          });
        }
      });
    } catch (error) {
      console.error(`[ODReminderPolicy] Evaluate error:`, error);
    }
    return eligibleItems;
  }

  getCurrentWindow() {
    // Daily schedule: YYYY-MM-DD
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  }
}

module.exports = new ODReminderPolicy();
