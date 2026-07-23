require('dotenv').config();
const { dbAdmin } = require('./firebaseAdmin');
const eventBus = require('./events/eventBus');
require('./notifications/orchestrator/notificationOrchestrator');
require('./events/consumers/auditConsumer');
const eventPublisher = require('./events/publishers/eventPublisher');
const crypto = require('crypto');

async function runTest() {
  try {
    console.log('--- Starting OD Workflow Test ---');
    
    const eventId = 'event-tech-123';
    const studentId = 'student-xyz';
    const odId = `od_${eventId}_${studentId}`;
    
    // Simulate POST /api/od-requests
    console.log('[Test] Triggering OD_REQUESTED...');
    eventPublisher.publishOdRequested({
      odId,
      studentId,
      studentName: 'Alice Johnson',
      approverIds: ['org-123'],
      eventId,
      eventTitle: 'Hackathon 2026',
      correlationId: crypto.randomUUID()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate PATCH /api/od-requests/:id/status (PENDING_HOD)
    console.log('[Test] Triggering OD_FACULTY_APPROVED...');
    eventPublisher.publishOdFacultyApproved({
      odId,
      studentId,
      studentName: 'Alice Johnson',
      facultyId: 'faculty-999',
      hodIds: ['hod-cse'],
      eventId,
      eventTitle: 'Hackathon 2026',
      correlationId: crypto.randomUUID()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate PATCH /api/od-requests/:id/status (PENDING_IQAC / APPROVED)
    console.log('[Test] Triggering OD_HOD_APPROVED...');
    eventPublisher.publishOdHodApproved({
      odId,
      studentId,
      studentName: 'Alice Johnson',
      hodId: 'hod-cse',
      eventId,
      eventTitle: 'Hackathon 2026',
      correlationId: crypto.randomUUID()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify Audit Logs
    console.log('[Test] Verifying Audit Logs...');
    const auditDocs = await dbAdmin.collection('system_audit')
      .where('entityId', '==', odId)
      .get();
      
    console.log(`Found ${auditDocs.size} audit logs for OD ${odId}.`);
    auditDocs.forEach(doc => console.log(doc.data().type));

    console.log('--- Test Complete ---');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTest();
