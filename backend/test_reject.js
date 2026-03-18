const { collection, getDocs } = require('firebase/firestore');
const { db } = require('./firebase');
const { parseEventStartDateTime } = require('./services/eventAutoRejectionService');

async function test() {
  const snapshot = await getDocs(collection(db, 'events'));
  let i = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log('Event', doc.id, data.status, 'Title:', data.title, data.date, data.startTime);
    const parsed = parseEventStartDateTime(data);
    console.log('Parsed:', parsed);
    if (++i > 10) break;
  }
}
test().catch(console.error);
