const { collection, getDocs, updateDoc, doc, query, where } = require('firebase/firestore');
const { db } = require('./firebase');

async function updateEmails() {
  const rolesToUpdate = [
    'IQAC_TEAM',
    'AUDIO_TEAM',
    'HR_TEAM',
    'TRANSPORT_TEAM',
    'BOYS_WARDEN',
    'GIRLS_WARDEN',
    'SYSTEM_ADMIN'
  ];
  
  const newEmail = 'kavin90437@gmail.com';
  let updatedCount = 0;

  console.log(`Updating roles to: ${newEmail}...`);

  try {
    const usersRef = collection(db, 'users');
    for (const role of rolesToUpdate) {
      const q = query(usersRef, where('role', '==', role));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log(`No users found for role: ${role}`);
        continue;
      }

      for (const userDoc of snapshot.docs) {
        await updateDoc(doc(db, 'users', userDoc.id), {
          email: newEmail
        });
        console.log(`Updated ${role}: ${userDoc.data().name}`);
        updatedCount++;
      }
    }
    console.log(`\nSuccess! Total users updated: ${updatedCount}`);
  } catch (err) {
    console.error('Error updating emails:', err.message);
  }
  
  process.exit();
}

updateEmails();
