const BaseReminderPolicy = require('./basePolicy');
const { dbAdmin } = require('../../firebaseAdmin');

class RegistrationReminderPolicy extends BaseReminderPolicy {
  constructor() {
    super();
    this.policyType = 'REGISTRATION_REMINDER';
    this.severity = 'MEDIUM';
    this.cronSchedule = '0 8 * * *'; // Daily at 8 AM
  }

  async evaluate() {
    const eligibleItems = [];
    try {
      const db = dbAdmin.firestore();
      const eventsRef = db.collection('events');
      
      // Find published events where registrations are still open
      const snapshot = await eventsRef
        .where('status', '==', 'PUBLISHED')
        .get();

      snapshot.forEach(doc => {
        const event = doc.data();
        
        if (event.registrationDeadline) {
          const deadline = new Date(event.registrationDeadline);
          const now = new Date();
          const daysLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

          // Remind users if registration closes in 2 days or less, and it hasn't passed
          if (daysLeft > 0 && daysLeft <= 2) {
            // Remind the organizer or maybe students? The requirement says "Registration closing in 2 days".
            // Generally broadcasted to students, or perhaps to the organizer to remind them to promote it.
            // We'll target the organizer as a reminder about their event status.
            eligibleItems.push({
              recipientId: event.organizerId,
              policyType: this.policyType,
              entityId: doc.id,
              entityTitle: event.title,
              reason: `Registration for "${event.title}" closes in ${Math.ceil(daysLeft)} days.`,
              severity: daysLeft <= 1 ? 'HIGH' : 'MEDIUM',
            });
          }
        }
      });
    } catch (error) {
      console.error(`[RegistrationReminderPolicy] Evaluate error:`, error);
    }
    return eligibleItems;
  }

  getCurrentWindow() {
    // Daily schedule: YYYY-MM-DD
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  }
}

module.exports = new RegistrationReminderPolicy();
