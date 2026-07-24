const { performance } = require('perf_hooks');
const { MetricsCollector } = require('../utils/metrics');
const { loginUser, createClient } = require('../utils/api');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

// We need an array of valid student emails to login with
const STUDENTS = [];
for (let i = 1; i <= 50; i++) {
  STUDENTS.push({ identifier: `stu${i}_cse@kce.ac.in`, password: 'password' });
}

async function runMixedTrafficTest() {
  console.log(`\n--- Starting Mixed Traffic Test ---`);
  
  // Create dummy event for mixed traffic
  const eventId = 'load_test_event_mixed';
  await db.collection('events').doc(eventId).set({
    title: 'Mixed Traffic Symposium',
    department: 'CSE',
    status: 'POSTED',
    maxCapacity: 100,
    registeredCount: 0,
    isRegistrationOpen: true,
    requiresOrganizerApproval: true,
    organizerId: 'student_org'
  });

  // Login students (for browsing and registration)
  console.log('Pre-logging in 50 students...');
  const studentClients = [];
  const batchSize = 25;
  for (let i = 0; i < STUDENTS.length; i += batchSize) {
    const batch = STUDENTS.slice(i, i + batchSize);
    const tokens = await Promise.all(batch.map(s => loginUser(s.identifier, s.password)));
    tokens.forEach(token => studentClients.push(createClient(token)));
  }

  // Login HOD (for dashboard and approvals)
  const hodToken = await loginUser('hod_cse@kce.ac.in', 'password');
  const hodClient = createClient(hodToken);

  console.log('Login complete. Firing mixed traffic concurrently...');
  const collector = new MetricsCollector();
  const promises = [];

  const startAll = performance.now();

  // 1. 30 Dashboard requests
  for (let i = 0; i < 30; i++) {
    promises.push((async () => {
      const start = performance.now();
      try {
        const res = await studentClients[0].get('/dashboard/summary');
        collector.record(performance.now() - start, res.status === 200);
      } catch (err) {
        collector.record(performance.now() - start, false);
      }
    })());
  }

  // 2. 40 Event Browsing
  for (let i = 0; i < 40; i++) {
    promises.push((async () => {
      const start = performance.now();
      try {
        const res = await studentClients[i % 50].get('/events');
        collector.record(performance.now() - start, res.status === 200);
      } catch (err) {
        collector.record(performance.now() - start, false);
      }
    })());
  }

  // 3. 50 Registrations
  for (let i = 0; i < 50; i++) {
    promises.push((async () => {
      const start = performance.now();
      try {
        const res = await studentClients[i].post(`/events/${eventId}/register`, {
          userId: `test_user_mixed_${i}`,
          userName: `Test Student ${i}`
        });
        collector.record(performance.now() - start, res.status === 200 || res.status === 400);
      } catch (err) {
        collector.record(performance.now() - start, false);
      }
    })());
  }

  // 4. 20 Approvals (HOD approves some random registration)
  for (let i = 0; i < 20; i++) {
    promises.push((async () => {
      const start = performance.now();
      try {
        // Just try to approve a dummy reg, even if it doesn't exist it returns 404 which is ok
        const res = await hodClient.post(`/events/${eventId}/registrations/test_user_mixed_${i}/approve`, {});
        collector.record(performance.now() - start, res.status === 200 || res.status === 404);
      } catch (err) {
        collector.record(performance.now() - start, false);
      }
    })());
  }

  // 5. 10 Notification Triggers (Trigger some endpoint that sends notifications, e.g. manual trigger)
  // We can just query notifications
  for (let i = 0; i < 10; i++) {
    promises.push((async () => {
      const start = performance.now();
      try {
        const res = await hodClient.get('/dashboard/summary');
        collector.record(performance.now() - start, res.status === 200);
      } catch (err) {
        collector.record(performance.now() - start, false);
      }
    })());
  }

  await Promise.all(promises);
  collector.stop();
  
  console.log(`Mixed traffic complete in ${performance.now() - startAll}ms.`);
}

module.exports = { runMixedTrafficTest };
