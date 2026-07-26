require('dotenv').config();
const { dbAdmin: db } = require('./firebaseAdmin');

async function testQuery() {
  const department = 'CSE';
  
  const q = db.collection('odRequests')
    .where('department', '==', department)
    .where('status', 'in', ['PENDING_FACULTY', 'APPROVED']);
    
  const snapshot = await q.get();
  console.log(`Query returned ${snapshot.size} documents.`);
  snapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data().class, doc.data().status);
  });
  
  process.exit(0);
}

testQuery();
