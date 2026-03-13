// Script to seed CSE_D.xlsx data to Firebase
// Run with: node seedCSE_D.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function seedCSE_D() {
  try {
    // Read Excel file
    const excelPath = path.join(__dirname, './src/assets/CSE_D.xlsx');
    console.log(`\n📂 Reading Excel file from: ${excelPath}\n`);
    
    const workbook = xlsx.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    console.log(`📊 Found ${rawData.length} students in CSE_D database\n`);

    let successCount = 0;
    let errorCount = 0;
    const className = 'CSE-D';

    for (const row of rawData) {
      try {
        const rollNo = String(row['Roll No.']).trim();
        const email = String(row['Email ID']).trim().toLowerCase();
        const name = String(row['Name']).trim();

        // Create student object
        const student = {
          id: `student_${rollNo}`,
          rollNo: rollNo,
          name: name,
          email: email,
          class: "CSE D",
          section: "CSE D",
          phone: "",
          role: "STUDENT_GENERAL",
          username: email,  // email as username
          password: rollNo,  // roll_no as password
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Seed to Firestore under students/{className}/members/{studentId}
        await setDoc(doc(db, 'students', className, 'members', student.id), student, { merge: true });

        successCount++;
        console.log(`✅ ${className}/members/${student.id} - ${name} (${email})`);
      } catch (error) {
        errorCount++;
        console.log(`❌ Row error: ${error.message}`);
      }
    }

    console.log(`\n========================================`);
    console.log(`✅ Successfully seeded: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`========================================\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

seedCSE_D();
