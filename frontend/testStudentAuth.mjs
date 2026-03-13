// Test script to verify student authentication
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function testAuth() {
  console.log('\n🔍 Testing Student Authentication\n');
  
  try {
    // Try to list all documents at the root 'students' collection
    const studentsRef = collection(db, 'students');
    const studentsSnapshot = await getDocs(studentsRef);
    
    console.log(`📂 Found ${studentsSnapshot.docs.length} documents in 'students' collection`);
    console.log(`   Document IDs: ${studentsSnapshot.docs.map(d => d.id).join(', ')}`);
    
    // Now try to get CSE-B and CSE-D specifically
    const classesToCheck = ['CSE-B', 'CSE-D'];
    
    for (const className of classesToCheck) {
      console.log(`\n📊 Checking class: ${className}`);
      
      try {
        const membersRef = collection(db, 'students', className, 'members');
        const membersSnapshot = await getDocs(membersRef);
        
        console.log(`   Found ${membersSnapshot.docs.length} students in ${className}`);
        
        if (membersSnapshot.docs.length > 0) {
          const firstStudent = membersSnapshot.docs[0].data();
          console.log('\n   ✅ Sample student from', className);
          console.log('   - ID:', membersSnapshot.docs[0].id);
          console.log('   - Name:', firstStudent.name);
          console.log('   - Email:', firstStudent.email);
          console.log('   - Username:', firstStudent.username || '❌ MISSING');
          console.log('   - Password:', firstStudent.password || '❌ MISSING');
          console.log('   - Roll No:', firstStudent.rollNo);
          
          if (firstStudent.username && firstStudent.password) {
            console.log('\n   🔑 Test credentials:');
            console.log('   Username:', firstStudent.username);
            console.log('   Password:', firstStudent.password);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error accessing ${className}:`, error.message);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testAuth();
