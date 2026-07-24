const { runMixedTrafficTest } = require('./mixedTraffic');

async function runStabilityTest() {
  console.log(`\n--- Starting Long-Duration Stability Test (15 minutes) ---`);
  
  // We reuse the mixed traffic test but run it for 900 seconds (15 minutes)
  // with a slightly lower concurrency to represent sustained background load.
  const report = await runMixedTrafficTest(900, 10);
  
  console.log(`\nStability Test Complete.`);
  console.log(`Memory Growth: ${report.memory.growthPct}%`);
  
  if (parseFloat(report.memory.growthPct) > 10) {
    console.warn(`⚠️ WARNING: Memory grew by more than 10% during sustained load. Possible leak.`);
  } else {
    console.log(`✅ Memory remained stable over 15 minutes.`);
  }
  
  return report;
}

module.exports = { runStabilityTest };
