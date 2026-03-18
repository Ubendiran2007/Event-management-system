const { collection, addDoc, updateDoc, doc } = require('firebase/firestore');
const { db } = require('./firebase');
const { runEventAutoRejectionOnce } = require('./services/eventAutoRejectionService');

async function test() {
  const now = new Date();
  
  // Event that starts in 6 minutes
  const start6 = new Date(now.getTime() + 6 * 60 * 1000);
  const doc6 = await addDoc(collection(db, 'events'), {
    title: 'Start in 6 mins',
    status: 'PENDING_HOD',
    date: start6.toISOString().split('T')[0],
    startTime: start6.toTimeString().split(' ')[0].slice(0, 5), // HH:mm
  });

  // Event that starts in 4 minutes (should be rejected)
  const start4 = new Date(now.getTime() + 4 * 60 * 1000);
  const doc4 = await addDoc(collection(db, 'events'), {
    title: 'Start in 4 mins',
    status: 'PENDING_HOD',
    date: start4.toISOString().split('T')[0],
    startTime: start4.toTimeString().split(' ')[0].slice(0, 5), // HH:mm
  });

  console.log('Created doc6:', doc6.id, start6.toTimeString().split(' ')[0].slice(0, 5));
  console.log('Created doc4:', doc4.id, start4.toTimeString().split(' ')[0].slice(0, 5));

  const result = await runEventAutoRejectionOnce();
  console.log('Run result:', result);
}

test().then(() => process.exit(0)).catch(console.error);
