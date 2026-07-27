/**
 * RegistrationAutoCloseJob
 * Closes registration at the configured registration deadline. This runs without
 * a logged-in user and keeps legacy registrationOpen fields in sync.
 */

const { collection, query, where, getDocs, doc, updateDoc, db } = require('../../firebaseClientWrapper');

class RegistrationAutoCloseJob {
  static async run() {
    let closedCount = 0;
    try {
      // Get events that have an explicitly open registration window.
      const eventsQuery = query(
        collection(db, 'events'),
        where('registrationOpen', '==', true)
      );
      const snap = await getDocs(eventsQuery);
      
      if (!snap || !snap.docs) return { closedCount };

      const now = Date.now();
      for (const d of snap.docs) {
        const data = d.data();
        const startDateStr = data.requisition?.step1?.eventStartDate || data.date;
        const startTimeStr = data.requisition?.step1?.eventStartTime || data.startTime || '00:00';
        
        let eventStartTimestamp = 0;
        try {
          if (startDateStr) {
            const sDP = startDateStr.split('-');
            const sTP = startTimeStr.split(':');
            eventStartTimestamp = new Date(parseInt(sDP[0]), parseInt(sDP[1]) - 1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1])).getTime();
          }
        } catch (e) {}

        const registration = data.registration || {};
        const deadlineValue = registration.currentDeadline || registration.originalDeadline || data.registrationDeadline;
        const deadlineTimestamp = deadlineValue ? new Date(deadlineValue).getTime() : 0;
        const shouldClose = (deadlineTimestamp > 0 && now >= deadlineTimestamp) ||
          (!deadlineTimestamp && eventStartTimestamp > 0 && now >= eventStartTimestamp - (30 * 60 * 1000));

        if (shouldClose) {
          try {
            const closedAt = new Date().toISOString();
            await updateDoc(doc(db, 'events', d.id), {
              registrationOpen: false,
              autoClosedAt: closedAt,
              registration: {
                ...registration,
                enabled: registration.enabled !== false,
                status: 'CLOSED',
                closedAt
              }
            });
            closedCount++;
          } catch (err) {
            console.error(`[RegistrationAutoCloseJob] Failed to close event ${d.id}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('[RegistrationAutoCloseJob] Error checking auto-close registrations:', err);
    }
    return { closedCount };
  }
}

module.exports = RegistrationAutoCloseJob;
