const { performance } = require('perf_hooks');
const { MetricsCollector } = require('../utils/metrics');
const { loginUser, createClient } = require('../utils/api');

async function runDashboardTest(concurrency = 150) {
  console.log(`\n--- Starting Dashboard Load Test (${concurrency} concurrent reqs) ---`);
  // Login as a regular student
  console.log('Logging in as stu1_cse@kce.ac.in...');
  const token = await loginUser('stu1_cse@kce.ac.in', 'password');
  console.log('Login successful, starting requests...');
  const client = createClient(token);
  
  const collector = new MetricsCollector();
  
  const promises = [];
  
  for (let i = 0; i < concurrency; i++) {
    promises.push((async () => {
      const isSummary = Math.random() > 0.5;
      const url = isSummary ? '/dashboard/summary' : '/events';
      const start = performance.now();
      try {
        const res = await client.get(url);
        const latency = performance.now() - start;
        
        if (res.status === 200 && res.data.success) {
          collector.record(latency, true);
        } else {
          console.error(`Request failed to ${url} with status ${res.status}`);
          collector.record(latency, false);
        }
      } catch (err) {
        console.error(`Request error to ${url}: ${err.message}`);
        collector.record(performance.now() - start, false);
      }
    })());
  }

  await Promise.all(promises);
  collector.stop();
  
  return collector.getReport();
}

module.exports = { runDashboardTest };
