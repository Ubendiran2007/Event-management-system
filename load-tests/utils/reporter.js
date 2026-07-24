const fs = require('fs');
const path = require('path');

function generateMarkdownReport(scenarioName, metrics) {
  return `
### Scenario: ${scenarioName}

**Execution Summary:**
- **Total Requests:** ${metrics.totalRequests}
- **Successes:** ${metrics.successes}
- **Errors:** ${metrics.errors}
- **Error Rate:** ${metrics.errorRatePct}%
- **Duration:** ${metrics.durationSec} s
- **Throughput:** ${metrics.throughputRps} req/s

**Latency Metrics (ms):**
- **P50:** ${metrics.latency.p50}
- **P95:** ${metrics.latency.p95}
- **P99:** ${metrics.latency.p99}
- **Max:** ${metrics.latency.max}

**Event Loop Delay (ms):**
- **Min:** ${metrics.eventLoopDelay.min}
- **Mean:** ${metrics.eventLoopDelay.mean}
- **Max:** ${metrics.eventLoopDelay.max}

**Memory Usage (RSS):**
- **Initial:** ${metrics.memory.initialRssMb} MB
- **Peak:** ${metrics.memory.peakRssMb} MB
- **Final:** ${metrics.memory.finalRssMb} MB
- **Growth:** ${metrics.memory.growthPct}%

---
`;
}

function appendToReport(reportString) {
  const reportPath = path.join(__dirname, '..', '..', '..', 'load_test_results.md');
  fs.appendFileSync(reportPath, reportString);
}

module.exports = { generateMarkdownReport, appendToReport };
