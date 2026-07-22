require('dotenv').config();
const { dbAdmin: db } = require('./firebaseAdmin');

async function checkRealUser() {
  const email = "thamilselvan.p2024cse@sece.ac.in";
  console.log("Looking everywhere for:", email);
  
  const snap = await db.collection('users').get();
  let found = false;
  snap.forEach(doc => {
      const data = doc.data();
      if (data.email && data.email.toLowerCase() === email) {
          console.log("FOUND IN USERS BY EMAIL:", doc.id);
          console.log(data);
          found = true;
      }
      if (data.username && data.username.toLowerCase() === email) {
          console.log("FOUND IN USERS BY USERNAME:", doc.id);
          console.log(data);
          found = true;
      }
  });
  
  if (!found) {
      console.log("User absolutely does not exist in the users collection either.");
  }
}

checkRealUser().catch(console.error);
