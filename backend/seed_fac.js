const { doc, setDoc } = require('firebase/firestore');
const { db } = require('./firebase');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    const defaultPassword = await bcrypt.hash('password123', 10);
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
      await setDoc(doc(db, 'users', id), facData);
      console.log(`Created ${id}`);
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
seed();
