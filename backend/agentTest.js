require('dotenv').config();
const { dbAdmin } = require('./firebaseAdmin');
const eventBus = require('./events/eventBus');
require('./notifications/orchestrator/notificationOrchestrator'); // Must initialize to listen to EventBus
const notificationAgent = require('./notifications/agent/notificationAgent');

async function runTest() {
  try {
    console.log('--- Starting Notification AI Agent Test ---');
    
    // We need a dummy event in Firestore to test against
    const testEventId = 'agent-test-event-123';
    await dbAdmin.collection('events').doc(testEventId).set({
      title: 'Agent Test Event',
      status: 'PUBLISHED',
      expectedParticipants: 100,
      createdBy: 'test-organizer-id',
      createdAt: new Date().toISOString()
    });

    // Mock 10 registrations (so rate is 10%)
    const batch = dbAdmin.batch();
    for (let i = 0; i < 10; i++) {
      const regRef = dbAdmin.collection('registrations').doc(`reg-${i}`);
      batch.set(regRef, {
        eventId: testEventId,
        status: 'APPROVED'
      });
    }
    await batch.commit();

    console.log('Inserted dummy data. Running Agent Analysis...');

    // Run the agent
    await notificationAgent.runAnalysisForEvent(testEventId);

    // Give the EventBus a moment to process the emitted SYSTEM_ALERT
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('--- Test Complete ---');
    process.exit(0);

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTest();
