const { doc, setDoc, collection, getDocs, deleteDoc } = require('firebase/firestore');
const { db } = require('./firebase');

// Departments list
const depts = [
  { id: 'cse',   name: 'Computer Science and Engineering' },
  { id: 'ece',   name: 'Electronics and Communication Engineering' },
  { id: 'cce',   name: 'Computer and Communication Engineering' },
  { id: 'csbs',  name: 'Computer Science and Business Systems' },
  { id: 'mech',  name: 'Mechanical Engineering' },
  { id: 'cyber', name: 'Cyber Security' },
  { id: 'eee',   name: 'Electrical and Electronics Engineering' },
  { id: 'aiml',  name: 'Artificial Intelligence and Machine Learning' },
  { id: 'aids',  name: 'Artificial Intelligence and Data Science' }
];

const users = [
  // --- SPECIAL ROLES ---
  { id: 'au1', name: 'Audio Section', email: 'ubendirankumar@gmail.com', password: 'audio', role: 'AUDIO_TEAM', department: null },
  { id: 'hr1', name: 'HR Department', email: 'ubendirankumar@gmail.com', password: 'hr', role: 'HR_TEAM', department: null },
  { id: 'ic1', name: 'ICTS Team', email: 'ubendirankumar@gmail.com', password: 'icts', role: 'SYSTEM_ADMIN', department: null },
  { id: 'tr1', name: 'Transport Office', email: 'ubendirankumar@gmail.com', password: 'transport', role: 'TRANSPORT_TEAM', department: null },
  { id: 'bw1', name: 'Boys Hostel Warden', email: 'ubendirankumar@gmail.com', password: 'boys', role: 'BOYS_WARDEN', department: null },
  { id: 'gw1', name: 'Girls Hostel Warden', email: 'ubendirankumar@gmail.com', password: 'girls', role: 'GIRLS_WARDEN', department: null },
  { id: 'm1',  name: 'Media Team', email: 'ubendirankumar@gmail.com', password: 'media', role: 'MEDIA', department: null },
  { id: 'iq1', name: 'IQAC Team', email: 'ubendirankumar@gmail.com', password: 'iqac', role: 'IQAC_TEAM', department: null },
  { id: 'p1',  name: 'Principal Office', email: 'ubendiran.lakshmanan007@gmail.com', password: 'principal', role: 'PRINCIPAL', department: null },
  { id: 'sa1', name: 'System Admin', email: 'ubendirankumar@gmail.com', password: 'admin', role: 'SYSTEM_ADMIN', department: null },
];

// --- GENERATE DEPARTMENT FACULTY & HOD ---
depts.forEach(d => {
  const deptLabel = d.id.toUpperCase();
  
  // Faculty
  users.push({
    id: `f_${d.id}`,
    name: `Faculty ${deptLabel}`,
    email: 'ubendirankumar@gmail.com',
    password: `faculty_${d.id}`,
    role: 'FACULTY',
    department: deptLabel
  });
  
  // HOD
  users.push({
    id: `h_${d.id}`,
    name: `HOD ${deptLabel}`,
    email: 'ubendirankumar@gmail.com',
    password: `hod_${d.id}`,
    role: 'HOD',
    department: deptLabel
  });
});

// Adding some test students
users.push({ id: 's1', name: 'John Doe', email: 'ubendirankumar@gmail.com', password: 'student', role: 'STUDENT', department: 'CSE' });
users.push({ id: 's2', name: 'Jane Smith', email: 'ubendirankumar@gmail.com', password: 'student', role: 'STUDENT', department: 'ECE' });

async function seed() {
  console.log('🚀 Cleaning and Arranging Firebase Users...');

  try {
    // 1. Delete ALL existing users to remove duplicates
    console.log('🧹 Clearing existing users...');
    const usersCollectionRef = collection(db, 'users');
    const existingUsers = await getDocs(usersCollectionRef);
    for (const d of existingUsers.docs) {
      await deleteDoc(doc(db, 'users', d.id));
    }
    console.log(`✅ Cleared ${existingUsers.size} users.`);

    // 2. Seed Clean Users
    console.log('\n🌱 Seeding official users...');
    for (const user of users) {
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, {
        ...user,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      console.log(`   + [${user.id}] ${user.name} (${user.role})`);
    }

    // 2. Clear and Seed Coordinators (for Faculty Emails)
    console.log('\n🚀 Syncing Coordinators collection...');
    const coordCollectionRef = collection(db, 'coordinators');
    const existingCoords = await getDocs(coordCollectionRef);
    for (const d of existingCoords.docs) {
      await deleteDoc(doc(db, 'coordinators', d.id));
    }

    // We only need FACULTY in coordinators for the event creation lookup
    const facultyUsers = users.filter(u => u.role === 'FACULTY');
    for (const f of facultyUsers) {
      const newCoordRef = doc(collection(db, 'coordinators'));
      await setDoc(newCoordRef, {
        name: f.name,
        email: f.email,
        department: f.department
      });
      console.log(`✅ Coordinator: ${f.name} (${f.department})`);
    }

    console.log('\n🎉 All departments and roles successfully arranged!');
  } catch (err) {
    console.error('❌ Error seeding:', err.message);
  }
  process.exit();
}

seed();
