/**
 * RegistrationAutoCloseJob
 * Queries upcoming active events starting in <= 30 mins where registrationOpen is true
 * and automatically sets registrationOpen = false in Firestore.
 */

const { collection, query, where, getDocs, doc, updateDoc, db } = require('../../firebaseClientWrapper');

class RegistrationAutoCloseJob {
  static async run() {
    let closedCount = 0;
    try {
      // Get events where registrationOpen is currently true
      const eventsQuery = query(
        collection(db, 'events'),
        where('registrationOpen', '==', true)
      );
      const snap = await getDocs(eventsQuery);
      
      if (!snap || !snap.docs) return { closedCount };

      const now = Date.now();
      const THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

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

        if (eventStartTimestamp > 0 && now >= eventStartTimestamp - THRESHOLD_MS) {
          try {
            await updateDoc(doc(db, 'events', d.id), {
              registrationOpen: false,
              autoClosedAt: new Date().toISOString()
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
