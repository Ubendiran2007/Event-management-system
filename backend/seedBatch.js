const { dbAdmin: db } = require('./firebaseAdmin');

async function run() {
  try {
    const batchRef = db.collection('academicBatches').doc('batch_2024_28');
    await batchRef.set({
      name: '2024-28',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    console.log('Batch 2024-28 added to db');
    process.exit(0);
  } catch (err) {
    console.error(err);
  }
}
run();
