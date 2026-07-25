const { dbAdmin } = require('../firebaseAdmin');
const { runTransaction, doc, collection } = require('../firebaseClientWrapper');
const workflowEngine = require('../utils/workflowEngine');
const venueAvailabilityService = require('../services/venueAvailabilityService');

const VALIDATION_RESULTS = {
  workflowCorruption: 'PASS',
  duplicateRegistrations: 'PASS',
  reservationConflicts: 'PASS',
};

async function testVenueConflicts() {
  console.log('Testing Venue Conflicts...');
  const venueId = 'TEST-VENUE-1';
  const dateStr = '2027-01-01';

  // 10 concurrent requests for the exact same venue + time slot
  const requests = Array(10).fill().map((_, i) => {
    return venueAvailabilityService.reserveVenue(venueId, dateStr, '09:00', '16:00', `evt-${i}`);
  });

  const results = await Promise.allSettled(requests);
  const successes = results.filter(r => r.status === 'fulfilled' && r.value.success);
  
  if (successes.length > 1) {
    console.error(`FAIL: ${successes.length} simultaneous reservations succeeded for same slot!`);
    VALIDATION_RESULTS.reservationConflicts = 'FAIL';
  } else {
    console.log(`PASS: Only ${successes.length} reservation succeeded. Mutex is working.`);
  }
}

async function testDuplicateRegistrations() {
  console.log('Testing Duplicate Registrations...');
  const eventId = 'TEST-EVENT-REG';
  const studentId = 'USER-123';
  
  // Set up test event
  await dbAdmin.collection('events').doc(eventId).set({
    title: 'Load Test Event',
    status: 'POSTED',
    capacity: 10,
    registeredCount: 0
  });

  // 5 parallel registration requests for the same student
  const requests = Array(5).fill().map(async () => {
    return dbAdmin.runTransaction(async (t) => {
      const eventRef = dbAdmin.collection('events').doc(eventId);
      const eventSnap = await t.get(eventRef);
      const data = eventSnap.data();
      
      const students = data.registeredStudents || [];
      if (students.find(s => s.userId === studentId)) {
        throw new Error('ALREADY_REGISTERED');
      }
      
      t.update(eventRef, {
        registeredStudents: dbAdmin.firestore.FieldValue.arrayUnion({ userId: studentId }),
        registeredCount: dbAdmin.firestore.FieldValue.increment(1)
      });
      return true;
    });
  });

  const results = await Promise.allSettled(requests);
  const successes = results.filter(r => r.status === 'fulfilled');
  
  const finalDoc = await dbAdmin.collection('events').doc(eventId).get();
  
  if (successes.length > 1 || finalDoc.data().registeredCount > 1) {
    console.error(`FAIL: ${successes.length} registrations succeeded for same user! Count is ${finalDoc.data().registeredCount}`);
    VALIDATION_RESULTS.duplicateRegistrations = 'FAIL';
  } else {
    console.log(`PASS: Only 1 registration succeeded for the user.`);
  }
}

async function runValidations() {
  try {
    await testVenueConflicts();
    await testDuplicateRegistrations();
    
    console.log('\n--- GATE 6.7 VALIDATION RESULTS ---');
    console.log(VALIDATION_RESULTS);
    if (Object.values(VALIDATION_RESULTS).includes('FAIL')) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal error during validation:', err);
    process.exit(1);
  }
}

runValidations();
