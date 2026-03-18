const { collection, getDocs } = require('firebase/firestore');
const { db } = require('./firebase');

async function test() {
  const snapshot = await getDocs(collection(db, 'events'));
  const statuses = {};
  for (const doc of snapshot.docs) {
    const s = doc.data().status || 'undefined';
    statuses[s] = (statuses[s] || 0) + 1;
  }
  console.log('Statuses:', statuses);
}
test().then(() => process.exit(0)).catch(console.error);
