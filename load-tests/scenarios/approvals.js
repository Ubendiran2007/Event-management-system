const { performance } = require('perf_hooks');
const { MetricsCollector } = require('../utils/metrics');
const { loginUser, createClient } = require('../utils/api');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

async function runApprovalsTest() {
  console.log(`\n--- Starting Approvals Idempotency Test (50 concurrent reqs) ---`);
  
  // 1. Create a dummy event & registration
  const eventId = 'load_test_event_2';
  const studentId = 'student_test_123';
  
  await db.collection('events').doc(eventId).set({
    title: 'Idempotency Test Event',
    department: 'CSE',
    status: 'POSTED',
    requiresOrganizerApproval: true,
    organizerId: 'student_org'
  });
  
  await db.collection('events').doc(eventId).collection('registrations').doc(studentId).set({
    studentId: studentId,
    status: 'PENDING_APPROVAL'
  });
  
  await db.collection('eventRegistrations').doc(`${eventId}_${studentId}`).set({
    eventId: eventId,
    userId: studentId,
    status: 'PENDING_APPROVAL'
  });
  
  // 2. Login as organizer
  const token = await loginUser('hod_cse@kce.ac.in', 'password');
  const client = createClient(token);
  
  const collector = new MetricsCollector();
  const promises = [];

  // 3. Fire 10 identical approval requests concurrently
  for (let i = 0; i < 10; i++) {
    promises.push((async () => {
      const jitterMs = Math.random() * 2000;
      await new Promise(resolve => setTimeout(resolve, jitterMs));
      const start = performance.now();
      try {
        const res = await client.patch(`/events/${eventId}/registrations/${studentId}/status`, {
          status: 'REGISTERED'
        });
        const latency = performance.now() - start;
        
        if (res.status === 200) {
          collector.record(latency, true);
        } else {
          console.error(`Approvals Unexpected response: ${res.status} - ${JSON.stringify(res.data)}`);
          collector.record(latency, false);
        }
      } catch (err) {
        console.error(`Approvals Error:`, err.message);
        collector.record(performance.now() - start, false);
      }
    })());
  }

  await Promise.all(promises);
  collector.stop();
  
  // 4. Verify Final State
  const regDoc = await db.collection('events').doc(eventId).collection('registrations').doc(studentId).get();
  
  // Check audit logs for this specific registration
  const auditLogs = await db.collection('auditLogs')
    .where('eventId', '==', eventId)
    .where('targetId', '==', studentId)
    .get();
    
  console.log(`\nFinal Registration State: ${regDoc.data().status}`);
  console.log(`Audit log entries generated: ${auditLogs.size}`);
  
  if (auditLogs.size !== 1) {
    console.error('❌ IDEMPOTENCY FAILURE! Multiple audit logs created.');
    collector.errors++;
  } else {
    console.log('✅ Idempotency strictly enforced.');
  }
  
  return collector.getReport();
}

module.exports = { runApprovalsTest };
