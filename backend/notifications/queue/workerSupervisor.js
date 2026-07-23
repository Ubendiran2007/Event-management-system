const emailQueue = require('./emailQueue');
const retryPolicy = require('./retryPolicy');
const dlq = require('./deadLetterQueue');
const sesProvider = require('../providers/sesProvider');
const notificationService = require('../services/notificationService');
const analyticsService = require('../../notifications/analytics/notificationAnalyticsService');

class WorkerSupervisor {
  constructor() {
    this.workers = {
      email: null
    };
  }

  /**
   * Starts all queue workers.
   */
  start() {
    console.log('[WorkerSupervisor] Starting queue workers...');
    this.startEmailWorker();
    this.startHealthMonitor();
  }

  /**
   * Periodically tracks system health metrics.
   */
  startHealthMonitor() {
    // Record every hour
    setInterval(() => {
      // Mock processTime and dlqSize for now
      const queueDepth = emailQueue.size();
      analyticsService.recordHealthSnapshot(queueDepth, 0, 0);
    }, 60 * 60 * 1000);
  }

  /**
   * Starts the email queue processor.
   */
  startEmailWorker() {
    // Listen to job_added events on the emailQueue
    emailQueue.on('job_added', async () => {
      if (emailQueue.isProcessing) return;
      
      emailQueue.isProcessing = true;
      while (emailQueue.size() > 0) {
        const job = emailQueue.dequeue();
        await this.processEmailJob(job);
      }
      emailQueue.isProcessing = false;
    });
  }

  async processEmailJob(job) {
    job.attempts = job.attempts || 0;
    job.attempts += 1;

    try {
      console.log(`[EmailWorker] Processing job [Correlation: ${job.correlationId}] (Attempt: ${job.attempts})`);

      // Using SES Provider to send the email
      const result = await sesProvider.sendEmail({
        to: job.recipientEmail || 'test@example.com', // Normally fetched via user mapping
        subject: job.title,
        html: `<p>${job.message}</p>`,
        text: job.message,
        correlationId: job.correlationId
      });

      console.log(`[EmailWorker] Successfully sent email [Correlation: ${job.correlationId}]. MessageId: ${result.messageId}`);
      
      // Update Timeline and mark SENT
      job.timeline.push({ status: 'SENT', timestamp: new Date().toISOString(), provider: result.provider });
      job.status = 'DELIVERED'; // Assuming SENT means DELIVERED for SES without webhooks
      
      await notificationService.saveNotification(job);
      
      // Email Analytics
      analyticsService.trackMetric('DELIVERY', 'sent');
      analyticsService.trackMetric('DELIVERY', 'delivered');

    } catch (error) {
      console.error(`[EmailWorker] Failed job [Correlation: ${job.correlationId}] - ${error.message}`);
      
      if (retryPolicy.shouldRetry(job.attempts)) {
        const delay = retryPolicy.getBackoffDelay(job.attempts);
        console.log(`[EmailWorker] Retrying in ${delay}ms...`);
        analyticsService.trackMetric('DELIVERY', 'retried');
        
        // Re-enqueue after delay
        setTimeout(() => {
          emailQueue.enqueue(job);
        }, delay);
      } else {
        console.error(`[EmailWorker] Max retries reached for [Correlation: ${job.correlationId}]. Routing to DLQ.`);
        await dlq.push(job, error);
        analyticsService.trackMetric('DELIVERY', 'failed');
      }
    }
  }

  // trackAnalytics is removed as we use analyticsService directly
}

module.exports = new WorkerSupervisor();
