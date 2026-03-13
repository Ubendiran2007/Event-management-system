// Direct script to seed student data to Firebase
// Run with: node seedToFirebase.mjs
// Structure: students/{class}/{studentId}

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { STUDENTS } from './src/studentData.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAIhoO4Xf-pGPR5pWwFpuaq03p5R8e1cqI",
  authDomain: "eventmanagement-58831.firebaseapp.com",
  projectId: "eventmanagement-58831",
  storageBucket: "eventmanagement-58831.firebasestorage.app",
  messagingSenderId: "39022760443",
  appId: "1:39022760443:web:61af07a7e264075163fb5e",
  measurementId: "G-GP3C2GVWX7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedStudents() {
  console.log(`\n📚 Seeding ${STUDENTS.length} students to Firestore...\n`);
  console.log(`📂 Structure: students/{className}/{studentId}\n`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const student of STUDENTS) {
    try {
      // Normalize class name (e.g., "CSE B" -> "CSE-B")
      const className = student.class.replace(/\s+/g, '-');
      
      // Save under students/{className}/members/{studentId}
      await setDoc(doc(db, 'students', className, 'members', student.id), {
        ...student,
        username: student.email,  // email as username
        password: student.rollNo, // roll number as password
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      successCount++;
      console.log(`✅ ${className}/members/${student.id} - ${student.name}`);
    } catch (error) {
      errorCount++;
      console.log(`❌ ${student.rollNo} - ${error.message}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ Successfully seeded: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`========================================\n`);
  
  process.exit(0);
}

seedStudents();
