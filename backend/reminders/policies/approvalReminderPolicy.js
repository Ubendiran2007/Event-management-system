const BaseReminderPolicy = require('./basePolicy');
// We need dbAdmin to query Firestore safely on the backend
const { dbAdmin } = require('../../firebaseAdmin');

class ApprovalReminderPolicy extends BaseReminderPolicy {
  constructor() {
    super();
    this.policyType = 'APPROVAL_REMINDER';
    this.severity = 'HIGH';
    this.cronSchedule = '0 * * * *'; // Hourly
  }

  async evaluate() {
    const eligibleItems = [];
    try {
      // Find events pending HOD approval (status = 'PENDING_HOD' etc.)
      const db = dbAdmin.firestore();
      const eventsRef = db.collection('events');
      
      // In a real database, we'd want indexes for this.
      const snapshot = await eventsRef
        .where('status', 'in', ['PENDING_HOD', 'PENDING_IQAC', 'PENDING_PRINCIPAL'])
        .get();

      snapshot.forEach(doc => {
        const event = doc.data();
        
        // Check if it's been pending for > 24 hours
        const lastUpdated = new Date(event.updatedAt || event.createdAt);
        const now = new Date();
        const hoursPending = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

        if (hoursPending > 24) {
          // Identify the recipient based on status
          let recipientRole = '';
          if (event.status === 'PENDING_HOD') recipientRole = 'HOD';
          else if (event.status === 'PENDING_IQAC') recipientRole = 'IQAC_TEAM';
          else if (event.status === 'PENDING_PRINCIPAL') recipientRole = 'PRINCIPAL';

          eligibleItems.push({
            recipientId: recipientRole, // For role-based routing
            policyType: this.policyType,
            entityId: doc.id,
            entityTitle: event.title,
            reason: `Event "${event.title}" has been awaiting approval for over 24 hours.`,
            severity: this.severity,
          });
        }
      });
    } catch (error) {
      console.error(`[ApprovalReminderPolicy] Evaluate error:`, error);
    }
    return eligibleItems;
  }
}

module.exports = new ApprovalReminderPolicy();
