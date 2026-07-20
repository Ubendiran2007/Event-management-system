import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { Status } from '../types';

// ==================== MASTER COLLECTIONS ====================
export const fetchDepartments = async () => {
  try {
    const q = query(collection(db, 'departments'), where('status', '==', Status.ACTIVE));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching departments:', error);
    return [];
  }
};

export const fetchAcademicBatches = async () => {
  try {
    const q = query(collection(db, 'academicBatches'), where('status', '==', Status.ACTIVE));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching academic batches:', error);
    return [];
  }
};

export const fetchSections = async (departmentId = null, batchId = null) => {
  try {
    let q = query(collection(db, 'sections'), where('status', '==', Status.ACTIVE));
    if (departmentId) q = query(q, where('departmentId', '==', departmentId));
    if (batchId) q = query(q, where('batchId', '==', batchId));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching sections:', error);
    return [];
  }
};

export const fetchVenues = async () => {
  try {
    const q = query(collection(db, 'venues'), where('status', '==', Status.ACTIVE));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching venues:', error);
    return [];
  }
};

export const fetchSystemSettings = async () => {
  try {
    const docRef = doc(db, 'systemSettings', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return null;
  }
};

// ==================== STUDENTS ====================
const ALL_CLASSES = [
  'CSE-B', 'CSE-D',
  'ECE-A', 'ECE-B',
  'CCE-A',
  'CSBS-A',
  'MECH-A',
  'CYBER-A',
  'EEE-A',
  'AIML-A',
  'AIDS-A'
];

// Fetch all students from all classes using collectionGroup
export const fetchStudents = async () => {
  try {
    const membersGroup = collectionGroup(db, 'members');
    const membersSnapshot = await getDocs(membersGroup);
    return membersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      class: doc.ref.parent.parent.id
    }));
  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
};

