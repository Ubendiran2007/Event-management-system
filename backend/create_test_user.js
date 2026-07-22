require('dotenv').config();
const { dbAdmin: db } = require('./firebaseAdmin');

async function createTestUser() {
  const email = "thamilselvan.p2024cse@sece.ac.in";
  
  const userRef = db.collection('users').doc('thamilselvan_test');
  await userRef.set({
      email: email,
      username: email,
      password: "24CS251", // Stored in plain text since auth.js supports it
      role: "student",
      department: "CSE",
      year: "2024",
      name: "Thamilselvan P",
      createdAt: new Date().toISOString()
  });
  
  console.log("Successfully created test user in database!");
}

createTestUser().catch(console.error);
