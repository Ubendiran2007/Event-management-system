const { collection, getDocs, db } = require('../firebaseClientWrapper');

let sectionDocsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to fetch all section documents across the DB
const getAllSectionDocs = async () => {
  if (sectionDocsCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return sectionDocsCache;
  }

  const allSectionDocs = [];
  
  // Phase 3B: Use system/metadata instead of listCollections()
  try {
    const metaSnap = await db.collection('system').doc('metadata').get();
    if (metaSnap.exists) {
      const metadata = metaSnap.data();
      const batches = metadata.batches || {};
      
      const fetchPromises = Object.keys(batches).map(async (batchId) => {
        const departments = batches[batchId].departments || [];
        const deptPromises = departments.map(async (deptId) => {
          const snap = await db.collection('students').doc(batchId).collection(deptId).get();
          snap.docs.forEach(d => allSectionDocs.push({
             ref: d.ref,
             data: d.data(),
             batch: batchId,
             dept: deptId,
             sec: d.id
          }));
        });
        await Promise.all(deptPromises);
      });
      
      await Promise.all(fetchPromises);
    } else {
      console.warn('[studentHelper] system/metadata not found, returning empty array.');
    }
  } catch (err) {
    console.error('[studentHelper] Error fetching from metadata:', err);
  }
  
  sectionDocsCache = allSectionDocs;
  cacheTimestamp = Date.now();
  
  return allSectionDocs;
};

// Helper to clear cache manually
const clearSectionDocsCache = () => {
  sectionDocsCache = null;
  cacheTimestamp = 0;
};

// Phase 3B: Centralized O(1) lookup with fallback
const findStudentInFirestore = async (studentId) => {
  try {
    // 1. Try the new O(1) index
    const idxSnap = await db.collection('student_index').doc(studentId).get();
    if (idxSnap.exists) {
      const { batch, department, section } = idxSnap.data();
      const secDoc = await db.collection('students').doc(batch).collection(department).doc(section).get();
      if (secDoc.exists) {
        const arr = secDoc.data().students || [];
        const idx = arr.findIndex(s => s.id === studentId);
        if (idx !== -1) {
          const studentData = arr[idx];
          return {
            className: studentData.class || studentData.section || section,
            ref: secDoc.ref,
            studentIndex: idx,
            allStudents: arr,
            ...studentData
          };
        }
      }
    }
    
    // 2. Fallback to old global array scan
    console.warn(`[studentHelper] Index miss for ${studentId}, falling back to global scan.`);
    const sectionDocs = await getAllSectionDocs();
    for (const secDoc of sectionDocs) {
      const arr = secDoc.data.students || [];
      const idx = arr.findIndex(s => s.id === studentId);
      if (idx !== -1) {
        const studentData = arr[idx];
        return { 
          className: studentData.class || studentData.section || secDoc.sec, 
          ref: secDoc.ref, 
          studentIndex: idx, 
          allStudents: arr,
          ...studentData 
        };
      }
    }
    return null;
  } catch (err) {
    console.error(`[studentHelper] Error fetching student ${studentId}:`, err.message);
    return null;
  }
};

const syncStructureMetadata = async (batchId, deptId) => {
  try {
    const metaRef = db.collection('system').doc('metadata');
    const metaSnap = await metaRef.get();
    let data = metaSnap.exists ? metaSnap.data() : { batches: {}, allDepartments: [] };
    
    let changed = false;
    
    if (!data.batches) data.batches = {};
    if (!data.batches[batchId]) {
      data.batches[batchId] = { departments: [] };
      changed = true;
    }
    
    if (!data.batches[batchId].departments.includes(deptId)) {
      data.batches[batchId].departments.push(deptId);
      changed = true;
    }
    
    if (!data.allDepartments) data.allDepartments = [];
    if (!data.allDepartments.includes(deptId)) {
      data.allDepartments.push(deptId);
      changed = true;
    }
    
    if (changed) {
      data.updatedAt = new Date().toISOString();
      await metaRef.set(data, { merge: true });
    }
  } catch (err) {
    console.error(`[studentHelper] Failed to sync metadata for ${batchId}/${deptId}`, err);
  }
};

module.exports = {
  getAllSectionDocs,
  clearSectionDocsCache,
  findStudentInFirestore,
  syncStructureMetadata
};
