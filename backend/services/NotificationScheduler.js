/**
 * NotificationScheduler
 * Generic, job-based scheduling orchestrator for the SECE Event Management System.
 * Coordinates modular background jobs (StudentReminderJob, RegistrationAutoCloseJob, etc.)
 * with distributed heartbeat-based locking in Firestore to prevent duplicate processing
 * across cluster instances.
 *
 * ── TTL Cleanup Policy ─────────────────────────────────────────────────────
 *
 *   Collection          │ TTL Field   │ TTL Days │ Purpose
 *  ─────────────────────┼──────────────┼──────────┼────────────────────────────
 *   schedulerLocks      │ expiresAt    │ 1        │ Lock leases (ephemeral)
 *   scheduledJobs       │ updatedAt    │ 90       │ Completed job run history
 *
 * Policies are applied through Firebase Console / gcloud CLI. All lock writes
 * set `expiresAt` as a strictly-monotonic TTL reference timestamp, and
 * `updatedAt` so an alternate policy can still trigger if `expiresAt` isn't
 * configured.
 */

const { doc, getDoc, setDoc, updateDoc, db, collection, query, where, getDocs } = require('../firebaseClientWrapper');
const crypto = require('crypto');
const StudentReminderJob = require('./jobs/StudentReminderJob');
const RegistrationAutoCloseJob = require('./jobs/RegistrationAutoCloseJob');
const VenueHoldExpirationJob = require('./jobs/VenueHoldExpirationJob');
const GroupNotificationDispatcher = require('./GroupNotificationDispatcher');

const INSTANCE_ID = `instance-${crypto.randomUUID().slice(0, 8)}`;
const LOCK_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

class NotificationScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Executes a job inside a distributed Firestore heartbeat lock.
   */
  async runWithLock(lockName, jobFn) {
    const lockRef = doc(db, 'schedulerLocks', lockName);
    const now = Date.now();

    try {
      const snap = await getDoc(lockRef);
      if (snap && snap.exists()) {
        const data = snap.data();
        const heartbeatTime = data.heartbeatAt ? new Date(data.heartbeatAt).getTime() : 0;
        const untilTime = data.lockedUntil ? new Date(data.lockedUntil).getTime() : 0;

        // If lock is active and heartbeat is recent (< 3 mins), another replica is running
        if (data.locked === true && untilTime > now && (now - heartbeatTime) < LOCK_TIMEOUT_MS) {
          return { skipped: true, reason: 'LOCKED_BY_OTHER_INSTANCE' };
        }
      }

      // Acquire or recover stale lock
      const nowIso = new Date(now).toISOString();
      const lockedUntilIso = new Date(now + LOCK_TIMEOUT_MS).toISOString();
      // expiresAt = LOCK_TIMEOUT + 1 hour safety margin; ensures TTL policy
      // deletes stale locks even if a replica crashes before releasing.
      const expiresAtIso = new Date(now + LOCK_TIMEOUT_MS + 60 * 60 * 1000).toISOString();
      await setDoc(lockRef, {
        locked: true,
        lockedBy: INSTANCE_ID,
        lockedAt: nowIso,
        lockedUntil: lockedUntilIso,
        heartbeatAt: nowIso,
        expiresAt: expiresAtIso,
        updatedAt: nowIso
      });
    } catch (err) {
      console.warn(`[NotificationScheduler] Failed to acquire lock "${lockName}":`, err.message);
      return { skipped: true, reason: 'LOCK_ACQUISITION_FAILED' };
    }

    // Start background heartbeat refresher during job execution
    const heartbeatTimer = setInterval(async () => {
      try {
        const hbNow = Date.now();
        const hbExpiresAt = new Date(hbNow + LOCK_TIMEOUT_MS + 60 * 60 * 1000).toISOString();
        await updateDoc(lockRef, {
          heartbeatAt: new Date(hbNow).toISOString(),
          lockedUntil: new Date(hbNow + LOCK_TIMEOUT_MS).toISOString(),
          expiresAt: hbExpiresAt,
          updatedAt: new Date(hbNow).toISOString()
        });
      } catch (e) {}
    }, 60000);

    let result = null;
    try {
      result = await jobFn();
    } finally {
      clearInterval(heartbeatTimer);
      try {
        const releaseNow = Date.now();
        // Release + short TTL so released locks disappear promptly (~1h TTL)
        await updateDoc(lockRef, {
          locked: false,
          lockedUntil: new Date(releaseNow).toISOString(),
          heartbeatAt: new Date(releaseNow).toISOString(),
          expiresAt: new Date(releaseNow + 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(releaseNow).toISOString()
        });
      } catch (e) {}
    }

    return { skipped: false, result };
  }

  /**
   * Executes all scheduler jobs sequentially and outputs formatted enterprise summary metrics.
   */
  async runAllJobs() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const reminderOutcome = await this.runWithLock('studentReminder', () => StudentReminderJob.run());
      const closeOutcome = await this.runWithLock('registrationAutoClose', () => RegistrationAutoCloseJob.run());
      const venueExpiryOutcome = await this.runWithLock('venueHoldExpiration', () => VenueHoldExpirationJob.run());
      const recoveryOutcome = await this.runWithLock('groupNotificationRecovery', () => this.resumeInterruptedNotifications());

      if (!reminderOutcome.skipped) {
        const metrics = reminderOutcome.result || {};
        const closeMetrics = (closeOutcome && !closeOutcome.skipped) ? closeOutcome.result : {};
        const venueExpiryMetrics = (venueExpiryOutcome && !venueExpiryOutcome.skipped) ? venueExpiryOutcome.result : {};
        const recoveryMetrics = (recoveryOutcome && !recoveryOutcome.skipped) ? recoveryOutcome.result : {};

        console.log(`
Scheduler Run (${new Date().toISOString()})
---------------------------------------
Pending Events:      ${metrics.pendingEvents || 0}
Approved Students:   ${metrics.approvedStudents || 0}
Rejected Students:   ${metrics.rejectedStudents || 0}
Chunks Sent:         ${metrics.chunksSent || 0}
Emails Failed:       ${metrics.emailsFailed || 0}
Duration:            ${metrics.duration || '0.0 s'}
Auto-Closed Events:  ${closeMetrics?.closedCount || 0}
Expired Holds:       ${venueExpiryMetrics?.expiredCount || 0}
Venue Releases:      ${venueExpiryMetrics?.venueReleases || 0}
Notif Recoveries:    ${recoveryMetrics?.recoveredCount || 0}
---------------------------------------`);
      }
    } catch (err) {
      console.error('[NotificationScheduler] Error during execution cycle:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Background recovery job — scans eventNotifications in PROCESSING / PARTIAL
   * state that haven't been touched for >= MAX_RESUME_GAP_MS and re-runs them
   * through GroupNotificationDispatcher.resumeNotification(idempotency keys
   * ensure already-processed batches are skipped on resume).
   */
  async resumeInterruptedNotifications() {
    const MAX_RESUME_GAP_MS = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();
    const recovered = [];
    const metrics = { recoveredCount: 0, skippedCount: 0, errors: [] };

    try {
      const candidatesQ = query(
        collection(db, 'eventNotifications'),
        where('status', 'in', ['PROCESSING', 'PARTIAL'])
      );
      const snap = await getDocs(candidatesQ);
      if (!snap || snap.empty) return metrics;

      for (const d of snap.docs) {
        const data = d.data();
        const touched = data.completedAt || data.updatedAt || data.createdAt;
        const gapMs = touched ? (now - new Date(touched).getTime()) : MAX_RESUME_GAP_MS;
        if (gapMs < MAX_RESUME_GAP_MS) { metrics.skippedCount += 1; continue; }
        try {
          await GroupNotificationDispatcher.resumeNotification(d.id);
          recovered.push(d.id);
          metrics.recoveredCount += 1;
        } catch (err) {
          metrics.errors.push({ id: d.id, error: err.message });
        }
      }
      metrics.recovered = recovered;
      return metrics;
    } catch (err) {
      console.error('[NotificationScheduler] Recovery scan failed:', err.message);
      metrics.errors.push({ id: '*', error: err.message });
      return metrics;
    }
  }

  /**
   * Starts periodic execution of the scheduler.
   * Defaults to every 5 minutes (or 1 minute in test environments).
   */
  start(intervalMs = null) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    const defaultInterval = process.env.EMAIL_TEST_MODE === 'true' ? 60000 : 300000;
    const effectiveInterval = intervalMs || parseInt(process.env.SCHEDULER_INTERVAL_MS || defaultInterval, 10);
    
    console.log(`[NotificationScheduler] Started generic scheduler (Interval: ${effectiveInterval}ms, Instance: ${INSTANCE_ID})`);
    
    // Initial run on boot after a short 5-second warmup delay
    setTimeout(() => this.runAllJobs(), 5000);
    
    this.intervalId = setInterval(() => this.runAllJobs(), effectiveInterval);
    return this.intervalId;
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[NotificationScheduler] Stopped.');
    }
  }
}

module.exports = new NotificationScheduler();
