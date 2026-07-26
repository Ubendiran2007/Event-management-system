require('dotenv').config();
const { dbAdmin: db } = require('./firebaseAdmin');

async function checkUser() {
  const users = await db.collection('users').where('name', '==', 'CSE Faculty 4').get();
  users.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
  
  const odReqs = await db.collection('odRequests').where('class', '==', 'CSE-D').get();
  odReqs.forEach(doc => {
    console.log(doc.id, '=> OD Request Data:', doc.data());
  });
  
  process.exit(0);
}
checkUser();
