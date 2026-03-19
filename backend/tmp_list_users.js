const { collection, getDocs } = require('firebase/firestore');
const { db } = require('./firebase');

async function listAllEmails() {
  console.log('--- USER EMAILS ---');
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const roleMap = {};
    usersSnap.forEach(doc => {
      const data = doc.data();
      const role = data.role || 'STUDENT';
      if (!roleMap[role]) roleMap[role] = [];
      roleMap[role].push(`${data.name || 'No Name'} <${data.email || 'No Email'}>`);
    });
    
    Object.keys(roleMap).sort().forEach(role => {
      console.log(`\nRole: ${role}`);
      roleMap[role].forEach(user => console.log(`  - ${user}`));
    });
  } catch (err) {
    console.error('Error fetching users:', err.message);
  }

  console.log('\n--- COORDINATOR EMAILS ---');
  try {
    const coordSnap = await getDocs(collection(db, 'coordinators'));
    coordSnap.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.name || 'No Name'} <${data.email || 'No Email'}> (Dept: ${data.department || 'N/A'})`);
    });
  } catch (err) {
    console.error('Error fetching coordinators:', err.message);
  }
  
  process.exit();
}

listAllEmails();
