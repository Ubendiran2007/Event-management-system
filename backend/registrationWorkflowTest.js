require('dotenv').config();
const { dbAdmin } = require('./firebaseAdmin');
const eventBus = require('./events/eventBus');
require('./notifications/orchestrator/notificationOrchestrator');
require('./events/consumers/auditConsumer');
const eventPublisher = require('./events/publishers/eventPublisher');
const crypto = require('crypto');

async function runTest() {
  try {
    console.log('--- Starting Registration Workflow Test ---');
    
    const eventId = 'event-tech-123';
    const userId = 'student-xyz';
    const registrationId = `${eventId}_${userId}`;
    
    // Simulate POST /api/events/:id/register
    console.log('[Test] Triggering REGISTRATION_SUBMITTED...');
    eventPublisher.publishRegistrationSubmitted({
      registrationId,
      studentId: userId,
      studentName: 'Alice Johnson',
      organizerIds: ['org-123', 'org-456'],
      eventId,
      eventTitle: 'Hackathon 2026',
      correlationId: crypto.randomUUID()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate POST /api/events/:id/withdraw
    console.log('[Test] Triggering REGISTRATION_CANCELLED...');
    eventPublisher.publishRegistrationCancelled({
      registrationId,
      studentId: userId,
      studentName: 'Alice Johnson',
      organizerIds: ['org-123', 'org-456'],
      eventId,
      eventTitle: 'Hackathon 2026',
      correlationId: crypto.randomUUID()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify Audit Logs
    console.log('[Test] Verifying Audit Logs...');
    const auditDocs = await dbAdmin.collection('system_audit')
      .where('entityId', '==', registrationId)
      .get();
      
    console.log(`Found ${auditDocs.size} audit logs for registration ${registrationId}.`);
    auditDocs.forEach(doc => console.log(doc.data().type));

    console.log('--- Test Complete ---');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTest();
