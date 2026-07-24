const { performance } = require('perf_hooks');
const { MetricsCollector } = require('../utils/metrics');
const { loginUser, createClient } = require('../utils/api');
const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

async function runMixedTrafficTest(durationSec = 20, concurrency = 20) {
  console.log(`\n--- Starting Mixed Traffic Test (${durationSec}s, concurrency ${concurrency}) ---`);
  
  // Login some users
  const studentToken = await loginUser('stu1_cse@kce.ac.in', 'password');
  const studentClient = createClient(studentToken);
  
  const orgToken = await loginUser('faculty.cse', 'password');
  const orgClient = createClient(orgToken);
  
  const collector = new MetricsCollector();
  const startTime = performance.now();
  
  let running = true;
  
  // We'll run a fixed number of concurrent workers that loop until duration is up
  const workers = [];
  
  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (running) {
        const reqStart = performance.now();
        const rand = Math.random() * 100;
        let success = false;
        
        try {
          if (rand < 40) {
            // 40% Dashboard
            const res = await studentClient.get('/dashboard/summary');
            success = res.status === 200;
          } else if (rand < 65) {
            // 25% Event browsing
            const res = await studentClient.get('/events');
            success = res.status === 200;
          } else if (rand < 80) {
            // 15% Registration (might fail with capacity/duplicate but that's fine for throughput)
            const res = await studentClient.post(`/events/load_test_event_1/register`, {});
            success = [200, 400].includes(res.status);
          } else if (rand < 90) {
            // 10% Approvals
            const res = await orgClient.post(`/events/load_test_event_2/registrations/student_test_123/approve`, {});
            success = [200, 400, 403].includes(res.status);
          } else {
            // 10% Notifications / DB read
            const snap = await db.collection('notifications').limit(5).get();
            success = true;
          }
        } catch (e) {
          success = false;
        }
        
        collector.record(performance.now() - reqStart, success);
        
        // Small delay to simulate realistic pacing (10-50ms)
        await new Promise(r => setTimeout(r, 10 + Math.random() * 40));
      }
    })());
  }

  // Wait for the duration
  await new Promise(r => setTimeout(r, durationSec * 1000));
  running = false;
  
  // Wait for workers to finish their last request
  await Promise.all(workers);
  
  collector.stop();
  return collector.getReport();
}

module.exports = { runMixedTrafficTest };
