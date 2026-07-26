/**
 * test-enterprise-email-scheduling.js
 * Verification suite for the Enterprise Production Email Notification System Refactoring & Scheduling Architecture.
 * Tests:
 * 1. Centralized Portal Redirection Link Generation
 * 2. Persistent Email Audit Logging in Firestore
 * 3. Chunked BCC Dispatch with Configurable Delay and Batch Size
 * 4. Distributed Heartbeat Locking in NotificationScheduler
 * 5. StudentReminderJob Chunk-Level Atomic writeBatch Execution
 * 6. RegistrationAutoCloseJob Policy Enforcement (<= 30 mins before start)
 */

require('dotenv').config();
// Set test environment variables BEFORE requiring modules that use them
process.env.EMAIL_TEST_MODE = 'true';
process.env.USE_REAL_FIRESTORE = 'true';
process.env.EMAIL_BATCH_SIZE = '2'; // Small batch size for testing chunking
process.env.EMAIL_BATCH_DELAY_MS = '50'; // Short delay for testing rate limiting

const assert = require('assert');
const crypto = require('crypto');
const { collection, addDoc, getDoc, getDocs, doc, setDoc, updateDoc, deleteDoc, db } = require('../firebaseClientWrapper');
const portalLinks = require('../utils/portalLinks');
const emailService = require('../services/emailService');
const NotificationScheduler = require('../services/NotificationScheduler');
const StudentReminderJob = require('../services/jobs/StudentReminderJob');
const RegistrationAutoCloseJob = require('../services/jobs/RegistrationAutoCloseJob');

let passCount = 0;
let failCount = 0;

function logPass(msg) {
  passCount++;
  console.log(`[PASS] ${msg}`);
}

function logFail(msg, err) {
  failCount++;
  console.error(`[FAIL] ${msg}`, err || '');
}