// Fetch students by class
export const fetchStudentsByClass = async (className) => {
  try {
    const membersSnapshot = await getDocs(collection(db, 'students', className, 'members'));
    return membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching students from class ${className}:`, error);
    return [];
  }
};

// Fetch all available classes
export const fetchClasses = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'students'));
    return snapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return [];
  }
};

export const getStudentById = async (studentId, className = null) => {
  try {
    // If className is provided, use it directly
    if (className) {
      const docRef = doc(db, 'students', className, 'members', studentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
    } else {
      // Otherwise, use collectionGroup query to find the specific student
      // Note: Assumes studentId is exactly the document ID
      // To query by document ID in a collection group, we can use fieldpath documentId() if necessary,
      // but in JS SDK we can just query the collection group if 'id' was a field, or fetch all if not indexed by id.
      // However, we can't easily query by __name__ without knowing the path. Let's query if 'rollNo' or similar is unique,
      // or we can just find them by getting the doc if we knew the path. 
      // Since studentId is doc.id, we can just do a query on a unique field if possible, or fallback to fetching all members.
      // Assuming 'rollNo' or 'email' is known? No, we only have studentId.
      // To avoid fetching all, we can query by documentId (v9):
      // import { documentId } from 'firebase/firestore'; 
      // query(collectionGroup(db, 'members'), where(documentId(), '==', ...)) -> documentId in collectionGroup requires full path, so that won't work.
      // Since we only have studentId and it's the doc id, we can just map over ALL_CLASSES using Promise.all which runs in parallel!
      const searchPromises = ALL_CLASSES.map(async (cls) => {
        const docRef = doc(db, 'students', cls, 'members', studentId);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data(), class: cls };
          }
        } catch(e) {}
        return null;
      });
      
      const results = await Promise.all(searchPromises);
      const found = results.find(res => res !== null);
      if (found) return found;
    }
    return null;
  } catch (error) {
    console.error('Error fetching student:', error);
    return null;
  }
};

export const updateStudentRole = async (studentId, role, className, isApprovedOrganizer = false) => {
  try {
    const studentRef = doc(db, 'students', className, 'members', studentId);
    await updateDoc(studentRef, { role, isApprovedOrganizer, updatedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    console.error('Error updating student role:', error);
    return false;
  }
};

// Authenticate student by username (email) and password (roll number)
export const authenticateStudent = async (username, password) => {
  try {
    console.log('Authenticating student:', username);
    // Optimized: using collectionGroup query for the specific username instead of reading all students
    const membersGroup = collectionGroup(db, 'members');
    const q = query(membersGroup, where('username', '==', username), limit(1));
    const snapshot = await getDocs(q);
    
    // If no exact match (perhaps due to case), we fall back to parallel class-level queries 
    // to preserve existing case-insensitive behavior if the query doesn't catch it
    if (!snapshot.empty) {
      for (const memberDoc of snapshot.docs) {
        const student = memberDoc.data();
        if (student.password?.toUpperCase() === password.toUpperCase()) {
          const className = memberDoc.ref.parent.parent.id;
          console.log('Student authenticated successfully via collectionGroup:', student.name);
          return { id: memberDoc.id, ...student, className };
        }
      }
    }

    // Fallback: Case-insensitive search across all classes in parallel if precise query fails
    const authPromises = ALL_CLASSES.map(async (className) => {
      // We still do a query to avoid fetching everyone if we can, but we can't do lowercase easily in Firestore.
      // So we fetch the class, but in parallel.
      const membersSnapshot = await getDocs(collection(db, 'students', className, 'members'));
      for (const memberDoc of membersSnapshot.docs) {
        const student = memberDoc.data();
        if (
          student.username?.toLowerCase() === username.toLowerCase() &&
          student.password?.toUpperCase() === password.toUpperCase()
        ) {
          return { id: memberDoc.id, ...student, className };
        }
      }
      return null;
    });
    
    const results = await Promise.all(authPromises);
    const found = results.find(res => res !== null);
    if (found) {
      console.log('Student authenticated successfully (fallback):', found.name);
      return found;
    }
    console.log('No matching student found');
    return null;
  } catch (error) {
    console.error('Error authenticating student:', error);
    return null;
  }
};


// ==================== USERS ====================
export const fetchUsers = async () => {
  try {
    const usersCollection = collection(db, 'users');
    const snapshot = await getDocs(usersCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

export const subscribeToUsers = (callback) => {
  const usersCollection = collection(db, 'users');
  return onSnapshot(usersCollection, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(users);
  });
};

// ==================== EVENTS ====================
export const fetchEvents = async () => {
  try {
    const eventsCollection = collection(db, 'events');
    const snapshot = await getDocs(eventsCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};

export const createEvent = async (eventData) => {
  try {
    const eventsCollection = collection(db, 'events');
    const docRef = await addDoc(eventsCollection, {
      ...eventData,
      createdAt: new Date().toISOString(),
    });
    return { id: docRef.id, ...eventData };
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};

export const updateEventStatus = async (eventId, status) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      status,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error updating event status:', error);
    throw error;
  }
};

export const saveIQACSubmission = async (eventId, iqacDocuments) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      status: 'COMPLETED',
      iqacSubmittedAt: new Date().toISOString(),
      iqacDocuments,
      needsFeedbackReminders: true,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('Error saving IQAC submission:', error);
    throw error;
  }
};

// ==================== OD REQUESTS ====================
export const fetchODRequests = async () => {
  try {
    const odCollection = collection(db, 'odRequests');
    const snapshot = await getDocs(odCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching OD requests:', error);
    return [];
  }
};

export const createODRequest = async (odData) => {
  try {
    const odCollection = collection(db, 'odRequests');
    const docRef = await addDoc(odCollection, {
      ...odData,
      status: 'PENDING_FACULTY',
      createdAt: new Date().toISOString(),
    });
    return { id: docRef.id, ...odData, status: 'PENDING_FACULTY' };
  } catch (error) {
    console.error('Error creating OD request:', error);
    throw error;
  }
};

export const updateODRequestStatus = async (requestId, status, approverInfo = {}) => {
  try {
    const odRef = doc(db, 'odRequests', requestId);
    await updateDoc(odRef, {
      status,
      ...approverInfo,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Error updating OD request status:', error);
    throw error;
  }
};

export const getODRequestById = async (requestId) => {
  try {
    const docRef = doc(db, 'odRequests', requestId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching OD request:', error);
    return null;
  }
};

// ==================== REAL-TIME LISTENERS ====================
export const subscribeToODRequests = (currentUser, callback) => {
  if (!currentUser) return () => {};
  
  let q;
  if (currentUser.role === 'STUDENT_GENERAL' || currentUser.role === 'STUDENT_ORGANIZER') {
    q = query(collection(db, 'odRequests'), where('studentId', '==', currentUser.id));
  } else {
    // For now, faculty and global roles still subscribe to all to do client-side filtering.
    // Optimization here would require a 'department' field on odRequests.
    q = collection(db, 'odRequests');
  }
  
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(requests);
  });
};

export const subscribeToEvents = (currentUser, callback) => {
  if (!currentUser) return () => {};
  
  const eventsCollection = collection(db, 'events');
  let q = eventsCollection;
  
  // Example of strict filtering if they only need their department
  // If role is HOD or FACULTY, they usually only look at their department.
  // Note: HODs might need to see other departments if they are part of multi-department workflows,
  // but this query cuts down reads if they mostly stay in their lane.
  // For safety, we can just fetch all and let AppContext filter until complex OR queries are added.
  
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    const events = snapshot.docs
      .filter(doc => !doc.metadata.hasPendingWrites)
      .map(doc => ({ ...doc.data(), id: doc.id }));
    callback(events);
  });
};

export const subscribeToStudents = (currentUser, callback) => {
  if (!currentUser) return () => {};
  
  const isStudent = currentUser.role === 'STUDENT_GENERAL' || currentUser.role === 'STUDENT_ORGANIZER';

  // If student, only subscribe to their specific class and document!
  if (isStudent && currentUser.class) {
    const className = String(currentUser.class).replace(/\s+/g, '-');
    const studentDocRef = doc(db, 'students', className, 'members', currentUser.id);
    
    return onSnapshot(studentDocRef, (docSnap) => {
      if (docSnap.exists()) {
        callback([{ id: docSnap.id, ...docSnap.data(), class: className }]);
      } else {
        callback([]);
      }
    });
  }

  // If not student (e.g., admin), use a single collectionGroup listener instead of 11 separate ones
  const membersGroup = collectionGroup(db, 'members');
  return onSnapshot(membersGroup, (snapshot) => {
    const allStudents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      class: doc.ref.parent.parent.id
    }));
    callback(allStudents);
  }, (error) => {
    console.error('Error subscribing to students collectionGroup:', error);
  });
};

// ==========================================
// ACADEMIC CALENDAR LISTENERS
// ==========================================

export const subscribeToAcademicYears = (callback) => {
  return onSnapshot(collection(db, 'academicYears'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

export const subscribeToSemesters = (callback) => {
  return onSnapshot(collection(db, 'semesters'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

export const subscribeToHolidays = (callback) => {
  return onSnapshot(collection(db, 'holidays'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

export const subscribeToExams = (callback) => {
  return onSnapshot(collection(db, 'exams'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

export const subscribeToWorkingDays = (callback) => {
  return onSnapshot(doc(db, 'settings', 'workingDays'), (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data());
    } else {
      callback({}); // Return empty if not configured
    }
  });
};

export const subscribeToDepartmentCalendar = (callback) => {
  return onSnapshot(collection(db, 'departmentCalendar'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

export const subscribeToAcademicBatches = (callback) => {
  const q = query(collection(db, 'academicBatches'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};
