const { doc, setDoc } = require('firebase/firestore');
const { db } = require('./firebase');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    const defaultPassword = await bcrypt.hash('password123', 10);
    // Add "CSE" ghost document if needed, but in Firestore, creating a doc in a subcollection automatically shows the parent path.
    for (let i = 1; i <= 10; i++) {
      const id = `fac_cse_mock_${i}`;
      const facData = {
        name: `CSE Faculty ${i}`,
        email: 'ubendirankumar@gmail.com',
        role: 'FACULTY',
        department: 'CSE',
        password: defaultPassword,
        assignedClasses: []
      };
      
      // Store in the new nested structure requested by user: staff/CSE/members/fac_cse_mock_i
      const docRef = doc(db, 'staff', 'CSE', 'members', id);
      await setDoc(docRef, facData);
      console.log(`Created in staff/CSE/members: ${id}`);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
seed();
