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

/**
 * Recalculates and writes the correct odUsed count for a student.
 *
 * Uses `odResetTimestamp` stored on the student record to count only
 * APPROVED OD requests created AFTER the last annual reset. This ensures
 * that a reset by IQAC is never reversed by an OD approval event.
 *
 * Called only from OD approval / rejection / withdrawal flows — NOT from login.
 */
async function syncStudentODCount(studentId) {
  if (!studentId) return null;

  try {
    const student = await findStudentInFirestore(studentId);
    if (!student) return null;

    // Only count OD requests created after the last annual reset (if one exists)
    const resetTimestamp = student.odResetTimestamp || null;

    const odQuery = query(
      collection(db, 'odRequests'),
      where('studentId', '==', studentId),
      where('status', '==', 'APPROVED')
    );
    const odSnap = await getDocs(odQuery);

    let postResetCount = 0;
    odSnap.forEach(odDoc => {
      const data = odDoc.data();
      // If a reset timestamp exists, only count ODs created after that reset
      if (!resetTimestamp || (data.createdAt && data.createdAt > resetTimestamp)) {
        postResetCount++;
      }
    });

    if (student.odUsed !== postResetCount) {
      await updateDoc(student.ref, {
        odUsed: postResetCount,
        updatedAt: new Date().toISOString()
      });
      console.log(
        `[OD Sync] Updated odUsed for ${studentId}: ${student.odUsed ?? 'N/A'} → ${postResetCount}` +
        (resetTimestamp ? ` (counting only post-reset ODs after ${resetTimestamp})` : '')
      );
    }

    return postResetCount;
  } catch (error) {
    console.error('[OD Sync] Failed to sync OD count:', error.message);
    return null;
  }
}

module.exports = { syncStudentODCount };
