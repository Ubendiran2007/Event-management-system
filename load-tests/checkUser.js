require('dotenv').config({ path: 'E:/Event-management-system/backend/.env' });
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}
const db = getFirestore();

async function check() {
  const docs = await db.collection('users').where('email', '==', 'stu1_cse@kce.ac.in').get();
  console.log('checkUser docs size:', docs.size);
}
check();
