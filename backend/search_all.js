require('dotenv').config();
const { dbAdmin: db } = require('./firebaseAdmin');

async function searchAll() {
  const collections = await db.listCollections();
  for (const col of collections) {
      console.log('Searching', col.id);
      const snap = await col.where('email', '==', 'thamilselvan.p2024cse@sece.ac.in').get();
      snap.forEach(doc => {
          console.log(`FOUND in ${col.id}/${doc.id}`);
      });
  }
}

searchAll().catch(console.error);
