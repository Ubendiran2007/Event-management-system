/**
 * StudentReminderJob
 * Processes delayed student registration reminder notifications 30 mins before event start.
 * Implements chunked batch BCC delivery (default 50 recipients) with configurable delay (default 500ms)
 * and chunk-level atomic WriteBatch commits to ensure resilience against partial failures.
 */

const { collection, query, where, limit, getDocs, doc, getDoc, writeBatch, db } = require('../../firebaseClientWrapper');
const emailService = require('../emailService');

const EMAIL_BATCH_SIZE = parseInt(process.env.EMAIL_BATCH_SIZE || '50', 10);
const EMAIL_BATCH_DELAY_MS = parseInt(process.env.EMAIL_BATCH_DELAY_MS || '500', 10);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class StudentReminderJob {
  static async run() {
    const startTime = Date.now();
    const metrics = {
      pendingEvents: 0,
      approvedStudents: 0,
      rejectedStudents: 0,
      chunksSent: 0,
      emailsFailed: 0,
      duration: '0.0 s'
    };

    try {
      const nowIso = new Date().toISOString();
      // Query pending notifications with single equality filter to avoid composite index requirements
      const regQuery = query(
        collection(db, 'eventRegistrations'),
        where('notificationPending', '==', true),
        limit(500)
      );
      const odQuery = query(
        collection(db, 'odRequests'),
        where('notificationPending', '==', true),
        limit(500)
      );

      const [regSnap, odSnap] = await Promise.all([getDocs(regQuery), getDocs(odQuery)]);
      
      const allDocs = [];
      if (regSnap && regSnap.forEach) {
        regSnap.forEach(d => {
          const data = d.data();
          if (!data.notificationScheduledAt || data.notificationScheduledAt <= nowIso) {
            allDocs.push({ id: d.id, ref: doc(db, 'eventRegistrations', d.id), data, type: 'REG' });
          }
        });
      }
      if (odSnap && odSnap.forEach) {
        odSnap.forEach(d => {
          const data = d.data();
          if (!data.notificationScheduledAt || data.notificationScheduledAt <= nowIso) {
            allDocs.push({ id: d.id, ref: doc(db, 'odRequests', d.id), data, type: 'OD' });
          }
        });
      }

      if (allDocs.length === 0) {
        metrics.duration = ((Date.now() - startTime) / 1000).toFixed(1) + ' s';
        return metrics;
      }

      // Group by eventId and registrationStatus (APPROVED vs REJECTED)
      const groups = {};
      const eventCache = {};

      for (const item of allDocs) {
        const eventId = item.data.eventId;
        if (!eventId) continue;
        
        if (!eventCache[eventId]) {
          try {
            const evSnap = await getDoc(doc(db, 'events', eventId));
            eventCache[eventId] = evSnap.exists() ? { id: evSnap.id, ...evSnap.data() } : { id: eventId, title: item.data.eventTitle || 'Event' };
          } catch (e) {
            eventCache[eventId] = { id: eventId, title: item.data.eventTitle || 'Event' };
          }
        }

        const status = item.data.registrationStatus || item.data.status;
        const isApproved = status === 'APPROVED' || status === 'REGISTERED';
        const groupKey = `${eventId}_${isApproved ? 'APPROVED' : 'REJECTED'}`;

        if (!groups[groupKey]) {
          groups[groupKey] = {
            eventId,
            eventData: eventCache[eventId],
            isApproved,
            items: [],
            reason: item.data.reason || item.data.remarks || ''
          };
        }
        groups[groupKey].items.push(item);
      }

      metrics.pendingEvents = Object.keys(eventCache).length;

      // Process groups in chunks of EMAIL_BATCH_SIZE
      let chunkCounter = 0;
      for (const groupKey of Object.keys(groups)) {
        const group = groups[groupKey];
        if (group.isApproved) {
          metrics.approvedStudents += group.items.length;
        } else {
          metrics.rejectedStudents += group.items.length;
        }

        for (let i = 0; i < group.items.length; i += EMAIL_BATCH_SIZE) {
          chunkCounter++;
          if (chunkCounter > 1 && EMAIL_BATCH_DELAY_MS > 0) {
            await sleep(EMAIL_BATCH_DELAY_MS);
          }

          const chunkItems = group.items.slice(i, i + EMAIL_BATCH_SIZE);
          const bccList = chunkItems
            .map(item => item.data.studentEmail || item.data.email || item.data.userEmail)
            .filter(Boolean);

          if (bccList.length > 0) {
            const sendRes = await emailService.sendStudentRegistrationReminderBatch(
              group.eventData,
              bccList,
              group.isApproved,
              group.reason,
              chunkCounter
            );

            if (sendRes.success) {
              metrics.chunksSent++;
              // Atomic WriteBatch commit for this specific chunk
              try {
                const batch = writeBatch(db);
                for (const item of chunkItems) {
                  batch.update(item.ref, {
                    notificationSent: true,
                    notificationPending: false,
                    notificationSentAt: new Date().toISOString()
                  });
                }
                await batch.commit();
              } catch (batchErr) {
                console.error(`[StudentReminderJob] WriteBatch failed for chunk ${chunkCounter}:`, batchErr);
              }
            } else {
              metrics.emailsFailed++;
            }
          }
        }
      }
    } catch (err) {
      console.error('[StudentReminderJob] Fatal error during execution:', err);
    } finally {
      metrics.duration = ((Date.now() - startTime) / 1000).toFixed(1) + ' s';
    }

    return metrics;
  }
}

module.exports = StudentReminderJob;
