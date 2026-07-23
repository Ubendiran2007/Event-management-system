const EventEmitter = require('events');

class EmailQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Pushes a notification task onto the queue.
   * @param {Object} notification 
   */
  async enqueue(notification) {
    console.log(`[EmailQueue] Enqueued task [Correlation: ${notification.correlationId}]`);
    this.queue.push(notification);
    this.emit('job_added');
  }

  /**
   * Gets the next job from the queue.
   */
  dequeue() {
    return this.queue.shift();
  }

  /**
   * Returns the current size of the queue.
   */
  size() {
    return this.queue.length;
  }
}

module.exports = new EmailQueue();
