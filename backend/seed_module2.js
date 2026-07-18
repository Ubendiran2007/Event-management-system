const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, collection } = require('firebase/firestore');
const bcrypt = require('bcryptjs');
const { Roles, Status } = require('./utils/constants');

// Initialize Firebase (use your backend/firebase.js config)
const firebaseConfig = {
  apiKey: 'AIzaSyAIhoO4Xf-pGPR5pWwFpuaq03p5R8e1cqI',
  authDomain: 'eventmanagement-58831.firebaseapp.com',
  projectId: 'eventmanagement-58831',
  storageBucket: 'eventmanagement-58831.firebasestorage.app',
  messagingSenderId: '39022760443',
  appId: '1:39022760443:web:61af07a7e264075163fb5e',
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedTestUsers() {
  console.log('Seeding test users for Module 2...');
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('password', salt);
  
  const testUsers = [
    {
      auth: { id: 'test_hod_cse', email: 'hod.cse@test.com', role: Roles.HOD, status: Status.ACTIVE, password: hash },
      profile: { staffId: 'FAC001', name: 'Dr. Meena (Test HOD)', phone: '9999999999', departmentId: 'CSE', designation: 'Head of Department' },
      isStaff: true
    },
    {
      auth: { id: 'test_iqac', email: 'iqac@test.com', role: Roles.IQAC_TEAM, status: Status.ACTIVE, password: hash },
      profile: { staffId: 'FAC002', name: 'Dr. Sharma (Test IQAC)', phone: '9999999998', departmentId: 'ADMIN', designation: 'IQAC Coordinator' },
      isStaff: true
    },
    {
      auth: { id: 'test_student', email: 'student@test.com', role: Roles.STUDENT_ORGANIZER, status: Status.ACTIVE, password: hash },
      profile: { rollNo: '21CS001', name: 'John Doe (Test Student)', phone: '9999999997', departmentId: 'CSE', batchId: 'BATCH2021', sectionId: 'CSE-B', year: 3, semester: 6 },
      isStaff: false
    }
  ];

  for (const u of testUsers) {
    // Write Auth Document
    await setDoc(doc(db, 'users', u.auth.id), u.auth);
    
    // Write Profile Document
    if (u.isStaff) {
      await setDoc(doc(db, 'staff', u.auth.id), u.profile);
    } else {
      await setDoc(doc(db, 'students', u.auth.id), u.profile);
    }
    console.log(`Seeded user: ${u.auth.email}`);
  }
  
  console.log('Module 2 Test Seeding Complete! You can log in with hod.cse@test.com / password');
  process.exit(0);
}

seedTestUsers().catch(console.error);
