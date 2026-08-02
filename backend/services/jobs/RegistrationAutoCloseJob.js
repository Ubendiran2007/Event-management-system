/**
 * RegistrationAutoCloseJob
 * Automatically closes event registrations when their deadline has passed.
 * Uses Firestore writeBatch for bulk updates (500 per batch limit) with
 * distributed lock coordination via NotificationScheduler.
 */

const { collection, query, where, getDocs, updateDoc, doc, db, writeBatch } = require('../../firebaseClientWrapper');

function checkDb() {
  if (!db) {
    console.error('[RegistrationAutoCloseJob] Firebase is not configured. Aborting.');
    return false;
  }
  return true;
}

class RegistrationAutoCloseJob {
  static async run() {
    if (!checkDb()) {
      return { closedCount: 0, matchedCount: 0, batchesCommitted: 0 };
    }

    const now = Date.now();
    const nowIso = new Date().toISOString();
    const metrics = {
      matchedCount: 0,
      closedCount: 0,
      batchesCommitted: 0,
      duration: '0.0 s'
    };
    const startTime = Date.now();

    try {
      console.log(`[RegistrationAutoCloseJob] Starting scan at ${nowIso}`);

      const postedQuery = query(
        collection(db, 'events'),
        where('status', '==', 'POSTED')
      );
      const snap = await getDocs(postedQuery);

      const candidates = [];
      if (snap && snap.forEach) {
        snap.forEach(d => {
          const data = d.data();
          const reg = data.registration || {};
          const regStatus = reg.status;
          const statusExists = typeof regStatus !== 'undefined' && regStatus !== null;
          const statusNotClosed = !statusExists || !['CLOSED', 'FINALIZED'].includes(regStatus);
          const hasDeadline = typeof reg.currentDeadline !== 'undefined' && reg.currentDeadline !== null ||
                              typeof data.registrationDeadline !== 'undefined' && data.registrationDeadline !== null;

          if (statusNotClosed && hasDeadline) {
            const effectiveDeadline = reg.currentDeadline || data.registrationDeadline;
            const deadlineTs = new Date(effectiveDeadline).getTime();
            if (!Number.isNaN(deadlineTs)) {
              candidates.push({
                id: d.id,
                ref: doc(db, 'events', d.id),
                data,
                registration: reg,
                effectiveDeadline,
                deadlineTs
              });
            }
          }
        });
      }

      metrics.matchedCount = candidates.length;
      console.log(`[RegistrationAutoCloseJob] Found ${candidates.length} POSTED events with open registration + deadline`);

      const toClose = [];
      for (const c of candidates) {
        if (now >= c.deadlineTs) {
          toClose.push(c);
          const title = c.data.title || c.data.eventName || '(untitled)';
          console.log(`[RegistrationAutoCloseJob] Closing event ${c.id} (${title}): deadline ${c.effectiveDeadline} <= now`);
        }
      }

      if (toClose.length === 0) {
        console.log('[RegistrationAutoCloseJob] No events past deadline. Nothing to do.');
        metrics.duration = ((Date.now() - startTime) / 1000).toFixed(1) + ' s';
        return metrics;
      }

      const BATCH_LIMIT = 500;
      for (let i = 0; i < toClose.length; i += BATCH_LIMIT) {
        const batchChunk = toClose.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);

        for (const c of batchChunk) {
          const existingReg = c.registration || {};
          batch.update(c.ref, {
            updatedAt: nowIso,
            registration: {
              ...existingReg,
              status: 'CLOSED',
              autoClosedAt: nowIso,
              closedBy: 'SYSTEM'
            }
          });
        }

        await batch.commit();
        metrics.batchesCommitted++;
        metrics.closedCount += batchChunk.length;
        console.log(`[RegistrationAutoCloseJob] Batch ${metrics.batchesCommitted} committed: ${batchChunk.length} events closed`);
      }

      console.log(`[RegistrationAutoCloseJob] Complete: ${metrics.closedCount}/${metrics.matchedCount} events closed in ${metrics.batchesCommitted} batch(es)`);
    } catch (err) {
      console.error('[RegistrationAutoCloseJob] Fatal error during run():', err);
      throw err;
    } finally {
      metrics.duration = ((Date.now() - startTime) / 1000).toFixed(1) + ' s';
    }

    return metrics;
  }
}

async function scheduledRun() {
  try {
    return await RegistrationAutoCloseJob.run();
  } catch (err) {
    console.error('[RegistrationAutoCloseJob] scheduledRun() caught error (non-breaking):', err);
    return { closedCount: 0, matchedCount: 0, batchesCommitted: 0, error: err.message };
  }
}

module.exports = RegistrationAutoCloseJob;
module.exports.scheduledRun = scheduledRun;
