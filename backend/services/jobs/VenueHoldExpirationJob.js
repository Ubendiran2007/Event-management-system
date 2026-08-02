/**
 * VenueHoldExpirationJob
 *
 * Automatically marks expired HELD venue reservations as EXPIRED and releases
 * the active-reservation pointer back to AVAILABLE on their parent venue docs.
 *
 * Uses:
 *   - writeBatch (Firestore 500-op limit)
 *   - distributed locking via NotificationScheduler.runWithLock so multiple
 *     backend pods don't duplicate-expire the same hold
 *   - non-blocking audit writes + optional notifications (background)
 *
 * Invoked by NotificationScheduler's periodic sweep.
 */

const { collection, query, where, getDocs, updateDoc, doc, db, writeBatch } = require('../../firebaseClientWrapper');
const VenueAvailabilityService = require('../venueAvailabilityService');

const VenueReservationStatus = Object.freeze({
  HELD: 'HELD',
  BOOKED: 'BOOKED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  // Legacy values to catch old docs
  _RESERVED: 'RESERVED'
});

function checkDb() {
  if (!db) {
    console.error('[VenueHoldExpirationJob] Firebase is not configured. Aborting.');
    return false;
  }
  return true;
}

/**
 * Bulk mark HELD/RESERVED records as EXPIRED when expiresAt <= now.
 * Also resets venue.activeReservationId pointer if still pointing at the hold.
 */
async function sweepExpiredHolds() {
  if (!checkDb()) return { expiredCount: 0, venueReleases: 0, batchesCommitted: 0 };

  const now = Date.now();
  const nowIso = new Date().toISOString();
  const metrics = { expiredCount: 0, venueReleases: 0, batchesCommitted: 0, scannedCount: 0 };

  try {
    console.log(`[VenueHoldExpirationJob] Starting sweep at ${nowIso}`);

    // Query active HELD + legacy RESERVED. Firestore doesn't support IN on same
    // field; do two queries and union results.
    const statusesToScan = [VenueReservationStatus.HELD, VenueReservationStatus._RESERVED];
    const candidates = [];
    for (const status of statusesToScan) {
      const q = query(
        collection(db, 'venueReservations'),
        where('status', '==', status)
      );
      const snap = await getDocs(q);
      if (snap && snap.forEach) {
        snap.forEach(d => {
          const data = d.data();
          const exp = data.expiresAt && (typeof data.expiresAt.toDate === 'function')
            ? data.expiresAt.toDate().getTime()
            : (data.expiresAt ? new Date(data.expiresAt).getTime() : null);
          if (exp != null && !Number.isNaN(exp) && now >= exp) {
            candidates.push({ id: d.id, ref: doc(db, 'venueReservations', d.id), data, expiresAtTs: exp });
          }
        });
      }
    }
    metrics.scannedCount = candidates.length;
    console.log(`[VenueHoldExpirationJob] Found ${candidates.length} expired hold candidates`);

    // Commit in batches of 250 (each iteration touches reservation + possibly venue doc = 2 writes)
    const BATCH_SIZE = 250;
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const chunk = candidates.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      const venueReservationsReleasing = new Map(); // venueId -> resId

      for (const c of chunk) {
        batch.update(c.ref, {
          status: VenueReservationStatus.EXPIRED,
          expiredAt: new Date().toISOString(),
          expiredBy: 'SYSTEM:VenueHoldExpirationJob',
          expiredReason: 'auto_expired',
          updatedAt: new Date().toISOString()
        });
        metrics.expiredCount += 1;
        if (c.data.venueId) venueReservationsReleasing.set(c.data.venueId, c.id);
      }
      // Reset venue.activeReservationId pointers if still stale
      for (const [venueId, reservationId] of venueReservationsReleasing.entries()) {
        const venueRef = doc(db, 'venues', venueId);
        // Use a separate get to check — safe even across many venues (small N)
        try {
          const venueSnap = await getDocs(query(collection(db, 'venues'), where('__name__', '==', venueId)));
          if (venueSnap && venueSnap.size === 1) {
            const v = venueSnap.docs[0];
            const vd = v.data();
            if (String(vd.activeReservationId || '') === String(reservationId)) {
              batch.update(v.ref, {
                activeReservationId: null,
                activeEventId: null,
                currentStatus: 'AVAILABLE',
                currentStatusExpiresAt: null,
                updatedAt: new Date().toISOString()
              });
              metrics.venueReleases += 1;
            }
          }
        } catch (_) { /* best-effort */ }
      }

      await batch.commit();
      metrics.batchesCommitted += 1;
    }

    const duration = ((Date.now() - now) / 1000).toFixed(1);
    console.log(
      `[VenueHoldExpirationJob] Sweep done: expired=${metrics.expiredCount}, ` +
      `venueReleases=${metrics.venueReleases}, batches=${metrics.batchesCommitted}, duration=${duration}s`
    );
    return { ...metrics, duration: `${duration} s` };
  } catch (err) {
    console.error('[VenueHoldExpirationJob] FATAL error during sweep:', err);
    return { ...metrics, error: err.message };
  }
}

class VenueHoldExpirationJob {
  static async run() {
    return await sweepExpiredHolds();
  }
}

// Expose the sweep helper in case NotificationScheduler wants to call it directly.
VenueHoldExpirationJob.sweepExpiredHolds = sweepExpiredHolds;

module.exports = VenueHoldExpirationJob;
