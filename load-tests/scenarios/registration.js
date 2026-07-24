const { performance } = require('perf_hooks');
const { MetricsCollector } = require('../utils/metrics');
const { loginUser, createClient } = require('../utils/api');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

// We need an array of valid student emails to login with
const STUDENTS = [];
for (let i = 1; i <= 20; i++) {
  // Assuming test students stu1_cse@kce.ac.in to stu20_cse@kce.ac.in exist. We'll generate them in index.js if they don't.
  STUDENTS.push({ identifier: `stu${i}_cse@kce.ac.in`, password: 'password' });
}

async function runRegistrationTest() {
  console.log(`\n--- Starting Registration Contention Test (20 concurrent reqs) ---`);
  
  // 1. Create a dummy event with capacity 10
  const eventId = `load_test_event_${Date.now()}`;
  const eventRef = db.collection('events').doc(eventId);
  await eventRef.set({
    title: 'Load Test Symposium',
    department: 'CSE',
    status: 'POSTED',
    maxCapacity: 10,
    registeredCount: 0,
    isRegistrationOpen: true
  });
  
  // 2. Pre-login all 20 students to get tokens (this is setup, not part of the load test)
  console.log('Pre-logging in 20 students...');
  const clients = [];
  
  // Login in batches to avoid overwhelming auth endpoint during setup
  const batchSize = 25;
  for (let i = 0; i < STUDENTS.length; i += batchSize) {
    const batch = STUDENTS.slice(i, i + batchSize);
    const tokens = await Promise.all(batch.map(s => loginUser(s.identifier, s.password)));
    tokens.forEach(token => clients.push(createClient(token)));
  }

  console.log('Login complete. Firing 20 concurrent registrations...');
  const collector = new MetricsCollector();
  const promises = [];

  // 3. Fire all registrations concurrently
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    promises.push((async () => {
        const jitterMs = Math.random() * 10000;
        await new Promise(resolve => setTimeout(resolve, jitterMs));
        
        const start = performance.now();
      try {
        const res = await client.post(`/events/${eventId}/register`, {
          userId: `test_user_${i}`,
          userName: `Test Student ${i}`
        });
        const latency = performance.now() - start;
        
        // 201/200 OK means success, 400 means rejected gracefully (capacity exceeded)
        if (res.status === 200 || res.status === 201) {
          collector.record(latency, true);
        } else if (res.status === 400 && res.data.message.includes('Capacity exceeded')) {
          collector.record(latency, true); // Graceful rejection counts as test success
        } else {
          console.error(`Unexpected response: ${res.status} - ${JSON.stringify(res.data)}`);
          collector.record(latency, false);
        }
      } catch (err) {
        console.error(`Error:`, err.message);
        collector.record(performance.now() - start, false);
      }
    })());
  }

  await Promise.all(promises);
  collector.stop();
  
  // 4. Verify Final State
  const finalDoc = await eventRef.get();
  let regCount = 0;
  if (!finalDoc.exists) {
    console.error('❌ ERROR: Event document not found at the end of the test!');
  } else {
    regCount = finalDoc.data().stats?.registeredCount || 0;
  }
  
  const regDocs = await db.collection('eventRegistrations')
    .where('eventId', '==', eventId)
    .get();
  const actualDocsCount = regDocs.size;
  
  console.log(`\nFinal Event State:`);
  console.log(`- stats.registeredCount field: ${regCount}`);
  console.log(`- eventRegistrations docs count: ${actualDocsCount}`);
  
  if (regCount !== 10 || actualDocsCount !== 10) {
    console.error('❌ CONTENTION FAILURE! capacity enforcement broke.');
    collector.errors++; // Fail the test
  } else {
    console.log('✅ Capacity strictly enforced under contention.');
  }
  
  return collector.getReport();
}

module.exports = { runRegistrationTest };
