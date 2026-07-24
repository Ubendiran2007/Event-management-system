const { monitorEventLoopDelay, performance } = require('perf_hooks');

class MetricsCollector {
  constructor() {
    this.latencies = [];
    this.errors = 0;
    this.successes = 0;
    this.startTime = performance.now();
    this.endTime = null;
    
    // Monitor event loop delay
    this.histogram = monitorEventLoopDelay({ resolution: 20 });
    this.histogram.enable();
    
    this.initialMemory = process.memoryUsage();
    this.peakRss = this.initialMemory.rss;
    
    // Periodically poll memory to find peak
    this.interval = setInterval(() => {
      const mem = process.memoryUsage();
      if (mem.rss > this.peakRss) this.peakRss = mem.rss;
    }, 100);
  }

  record(latencyMs, isSuccess) {
    this.latencies.push(latencyMs);
    if (isSuccess) this.successes++;
    else this.errors++;
  }

  stop() {
    this.endTime = performance.now();
    this.histogram.disable();
    clearInterval(this.interval);
    this.finalMemory = process.memoryUsage();
  }

  getReport() {
    this.latencies.sort((a, b) => a - b);
    
    const count = this.latencies.length;
    const p50 = count > 0 ? this.latencies[Math.floor(count * 0.50)] : 0;
    const p95 = count > 0 ? this.latencies[Math.floor(count * 0.95)] : 0;
    const p99 = count > 0 ? this.latencies[Math.floor(count * 0.99)] : 0;
    const max = count > 0 ? this.latencies[count - 1] : 0;
    
    const durationSec = (this.endTime - this.startTime) / 1000;
    const throughput = count / durationSec;
    const errorRate = count > 0 ? (this.errors / count) * 100 : 0;

    return {
      totalRequests: count,
      successes: this.successes,
      errors: this.errors,
      errorRatePct: errorRate.toFixed(2),
      durationSec: durationSec.toFixed(2),
      throughputRps: throughput.toFixed(2),
      latency: {
        p50: p50.toFixed(2),
        p95: p95.toFixed(2),
        p99: p99.toFixed(2),
        max: max.toFixed(2)
      },
      eventLoopDelay: {
        min: (this.histogram.min / 1e6).toFixed(2),
        max: (this.histogram.max / 1e6).toFixed(2),
        mean: (this.histogram.mean / 1e6).toFixed(2)
      },
      memory: {
        initialRssMb: (this.initialMemory.rss / 1024 / 1024).toFixed(2),
        peakRssMb: (this.peakRss / 1024 / 1024).toFixed(2),
        finalRssMb: (this.finalMemory.rss / 1024 / 1024).toFixed(2),
        growthPct: (((this.finalMemory.rss - this.initialMemory.rss) / this.initialMemory.rss) * 100).toFixed(2)
      }
    };
  }
}

module.exports = { MetricsCollector };
