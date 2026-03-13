// Direct script to seed OD requests to Firebase
// Run with: node seedODRequests.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, addDoc } from 'firebase/firestore';

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

// Sample OD Requests
const SAMPLE_OD_REQUESTS = [
  {
    studentId: 'student_24cs071',
    studentName: 'HARI VIGNESH S',
    rollNo: '24CS071',
    class: 'CSE B',
    email: 'harivignesh.s2024cse@sece.ac.in',
    eventName: 'National Level Hackathon',
    eventDate: '2026-03-15',
    eventTime: '9:00 AM - 6:00 PM',
    venue: 'IIT Madras',
    reason: 'Participating in the national level hackathon organized by IIT Madras. This is a great opportunity to showcase our skills.',
    status: 'PENDING_FACULTY',
    createdAt: new Date().toISOString(),
  },
  {
    studentId: 'student_24cs072',
    studentName: 'HARINATH S',
    rollNo: '24CS072',
    class: 'CSE B',
    email: 'harinath.s2024cse@sece.ac.in',
    eventName: 'Tech Workshop',
    eventDate: '2026-03-20',
    eventTime: '10:00 AM - 4:00 PM',
    venue: 'PSG Tech',
    reason: 'Attending a cloud computing workshop conducted by AWS.',
    status: 'PENDING_HOD',
    facultyApprovedBy: 'Dr. Arul Kumar',
    facultyApprovedAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    studentId: 'student_24cs073',
    studentName: 'HARINI C',
    rollNo: '24CS073',
    class: 'CSE B',
    email: 'harini.c2024cse@sece.ac.in',
    eventName: 'Paper Presentation',
    eventDate: '2026-03-25',
    eventTime: '9:30 AM - 5:00 PM',
    venue: 'Anna University',
    reason: 'Presenting research paper on Machine Learning applications.',
    status: 'PENDING_PRINCIPAL',
    facultyApprovedBy: 'Dr. Arul Kumar',
    facultyApprovedAt: new Date(Date.now() - 172800000).toISOString(),
    hodApprovedBy: 'Dr. Meena Iyer',
    hodApprovedAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    studentId: 'student_24cs074',
    studentName: 'HARISH KUMAR',
    rollNo: '24CS074',
    class: 'CSE B',
    email: 'harishkumar.s2024cse@sece.ac.in',
    eventName: 'Sports Meet',
    eventDate: '2026-03-10',
    eventTime: 'Full Day',
    venue: 'Nehru Stadium',
    reason: 'Participating in inter-college athletics competition.',
    status: 'APPROVED',
    facultyApprovedBy: 'Dr. Arul Kumar',
    facultyApprovedAt: new Date(Date.now() - 345600000).toISOString(),
    hodApprovedBy: 'Dr. Meena Iyer',
    hodApprovedAt: new Date(Date.now() - 259200000).toISOString(),
    principalApprovedBy: 'Dr. S. Rajan',
    principalApprovedAt: new Date(Date.now() - 172800000).toISOString(),
    createdAt: new Date(Date.now() - 432000000).toISOString(),
  },
];

async function seedODRequests() {
  console.log(`\n📋 Seeding ${SAMPLE_OD_REQUESTS.length} OD requests to Firestore...\n`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const request of SAMPLE_OD_REQUESTS) {
    try {
      const docRef = await addDoc(collection(db, 'odRequests'), request);
      successCount++;
      console.log(`✅ ${request.rollNo} - ${request.eventName} (ID: ${docRef.id})`);
    } catch (error) {
      errorCount++;
      console.log(`❌ ${request.rollNo} - ${error.message}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ Successfully seeded: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`========================================\n`);
  
  process.exit(0);
}

seedODRequests();
