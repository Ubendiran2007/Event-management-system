require('dotenv').config({ path: 'E:/Event-management-system/backend/.env' });
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const bcrypt = require('bcryptjs');

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

async function fixUsers() {
  const auth = getAuth();
  
  // First, let's create stu1_cse@kce.ac.in to stu150_cse@kce.ac.in in Firestore
  let batch = db.batch();
  let count = 0;
  
  for (let i = 1; i <= 150; i++) {
    const email = `stu${i}_cse@kce.ac.in`;
    try {
      let uid;
      try {
        const userRecord = await auth.getUserByEmail(email);
        uid = userRecord.uid;
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          const userRecord = await auth.createUser({
            email,
            password: 'password',
            displayName: `Test Student ${i}`
          });
          uid = userRecord.uid;
        } else {
          throw err;
        }
      }
      
      const userDocRef = db.collection('users').doc(uid);
      const hashedPassword = bcrypt.hashSync('password', 10);
      batch.set(userDocRef, {
        email: email,
        password: hashedPassword,
        name: `Test Student ${i}`,
        role: 'STUDENT_GENERAL',
        status: 'ACTIVE',
        department: 'CSE'
      }, { merge: true });
      
      count++;
      
      if (count % 50 === 0) {
        await batch.commit();
        console.log(`Committed ${count} users...`);
        batch = db.batch();
      }
    } catch (err) {
      console.error(`Failed to process ${email}`, err);
    }
  }
  
  // Seed HOD
  const hodEmail = 'hod_cse@kce.ac.in';
  try {
    let hodUid;
    try {
      const userRecord = await auth.getUserByEmail(hodEmail);
      hodUid = userRecord.uid;
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        const userRecord = await auth.createUser({
          email: hodEmail,
          password: 'password',
          displayName: 'HOD CSE'
        });
        hodUid = userRecord.uid;
      }
    }
    const hodDocRef = db.collection('users').doc(hodUid);
    batch.set(hodDocRef, {
      email: hodEmail,
      password: bcrypt.hashSync('password', 10),
      name: 'HOD CSE',
      role: 'HOD',
      status: 'ACTIVE',
      department: 'CSE'
    }, { merge: true });
    count++;
  } catch(e) {}

  if (count % 50 !== 0) {
    await batch.commit();
    console.log(`Committed remaining users...`);
  }
  
  console.log(`Successfully processed ${count} users.`);
}

fixUsers();
