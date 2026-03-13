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
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';

// ==================== STUDENTS ====================
// Fetch all students from all classes: students/{className}/members/{studentId}
export const fetchStudents = async () => {
  try {
    const allStudents = [];
    const classes = ['CSE-B', 'CSE-D'];
    
    for (const className of classes) {
      const membersSnapshot = await getDocs(collection(db, 'students', className, 'members'));
      
      membersSnapshot.docs.forEach(doc => {
        allStudents.push({ id: doc.id, ...doc.data(), class: className });
      });
    }
    
    return allStudents;
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
      // Otherwise, search through all classes
      const classesSnapshot = await getDocs(collection(db, 'students'));
      
      for (const classDoc of classesSnapshot.docs) {
        const className = classDoc.id;
        const docRef = doc(db, 'students', className, 'members', studentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data(), class: className };
        }
      }
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
    
    // List of classes to check (Firestore doesn't return collection-only paths)
    const classes = ['CSE-B', 'CSE-D'];
    
    for (const className of classes) {
      const membersSnapshot = await getDocs(collection(db, 'students', className, 'members'));
      console.log(`Checking ${membersSnapshot.docs.length} students in class ${className}`);
      
      for (const memberDoc of membersSnapshot.docs) {
        const student = memberDoc.data();
        
        // Check if email (username) and roll number (password) match
        // Make password comparison case-insensitive
        if (
          student.username?.toLowerCase() === username.toLowerCase() &&
          student.password?.toUpperCase() === password.toUpperCase()
        ) {
          console.log('Student authenticated successfully:', student.name);
          return {
            id: memberDoc.id,
            ...student,
            className: className
          };
        }
      }
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
export const subscribeToODRequests = (callback) => {
  const odCollection = collection(db, 'odRequests');
  return onSnapshot(odCollection, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(requests);
  });
};

export const subscribeToEvents = (callback) => {
  const eventsCollection = collection(db, 'events');
  // includeMetadataChanges: true lets us see hasPendingWrites so we can filter
  // out ghost documents that only exist in the local SDK cache but were never
  // confirmed by the Firestore server.
  return onSnapshot(eventsCollection, { includeMetadataChanges: true }, (snapshot) => {
    const events = snapshot.docs
      .filter(doc => !doc.metadata.hasPendingWrites)
      .map(doc => ({ ...doc.data(), id: doc.id }));
    callback(events);
  });
};

export const subscribeToStudents = (callback) => {
  const classes = ['CSE-B', 'CSE-D'];
  const unsubscribers = [];
  
  // Subscribe to each class's members subcollection
  classes.forEach(className => {
    const membersCollection = collection(db, 'students', className, 'members');
    const unsubscribe = onSnapshot(membersCollection, () => {
      // Fetch all students whenever any class changes
      fetchStudents().then(allStudents => {
        callback(allStudents);
      });
    });
    unsubscribers.push(unsubscribe);
  });
  
  // Return a function that unsubscribes from all listeners
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
};
