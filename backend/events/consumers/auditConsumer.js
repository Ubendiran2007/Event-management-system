const eventBus = require('../eventBus');
const { dbAdmin } = require('../../firebaseAdmin');

class AuditConsumer {
  constructor() {
    // Listen to ALL events published to the EventBus
    eventBus.on('*', async (eventPayload) => {
      await this.logEvent(eventPayload);
    });
    console.log('[AuditConsumer] Initialized. Listening to all events.');
  }

  async logEvent(payload) {
    try {
      // Securely log the raw business event
      // Create a document using the correlationId + type + timestamp to ensure we don't overwrite
      const docId = `${payload.correlationId}_${payload.type}_${Date.now()}`;
      
      await dbAdmin.collection('system_audit').doc(docId).set({
        ...payload,
        auditTimestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('[AuditConsumer] Failed to write to audit log:', error);
      // Consumer isolation ensures this throw will NOT crash the Notification system!
      throw error; 
    }
  }
}

// Instantiate to attach listeners
module.exports = new AuditConsumer();
