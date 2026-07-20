import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { MOCK_USERS, MOCK_EVENTS } from './mockData';
import { STUDENTS } from './studentData';

// Seed academic batches
export const seedAcademicBatches = async () => {
  const batchesCollection = collection(db, 'academicBatches');
  
  try {
    const existingBatches = await getDocs(batchesCollection);
    if (!existingBatches.empty) {
      console.log('Academic batches already seeded. Skipping...');
      return { success: true, message: 'Academic batches already exist' };
    }

    const batches = [
      { id: 'batch_2024_28', name: '2024-28', status: 'ACTIVE' }
    ];

    for (const batch of batches) {
      await setDoc(doc(db, 'academicBatches', batch.id), {
        ...batch,
        createdAt: new Date().toISOString(),
      });
      console.log(`Batch ${batch.name} seeded successfully`);
    }

    console.log('All academic batches seeded successfully!');
    return { success: true, message: 'Academic batches seeded successfully' };
  } catch (error) {
    console.error('Error seeding academic batches:', error);
    return { success: false, message: error.message };
  }
};

// Seed users to Firestore
export const seedUsers = async () => {
  const usersCollection = collection(db, 'users');
  
  try {
    // Check if users already exist
    const existingUsers = await getDocs(usersCollection);
    if (!existingUsers.empty) {
      console.log('Users already seeded. Skipping...');
      return { success: true, message: 'Users already exist' };
    }

    // Add each user to Firestore
    for (const user of MOCK_USERS) {
      await setDoc(doc(db, 'users', user.id), {
        ...user,
        createdAt: new Date().toISOString(),
      });
      console.log(`User ${user.name} seeded successfully`);
    }

    console.log('All users seeded successfully!');
    return { success: true, message: 'Users seeded successfully' };
  } catch (error) {
    console.error('Error seeding users:', error);
    return { success: false, message: error.message };
  }
};

// Seed CSE-B students to Firestore
export const seedStudents = async (forceUpdate = false) => {
  try {
    let count = 0;
    for (const student of STUDENTS) {
      // Normalize class name for Firestore path (e.g. "CSE B" -> "CSE-B")
      const className = (student.class || 'Unknown-Class').replace(/\s+/g, '-').toUpperCase();
      
      await setDoc(doc(db, 'students', className, 'members', student.id), {
        ...student,
        class: className, // Ensure class matches the normalized path
        createdAt: new Date().toISOString(),
      }, { merge: true }); // merge: true allows updating existing docs
      count++;
    }

    console.log(`All ${count} students seeded successfully!`);
    return { success: true, message: `${count} students seeded/updated` };
  } catch (error) {
    console.error('Error seeding students:', error);
    return { success: false, message: error.message };
  }
};

// Seed events to Firestore
export const seedEvents = async () => {
  const eventsCollection = collection(db, 'events');
  
  try {
    // Check if events already exist
    const existingEvents = await getDocs(eventsCollection);
    if (!existingEvents.empty) {
      console.log('Events already seeded. Skipping...');
      return { success: true, message: 'Events already exist' };
    }

    // Add each event to Firestore
    for (const event of MOCK_EVENTS) {
      await setDoc(doc(db, 'events', event.id), {
        ...event,
      });
      console.log(`Event ${event.title} seeded successfully`);
    }

    console.log('All events seeded successfully!');
    return { success: true, message: 'Events seeded successfully' };
  } catch (error) {
    console.error('Error seeding events:', error);
    return { success: false, message: error.message };
  }
};

export const seedAllData = async () => {
  console.log('Starting data seeding...');
  
  const batchesResult = await seedAcademicBatches();
  const usersResult = await seedUsers();
  const studentsResult = await seedStudents();
  const eventsResult = await seedEvents();
  
  return {
    batches: batchesResult,
    users: usersResult,
    students: studentsResult,
    events: eventsResult,
  };
};

// Force update all students (use when adding new sections)
export const forceUpdateStudents = async () => {
  console.log('Force updating students...');
  return await seedStudents(true);
};