async function runVerificationSuite() {
  console.log('=== STARTING ENTERPRISE EMAIL SCHEDULING VERIFICATION SUITE ===\n');

  // --- 1. Portal Redirection Link Generation ---
  console.log('--- 1. Testing Portal Redirection Link Generators ---');
  try {
    const eventLink = portalLinks.getEventLink('evt_123');
    assert(eventLink.includes('/events/evt_123'), `Invalid event link: ${eventLink}`);
    logPass('getEventLink generates valid event viewing URL');

    const approvalLink = portalLinks.getApprovalLink('evt_456', 'faculty');
    assert(approvalLink.includes('/login?redirect=%2Ffaculty%2Fevents%2Fevt_456%2Fapproval'), `Invalid approval link: ${approvalLink}`);
    logPass('getApprovalLink generates valid auth-aware redirection URL');

    const iqacLink = portalLinks.getIQACLink('evt_789');
    assert(iqacLink.includes('/login?redirect=%2Fiqac%2Fsubmission%2Fevt_789'), `Invalid IQAC link: ${iqacLink}`);
    logPass('getIQACLink generates valid auth-aware redirection URL');
  } catch (err) {
    logFail('Portal Redirection Link Generator test failed', err);
  }

  // --- 2. Persistent Email Audit Logging ---
  console.log('\n--- 2. Testing Persistent Email Audit Logging ---');
  let createdAuditDocId = null;
  try {
    const testMessageId = `audit_test_${Date.now()}`;
    await emailService.logEmailAudit(
      {
        to: 'test@student.com',
        subject: 'Test Audit',
        emailType: 'STUDENT_REMINDER',
        eventId: 'evt_audit_001',
        eventTitle: 'Audit Test Event',
        template: 'studentRegistrationReminderTemplate',
        eventReferenceId: 'EVT-2026-AUDIT'
      },
      'SUCCESS',
      '',
      testMessageId,
      { recipientCount: 5, chunkNumber: 1, messageId: testMessageId }
    );

    // Verify document in emailAuditLogs collection
    const snap = await getDocs(collection(db, 'emailAuditLogs'));
    let found = false;
    if (snap && snap.docs) {
      for (const d of snap.docs) {
        if (d.data().messageId === testMessageId) {
          found = true;
          createdAuditDocId = d.id;
          const data = d.data();
          assert.strictEqual(data.template, 'studentRegistrationReminderTemplate');
          assert.strictEqual(data.recipientCount, 5);
          assert.strictEqual(data.chunkNumber, 1);
          assert.strictEqual(data.status, 'SUCCESS');
          break;
        }
      }
    }
    assert(found, 'Audit log document not found in Firestore emailAuditLogs');
    logPass('Persistent email audit record successfully created in Firestore');
  } catch (err) {
    logFail('Persistent Email Audit Logging test failed', err);
  } finally {
    if (createdAuditDocId) {
      try { await deleteDoc(doc(db, 'emailAuditLogs', createdAuditDocId)); } catch (e) {}
    }
  }

  // --- 3. Chunked BCC Dispatch with Configurable Delay ---
  console.log('\n--- 3. Testing Chunked BCC Dispatch ---');
  try {
    const mockEvent = {
      id: 'evt_chunk_001',
      title: 'Chunked Delivery Symposium',
      referenceId: 'EVT-2026-CHUNK',
      venue: 'Auditorium',
      startTime: '10:00 AM'
    };
    const bccChunk = ['stu1@test.com', 'stu2@test.com'];
    const startTime = Date.now();
    const res = await emailService.sendStudentRegistrationReminderBatch(mockEvent, bccChunk, true, 'Welcome', 1);
    const duration = Date.now() - startTime;
    
    assert(res.success, `Batch send failed: ${res.error}`);
    assert(res.messageId, 'No messageId returned from batch send');
    logPass(`sendStudentRegistrationReminderBatch dispatched successfully (Duration: ${duration}ms)`);
  } catch (err) {
    logFail('Chunked BCC Dispatch test failed', err);
  }

  // --- 4. Distributed Heartbeat Locking ---
  console.log('\n--- 4. Testing Distributed Heartbeat Locking ---');
  const lockName = `testLock_${Date.now()}`;
  try {
    let execCount = 0;

    // First execution should acquire lock and succeed
    const res1 = await NotificationScheduler.runWithLock(lockName, async () => {
      execCount++;
      return 'SUCCESS_1';
    });
    assert.strictEqual(res1.skipped, false);
    assert.strictEqual(res1.result, 'SUCCESS_1');
    logPass('Lock acquired successfully on clean lock document');

    // Manually simulate active lock by another instance
    await setDoc(doc(db, 'schedulerLocks', lockName), {
      locked: true,
      lockedBy: 'other-replica-999',
      lockedAt: new Date().toISOString(),
      lockedUntil: new Date(Date.now() + 180000).toISOString(),
      heartbeatAt: new Date().toISOString()
    });

    // Second execution should be skipped because lock is held with active heartbeat
    const res2 = await NotificationScheduler.runWithLock(lockName, async () => {
      execCount++;
      return 'SUCCESS_2';
    });
    assert.strictEqual(res2.skipped, true);
    assert.strictEqual(res2.reason, 'LOCKED_BY_OTHER_INSTANCE');
    assert.strictEqual(execCount, 1);
    logPass('Scheduler skips job execution when active heartbeat lock is held by another replica');

    // Simulate stale lock (heartbeat > 3 minutes ago)
    const staleTime = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    await setDoc(doc(db, 'schedulerLocks', lockName), {
      locked: true,
      lockedBy: 'crashed-replica-000',
      lockedAt: staleTime,
      lockedUntil: staleTime,
      heartbeatAt: staleTime
    });

    // Third execution should take over stale lock
    const res3 = await NotificationScheduler.runWithLock(lockName, async () => {
      execCount++;
      return 'RECOVERED_SUCCESS';
    });
    assert.strictEqual(res3.skipped, false);
    assert.strictEqual(res3.result, 'RECOVERED_SUCCESS');
    assert.strictEqual(execCount, 2);
    logPass('Scheduler successfully recovers stale heartbeat lock from crashed replica');
  } catch (err) {
    logFail('Distributed Heartbeat Locking test failed', err);
  } finally {
    try { await deleteDoc(doc(db, 'schedulerLocks', lockName)); } catch (e) {}
  }

  // --- 5. StudentReminderJob Chunk-Level Atomic writeBatch Execution ---
  console.log('\n--- 5. Testing StudentReminderJob Execution & Metrics ---');
  const testEvtId = `evt_job_${Date.now()}`;
  const regIds = [];
  try {
    // Create mock event in Firestore
    await setDoc(doc(db, 'events', testEvtId), {
      title: 'AI Bootcamp',
      referenceId: 'EVT-2026-JOB',
      venue: 'Lab 3',
      date: new Date().toISOString().split('T')[0],
      startTime: '14:00'
    });

    // Create 3 pending registration documents scheduled now
    const nowIso = new Date().toISOString();
    for (let i = 1; i <= 3; i++) {
      const regRef = await addDoc(collection(db, 'eventRegistrations'), {
        eventId: testEvtId,
        studentEmail: `job_stu_${i}_${Date.now()}@test.com`,
        status: 'REGISTERED',
        registrationStatus: 'APPROVED',
        notificationPending: true,
        notificationSent: false,
        notificationScheduledAt: nowIso
      });
      regIds.push(regRef.id);
    }

    // Run StudentReminderJob
    const metrics = await StudentReminderJob.run();
    assert(metrics.approvedStudents >= 3, `Expected at least 3 approved students, got ${metrics.approvedStudents}`);
    assert(metrics.chunksSent >= 2, `Expected at least 2 chunks sent (batch size 2), got ${metrics.chunksSent}`);
    logPass(`StudentReminderJob completed with valid metrics (Chunks: ${metrics.chunksSent}, Duration: ${metrics.duration})`);

    // Verify all 3 documents were updated via atomic writeBatch
    for (const rid of regIds) {
      const snap = await getDoc(doc(db, 'eventRegistrations', rid));
      assert.strictEqual(snap.data().notificationPending, false, `reg ${rid} notificationPending not false`);
      assert.strictEqual(snap.data().notificationSent, true, `reg ${rid} notificationSent not true`);
    }
    logPass('All registration documents atomically updated via chunk-level writeBatch');
  } catch (err) {
    logFail('StudentReminderJob execution test failed', err);
  } finally {
    try { await deleteDoc(doc(db, 'events', testEvtId)); } catch (e) {}
    for (const rid of regIds) {
      try { await deleteDoc(doc(db, 'eventRegistrations', rid)); } catch (e) {}
    }
  }

  // --- 6. RegistrationAutoCloseJob Policy Enforcement ---
  console.log('\n--- 6. Testing RegistrationAutoCloseJob Policy Enforcement ---');
  const closeEvtId1 = `evt_close_now_${Date.now()}`;
  const closeEvtId2 = `evt_close_future_${Date.now()}`;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    // Event starting in 15 mins (<= 30 mins threshold) -> Should close
    const startSoon = new Date(now.getTime() + 15 * 60 * 1000);
    const timeSoonStr = `${String(startSoon.getHours()).padStart(2, '0')}:${String(startSoon.getMinutes()).padStart(2, '0')}`;
    
    // Event starting in 3 hours (> 30 mins threshold) -> Should remain open
    const startLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const timeLaterStr = `${String(startLater.getHours()).padStart(2, '0')}:${String(startLater.getMinutes()).padStart(2, '0')}`;

    await setDoc(doc(db, 'events', closeEvtId1), {
      title: 'Starting Very Soon Event',
      registrationOpen: true,
      date: todayStr,
      startTime: timeSoonStr
    });

    await setDoc(doc(db, 'events', closeEvtId2), {
      title: 'Starting Later Event',
      registrationOpen: true,
      date: todayStr,
      startTime: timeLaterStr
    });

    const closeRes = await RegistrationAutoCloseJob.run();
    assert(closeRes.closedCount >= 1, `Expected at least 1 closed event, got ${closeRes.closedCount}`);

    const snap1 = await getDoc(doc(db, 'events', closeEvtId1));
    assert.strictEqual(snap1.data().registrationOpen, false, 'Event starting in 15 mins was not auto-closed');
    logPass('RegistrationAutoCloseJob successfully closed event starting in <= 30 mins');

    const snap2 = await getDoc(doc(db, 'events', closeEvtId2));
    assert.strictEqual(snap2.data().registrationOpen, true, 'Event starting in 3 hours should not be closed');
    logPass('RegistrationAutoCloseJob left future event (> 30 mins) open as expected');
  } catch (err) {
    logFail('RegistrationAutoCloseJob policy enforcement test failed', err);
  } finally {
    try { await deleteDoc(doc(db, 'events', closeEvtId1)); } catch (e) {}
    try { await deleteDoc(doc(db, 'events', closeEvtId2)); } catch (e) {}
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('====================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerificationSuite();
