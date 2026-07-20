const { dbAdmin: db } = require('./firebaseAdmin');

const ALL_CLASSES = [
  'CSE-A', 'CSE-B', 'CSE-C', 'CSE-D',
  'ECE-A', 'ECE-B', 'ECE-C',
  'CCE-A', 'CCE-B',
  'CSBS-A', 'CSBS-B',
  'MECH-A', 'MECH-B',
  'CYBER-A', 'CYBER-B',
  'EEE-A', 'EEE-B',
  'AIML-A', 'AIML-B',
  'AIDS-A', 'AIDS-B',
  'IT-A', 'IT-B', 'IT-C'
];

async function update() {
  let updated = 0;
  for (const cls of ALL_CLASSES) {
    const snapshot = await db.collection('students').doc(cls).collection('members').get();
    for (const doc of snapshot.docs) {
      if (!doc.data().academicBatch) {
        await doc.ref.update({ academicBatch: '2024-28' });
        updated++;
      }
    }
  }
  console.log('Updated ' + updated + ' students');
  process.exit(0);
}
update().catch(console.error);
