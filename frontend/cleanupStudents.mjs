// Script to delete all student data from Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAIhoO4Xf-pGPR5pWwFpuaq03p5R8e1cqI",
  authDomain: "eventmanagement-58831.firebaseapp.com",
  projectId: "eventmanagement-58831",
  storageBucket: "eventmanagement-58831.firebasestorage.app",
  messagingSenderId: "39022760443",
  appId: "1:39022760443:web:61af07a7e264075163fb5e",
  measurementId: "G-GP3C2GVWX7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupStudents() {
  console.log('\n🧹 Cleaning up old student data from Firestore...\n');
  
  try {
    const classesSnapshot = await getDocs(collection(db, 'students'));
    console.log(`Found ${classesSnapshot.docs.length} collections under 'students'`);
    
    let deletedCount = 0;
    
    for (const classDoc of classesSnapshot.docs) {
      const className = classDoc.id;
      console.log(`\n📂 Deleting class/collection: ${className}`);
      
      try {
        // Try to get members subcollection
        const membersSnapshot = await getDocs(collection(db, 'students', className, 'members'));
        
        if (membersSnapshot.docs.length > 0) {
          console.log(`   Found ${membersSnapshot.docs.length} students in members subcollection`);
          for (const memberDoc of membersSnapshot.docs) {
            await deleteDoc(doc(db, 'students', className, 'members', memberDoc.id));
            deletedCount++;
          }
        }
      } catch (e) {
        console.log(`   No members subcollection found`);
      }
      
      // Delete the class document itself (if it exists as a document)
      try {
        await deleteDoc(doc(db, 'students', className));
        console.log(`   ✅ Deleted class document: ${className}`);
      } catch (e) {
        console.log(`   ℹ️  ${className} is a collection, not a document`);
      }
    }
    
    console.log(`\n========================================`);
    console.log(`✅ Cleanup complete!`);
    console.log(`   Deleted ${deletedCount} student records`);
    console.log(`========================================\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupStudents();
