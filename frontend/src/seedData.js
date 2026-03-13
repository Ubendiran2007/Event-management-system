import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { MOCK_USERS, MOCK_EVENTS } from './mockData';
import { STUDENTS } from './studentData';

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
  const studentsCollection = collection(db, 'students');
  
  try {
    // Check if students already exist
    const existingStudents = await getDocs(studentsCollection);
    if (!existingStudents.empty && !forceUpdate) {
      console.log('Students already seeded. Skipping...');
      return { success: true, message: `Students already exist (${existingStudents.size} records)` };
    }

    // Add/Update each student to Firestore
    let count = 0;
    for (const student of STUDENTS) {
      await setDoc(doc(db, 'students', student.id), {
        ...student,
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

// Seed all data
export const seedAllData = async () => {
  console.log('Starting data seeding...');
  
  const usersResult = await seedUsers();
  const studentsResult = await seedStudents();
  const eventsResult = await seedEvents();
  
  return {
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
