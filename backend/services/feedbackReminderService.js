const {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  db,
} = require('../firebaseClientWrapper');

const { sendEmail } = require('./emailService');
const { feedbackReminderTemplate } = require('./emailTemplates');

async function runFeedbackRemindersOnce() {
  if (!db) {
    return { scannedEvents: 0, remindersSent: 0 };
  }

  // We look for events that have explicitly been marked as needing feedback reminders
  // This prevents us from scanning the entire history of COMPLETED events every hour.
  const eventsSnap = await getDocs(
    query(collection(db, 'events'), where('needsFeedbackReminders', '==', true))
  );

  const nowMs = Date.now();
  let remindersSent = 0;

  for (const eventDoc of eventsSnap.docs) {
    const event = eventDoc.data();
    
    // Check if iqacSubmittedAt exists. This acts as the baseline for when the event was officially completed
    if (!event.iqacSubmittedAt) continue;

    const submittedAtMs = new Date(event.iqacSubmittedAt).getTime();
    if (isNaN(submittedAtMs)) continue;

    const hoursSince = (nowMs - submittedAtMs) / (1000 * 60 * 60);

    let reminderType = null;
    
    // Define exact 1-hour windows to prevent duplicate sends if the job runs every hour.
    if (hoursSince >= 24 && hoursSince < 25) {
       reminderType = '24h';
    } else if (hoursSince >= 72 && hoursSince < 73) {
       reminderType = '72h';
    }

    if (!reminderType) continue;
    
    // Check if this specific reminder type was already processed for this event
    if (event[`feedbackReminderSent_${reminderType}`]) continue;

    // Get all OD requests for this event
    const odSnap = await getDocs(query(collection(db, 'odRequests'), where('eventId', '==', eventDoc.id)));
    
    let sentCountForEvent = 0;
    for (const odDoc of odSnap.docs) {
      const odData = odDoc.data();
      // Check if student attended but has NOT submitted feedback
      if (odData.status === 'APPROVED' && ['ATTENDED', 'FN', 'AN'].includes(odData.attendanceStatus) && !odData.feedback) {
        if (odData.email) {
          const emailHtml = feedbackReminderTemplate({
             studentName: odData.studentName || odData.name,
             eventName: event.title || event.eventName || 'the event',
             reminderType,
             link: `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/dashboard`
          });
          
          try {
            await sendEmail(odData.email, `Action Required: Feedback for ${event.title || 'Event'}`, emailHtml);
            sentCountForEvent++;
            remindersSent++;
          } catch(e) {
             console.error(`[feedback-reminder] Failed to send to ${odData.email}:`, e);
          }
        }
      }
    }

    // Mark event as having sent this reminder type so we don't scan its OD requests repeatedly
    try {
      const updatePayload = {
        [`feedbackReminderSent_${reminderType}`]: new Date().toISOString()
      };
      // Once the 72h reminder is sent, we are completely done checking this event forever.
      if (reminderType === '72h') {
        updatePayload.needsFeedbackReminders = false;
      }
      await updateDoc(doc(db, 'events', eventDoc.id), updatePayload);
      console.log(`[feedback-reminder] Marked ${reminderType} reminder complete for event ${eventDoc.id}. Sent to ${sentCountForEvent} students.`);
    } catch(e) {
      console.error(`[feedback-reminder] Failed to update event document:`, e);
    }
  }

  return {
    scannedEvents: eventsSnap.size,
    remindersSent,
  };
}

function startFeedbackReminderJob(intervalMs = 60 * 60 * 1000) { // Default every 1 hour
  const runSafely = async () => {
    try {
      const result = await runFeedbackRemindersOnce();
      if (result.remindersSent > 0) {
        console.log(`[feedback-reminder] Successfully ran. Sent ${result.remindersSent} reminders.`);
      }
    } catch (error) {
      console.error('[feedback-reminder] Failed to run job:', error.message);
    }
  };

  // Run once shortly after startup, then on interval.
  setTimeout(runSafely, 10000); // Wait 10 seconds before first run
  return setInterval(runSafely, intervalMs);
}

module.exports = {
  startFeedbackReminderJob,
  runFeedbackRemindersOnce,
};
