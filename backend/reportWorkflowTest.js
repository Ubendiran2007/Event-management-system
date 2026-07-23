require('dotenv').config();
const { dbAdmin } = require('./firebaseAdmin');
const eventBus = require('./events/eventBus');
require('./notifications/orchestrator/notificationOrchestrator');
require('./events/consumers/auditConsumer');
const eventPublisher = require('./events/publishers/eventPublisher');
const crypto = require('crypto');

async function runTest() {
  try {
    console.log('--- Starting Post-Event Report Workflow Test ---');
    
    const eventId = 'event-tech-123';
    const organizerId = 'org-123';
    
    // Simulate POST /api/iqac/:eventId
    console.log('[Test] Triggering REPORT_SUBMITTED...');
    eventPublisher.publishReportSubmitted({
      reportId: eventId,
      organizerId,
      iqacIds: ['iqac_admin'],
      eventId,
      eventTitle: 'Tech Symposium 2026',
      correlationId: crypto.randomUUID()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate IQAC Review Started
    console.log('[Test] Triggering IQAC_REVIEW_STARTED...');
    eventPublisher.publishIqacReviewStarted({
      reportId: eventId,
      iqacUserId: 'iqac_admin',
      organizerIds: [organizerId],
      eventId,
      eventTitle: 'Tech Symposium 2026',
      correlationId: crypto.randomUUID()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate Report Approved
    console.log('[Test] Triggering REPORT_APPROVED...');
    eventPublisher.publishReportApproved({
      reportId: eventId,
      iqacUserId: 'iqac_admin',
      organizerIds: [organizerId],
      eventId,
      eventTitle: 'Tech Symposium 2026',
      correlationId: crypto.randomUUID()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify Audit Logs
    console.log('[Test] Verifying Audit Logs...');
    const auditDocs = await dbAdmin.collection('system_audit')
      .where('entityId', '==', eventId)
      .where('entityType', '==', 'REPORT')
      .get();
      
    console.log(`Found ${auditDocs.size} audit logs for Report ${eventId}.`);
    auditDocs.forEach(doc => console.log(doc.data().type));

    console.log('--- Test Complete ---');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTest();
