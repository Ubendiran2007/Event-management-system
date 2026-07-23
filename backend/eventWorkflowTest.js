require('dotenv').config();
const { dbAdmin } = require('./firebaseAdmin');
const eventBus = require('./events/eventBus');
require('./notifications/orchestrator/notificationOrchestrator');
require('./events/consumers/auditConsumer');
const eventPublisher = require('./events/publishers/eventPublisher');
const crypto = require('crypto');

async function runTest() {
  try {
    console.log('--- Starting Event Workflow Test ---');
    
    const eventId = 'workflow-test-' + Date.now();
    
    // Simulate POST /api/events
    console.log('[Test] Triggering EVENT_CREATED...');
    eventPublisher.publishEventCreated({
      eventId: eventId,
      organizerId: 'student-123',
      eventTitle: 'Tech Symposium 2026',
      eventType: 'Workshop',
      department: 'CSE',
      targetApprovers: ['faculty-456'],
      correlationId: crypto.randomUUID()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate PUT /api/events/:id/status
    console.log('[Test] Triggering EVENT_APPROVED...');
    eventPublisher.publishEventApproved({
      eventId: eventId,
      organizerId: 'student-123',
      actorId: 'faculty-456',
      eventTitle: 'Tech Symposium 2026',
      approverRole: 'FACULTY',
      correlationId: crypto.randomUUID()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify Audit Logs
    console.log('[Test] Verifying Audit Logs...');
    const auditDocs = await dbAdmin.collection('system_audit')
      .where('entityId', '==', eventId)
      .get();
      
    console.log(`Found ${auditDocs.size} audit logs for event ${eventId}.`);
    auditDocs.forEach(doc => console.log(doc.data().type));

    console.log('--- Test Complete ---');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTest();
