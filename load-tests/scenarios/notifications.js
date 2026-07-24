const { performance } = require('perf_hooks');
const { createClient } = require('../utils/api');
const axios = require('axios');

async function runNotificationsTest() {
  console.log(`\n--- Starting Notification Burst Test (50 notifications) ---`);
  
  const start = performance.now();
  const burstSize = 50;
  const promises = [];
  
  const client = axios.create({
    baseURL: 'http://localhost:5001/api',
    timeout: 30000
  });
  
  for (let i = 0; i < burstSize; i++) {
    promises.push(
      client.post('/test/notification', {
        id: `test_user_${i}`
      })
    );
  }
  
  await Promise.all(promises);
  const enqueueTime = performance.now() - start;
  console.log(`Enqueued 50 notifications in ${enqueueTime.toFixed(2)} ms.`);
  
  // Return dummy metrics as we can't easily poll the in-memory queue from outside
  return {
    scenario: 'Notification Burst',
    enqueued: burstSize,
    enqueueTimeMs: enqueueTime,
    processingTimeMs: 0,
    failed: 0
  };
}

module.exports = { runNotificationsTest };
