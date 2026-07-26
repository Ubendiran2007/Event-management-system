/**
 * NotificationScheduler
 * Generic, job-based scheduling orchestrator for the SECE Event Management System.
 * Coordinates modular background jobs (StudentReminderJob, RegistrationAutoCloseJob, etc.)
 * with distributed heartbeat-based locking in Firestore to prevent duplicate processing across cluster instances.
 */

const { doc, getDoc, setDoc, updateDoc, db } = require('../firebaseClientWrapper');
const crypto = require('crypto');
const StudentReminderJob = require('./jobs/StudentReminderJob');
const RegistrationAutoCloseJob = require('./jobs/RegistrationAutoCloseJob');

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
      await setDoc(lockRef, {
        locked: true,
        lockedBy: INSTANCE_ID,
        lockedAt: new Date(now).toISOString(),
        lockedUntil: new Date(now + LOCK_TIMEOUT_MS).toISOString(),
        heartbeatAt: new Date(now).toISOString()
      });
    } catch (err) {
      console.warn(`[NotificationScheduler] Failed to acquire lock "${lockName}":`, err.message);
      return { skipped: true, reason: 'LOCK_ACQUISITION_FAILED' };
    }

    // Start background heartbeat refresher during job execution
    const heartbeatTimer = setInterval(async () => {
      try {
        await updateDoc(lockRef, {
          heartbeatAt: new Date().toISOString(),
          lockedUntil: new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString()
        });
      } catch (e) {}
    }, 60000);

    let result = null;
    try {
      result = await jobFn();
    } finally {
      clearInterval(heartbeatTimer);
      try {
        await updateDoc(lockRef, {
          locked: false,
          lockedUntil: new Date().toISOString(),
          heartbeatAt: new Date().toISOString()
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

      if (!reminderOutcome.skipped) {
        const metrics = reminderOutcome.result || {};
        const closeMetrics = (closeOutcome && !closeOutcome.skipped) ? closeOutcome.result : {};
        
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
---------------------------------------`);
      }
    } catch (err) {
      console.error('[NotificationScheduler] Error during execution cycle:', err);
    } finally {
      this.isRunning = false;
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
