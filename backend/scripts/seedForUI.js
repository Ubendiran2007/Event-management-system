const admin = require('firebase-admin');

// Initialize Firebase Admin (assumes emulators are running)
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'demo-kce-event-management' });
}
const db = admin.firestore();
const auth = admin.auth();

async function seed() {
  console.log("Seeding UI Test Event...");
  const eventId = "ui_test_event_01";
  
  await db.collection('events').doc(eventId).set({
    title: 'UI Manual QA Test Event',
    description: 'This is an automated test event for UI validation.',
    date: new Date(Date.now() + 86400000).toISOString(),
    time: '10:00 AM',
    location: 'Main Auditorium',
    department: 'CSE',
    category: 'Workshop',
    organizerId: 'org1_cse',
    organizerName: 'Organizer CSE',
    status: 'POSTED',
    capacity: 10,
    requiresRegistrationApproval: true,
    stats: {
      registeredCount: 0,
      approvedCount: 0,
      rejectedCount: 0
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  console.log(`Created event: ${eventId}`);
  process.exit(0);
}

seed().catch(console.error);
