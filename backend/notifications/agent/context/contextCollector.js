const { dbAdmin } = require('../../../firebaseAdmin');

class ContextCollector {
  /**
   * Gathers rich context about a specific event or entity for the Reasoning Engine.
   * 
   * @param {string} eventId 
   * @returns {Promise<Object>} The collected context.
   */
  async collectEventContext(eventId) {
    try {
      const db = dbAdmin;
      
      // 1. Fetch Event Details
      const eventDoc = await db.collection('events').doc(eventId).get();
      if (!eventDoc.exists) {
        throw new Error(`Event ${eventId} not found`);
      }
      const eventData = eventDoc.data();

      // 2. Fetch Registration Counts (Mocking actual logic, assuming registrations collection)
      const registrationsSnapshot = await db.collection('registrations')
        .where('eventId', '==', eventId)
        .where('status', '==', 'APPROVED')
        .get();
      const registrationCount = registrationsSnapshot.size;

      // 3. Fetch Recent Notification History for this event's organizer
      const organizerId = eventData.createdBy;
      let lastReminderHoursAgo = Infinity;

      if (organizerId) {
        // Simplified query to avoid composite index requirements during development
        const historySnapshot = await db.collection('notifications')
          .where('recipientId', '==', organizerId)
          .limit(10)
          .get();
          
        if (!historySnapshot.empty) {
          const eventsNotifs = historySnapshot.docs
            .map(d => d.data())
            .filter(n => n.category === 'EVENTS')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
          if (eventsNotifs.length > 0) {
            const createdTime = new Date(eventsNotifs[0].createdAt).getTime();
            lastReminderHoursAgo = (Date.now() - createdTime) / (1000 * 60 * 60);
          }
        }
      }

      // 4. Calculate Pending Approval Time
      let pendingApprovalHours = 0;
      if (eventData.status === 'PENDING_HOD' || eventData.status === 'PENDING_PRINCIPAL') {
        const submittedTime = new Date(eventData.createdAt).getTime(); // Assuming createdAt is submission time for simplicity
        pendingApprovalHours = (Date.now() - submittedTime) / (1000 * 60 * 60);
      }

      return {
        event: {
          id: eventId,
          title: eventData.title,
          status: eventData.status,
          expectedParticipants: eventData.expectedParticipants || 100, // Default for mock
          organizerId: organizerId
        },
        metrics: {
          registrationCount,
          registrationRate: eventData.expectedParticipants ? (registrationCount / eventData.expectedParticipants) * 100 : 0,
          pendingApprovalHours,
          lastReminderHoursAgo
        }
      };

    } catch (error) {
      console.error(`[ContextCollector] Failed to collect context for event ${eventId}:`, error);
      throw error;
    }
  }
}

module.exports = new ContextCollector();
