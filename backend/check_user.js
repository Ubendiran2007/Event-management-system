require('dotenv').config();
const { dbAdmin: db } = require('./firebaseAdmin');

async function checkUser() {
  const email = "thamilselvan.p2024cse@sece.ac.in";
  console.log("Checking users collection...");
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', email).get();
  
  if (snapshot.empty) {
    console.log("Not found in users collection.");
    
    console.log("Checking collectionGroup('members')...");
    const membersSnap = await db.collectionGroup('members').where('email', '==', email).get();
    if (membersSnap.empty) {
      console.log("Not found in members either.");
    } else {
      membersSnap.forEach(doc => {
        console.log("Found in members:", doc.ref.path);
        console.log(doc.data());
      });
    }
    
    const usernameSnap = await db.collectionGroup('members').where('username', '==', email).get();
    if (usernameSnap.empty) {
        console.log("Not found in members by username either.");
    } else {
        usernameSnap.forEach(doc => {
        console.log("Found in members by username:", doc.ref.path);
        console.log(doc.data());
        });
    }
  } else {
    snapshot.forEach(doc => {
      console.log("Found in users:", doc.id);
      console.log(doc.data());
    });
  }
}

checkUser().catch(console.error);
