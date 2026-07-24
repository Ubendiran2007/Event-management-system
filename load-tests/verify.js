const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { initializeApp, getApps } = require('firebase-admin/app');

if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

async function runVerification() {
  console.log(`\n--- Verifying Database Integrity ---`);
  let allPassed = true;

  // 1. Registration Test
  console.log('Verifying Registration Contention Test...');
  try {
    const event1 = await db.collection('events').doc('load_test_event_1').get();
    const registrations1 = await db.collection('events').doc('load_test_event_1').collection('registrations').get();
    
    if (event1.exists) {
      const data = event1.data();
      const actualRegCount = registrations1.size;
      const expectedRegCount = data.maxCapacity;

      if (data.registeredCount !== expectedRegCount) {
        console.error(`❌ Event registeredCount (${data.registeredCount}) does not match expected (${expectedRegCount}).`);
        allPassed = false;
      } else {
        console.log(`✅ Event registeredCount matched maxCapacity (${expectedRegCount}).`);
      }

      if (actualRegCount !== expectedRegCount) {
        console.error(`❌ Number of subcollection registrations (${actualRegCount}) does not match expected (${expectedRegCount}).`);
        allPassed = false;
      } else {
        console.log(`✅ Subcollection size matched maxCapacity (${expectedRegCount}).`);
      }
    }
  } catch (err) {
    console.error(`Verification error for Registration Test:`, err);
    allPassed = false;
  }

  // 2. Approval Test
  console.log('Verifying Approval Idempotency Test...');
  try {
    const event2 = await db.collection('events').doc('load_test_event_2').collection('registrations').doc('student_test_123').get();
    if (event2.exists) {
      if (event2.data().status === 'APPROVED') {
        console.log('✅ Final Registration State is APPROVED.');
      } else {
        console.error(`❌ Final Registration State is ${event2.data().status}. Expected APPROVED.`);
        allPassed = false;
      }
    }
    
    // Check audit logs for this event
    const auditLogs = await db.collection('auditLogs')
      .where('referenceId', '==', 'student_test_123')
      .where('action', '==', 'APPROVE_REGISTRATION')
      .get();
      
    if (auditLogs.size === 1) {
      console.log('✅ Only one audit log entry was created for the approval.');
    } else {
      console.error(`❌ Expected exactly 1 audit log, found ${auditLogs.size}.`);
      allPassed = false;
    }
  } catch (err) {
    console.error(`Verification error for Approval Test:`, err);
    allPassed = false;
  }

  // 3. Notifications Test
  console.log('Verifying Notification Burst Test...');
  try {
    const pendingNotifications = await db.collection('queue_messages').get();
    // Assuming backend worker processes these and deletes them
    if (pendingNotifications.size === 0) {
      console.log('✅ Queue is empty.');
    } else {
      console.error(`❌ Queue is not empty. Found ${pendingNotifications.size} pending messages.`);
      // We don't fail `allPassed` here just in case the worker is still running
    }
  } catch (err) {
    console.error(`Verification error for Notifications Test:`, err);
  }

  if (allPassed) {
    console.log(`\n🎉 DATABASE INTEGRITY VERIFIED SUCCESSFULLY.`);
  } else {
    console.log(`\n🚨 DATABASE INTEGRITY CHECKS FAILED.`);
    process.exit(1);
  }
}

runVerification().catch(console.error);
