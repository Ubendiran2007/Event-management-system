const { db } = require('../firebase');
const { collection, getDocs, doc, getDoc, updateDoc, query, where } = require('firebase/firestore');

const STUDENT_CLASS_DOCS = [
  'CSE-B', 'CSE-D', 'ECE-A', 'ECE-B', 'CCE-A', 
  'CSBS-A', 'MECH-A', 'CYBER-A', 'EEE-A', 'AIML-A', 'AIDS-A'
];

async function findStudentInFirestore(studentId) {
  for (const className of STUDENT_CLASS_DOCS) {
    const studentRef = doc(db, 'students', className, 'members', studentId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      return { className, ...studentSnap.data(), ref: studentRef };
    }
  }
  return null;
}

async function syncStudentODCount(studentId) {
  if (!studentId) return null;
  
  try {
    const student = await findStudentInFirestore(studentId);
    if (!student) return null;

    const odQuery = query(collection(db, 'odRequests'), where('studentId', '==', studentId), where('status', '==', 'APPROVED'));
    const odSnap = await getDocs(odQuery);
    const approvedRegistrations = odSnap.size;
    const offset = student.odCorrectionOffset || 0;
    const finalCount = approvedRegistrations + offset;

    if (student.odUsed !== finalCount) {
      await updateDoc(student.ref, { 
        odUsed: finalCount,
        updatedAt: new Date().toISOString()
      });
      console.log(`[OD Sync] Corrected OD count for ${studentId} from ${student.odUsed || 0} to ${finalCount} (Registrations: ${approvedRegistrations}, Offset: ${offset})`);
    }
    
    return finalCount;
  } catch (error) {
    console.error('[OD Sync] Failed to sync OD count:', error.message);
    return null;
  }
}

module.exports = { syncStudentODCount };
