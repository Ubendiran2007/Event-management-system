require('dotenv').config();
const { dbAdmin: db } = require('./firebaseAdmin');

async function fixMock() {
  await db.collection('odRequests').doc('mock-od-req-123').update({
    eventDate: '2026-08-15'
  });
  console.log('Fixed mock eventDate');
  process.exit(0);
}

fixMock();
