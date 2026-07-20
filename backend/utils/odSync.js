const { dbAdmin } = require('../firebaseAdmin');
const { getAllSectionDocs } = require('./studentHelper');

async function findStudentInFirestore(studentId) {
  try {
    const sectionDocs = await getAllSectionDocs();
    for (const secDoc of sectionDocs) {
      const arr = secDoc.data.students || [];
      const idx = arr.findIndex(s => s.id === studentId);
      if (idx !== -1) {
        return { 
           studentData: arr[idx], 
           ref: secDoc.ref, 
           index: idx,
           allStudents: arr
        };
      }
    }
    return null;
  } catch (err) {
    console.error(`[odSync/findStudentInFirestore] Error fetching student:`, err.message);
    return null;
  }
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
    const resetTimestamp = student.studentData.odResetTimestamp || null;

    const odQuery = dbAdmin.collection('odRequests')
      .where('studentId', '==', studentId)
      .where('status', '==', 'APPROVED');
      
    const odSnap = await odQuery.get();

    let postResetCount = 0;
    odSnap.forEach(odDoc => {
      const data = odDoc.data();
      // If a reset timestamp exists, only count ODs created after that reset
      if (!resetTimestamp || (data.createdAt && data.createdAt > resetTimestamp)) {
        postResetCount++;
      }
    });

    if (student.studentData.odUsed !== postResetCount) {
      student.allStudents[student.index].odUsed = postResetCount;
      student.allStudents[student.index].updatedAt = new Date().toISOString();
      
      await student.ref.update({
        students: student.allStudents
      });
      console.log(
        `[OD Sync] Updated odUsed for ${studentId}: ${student.studentData.odUsed ?? 'N/A'} → ${postResetCount}` +
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
