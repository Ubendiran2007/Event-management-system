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
  // Use listDocuments() to find phantom batch documents (documents that only have subcollections)
  const batchDocsRefs = await db.collection('students').listDocuments();
  
  const fetchPromises = batchDocsRefs.map(async (batchRef) => {
    const depts = await batchRef.listCollections();
    const deptPromises = depts.map(async (deptCol) => {
      if (deptCol.id === 'departments') return; // skip old structure if present
      const snap = await deptCol.get();
      snap.docs.forEach(d => allSectionDocs.push({
         ref: d.ref,
         data: d.data(),
         batch: batchRef.id,
         dept: deptCol.id,
         sec: d.id
      }));
    });
    await Promise.all(deptPromises);
  });
  
  await Promise.all(fetchPromises);
  
  sectionDocsCache = allSectionDocs;
  cacheTimestamp = Date.now();
  
  return allSectionDocs;
};

// Helper to clear cache manually (e.g., when a student is added/updated)
const clearSectionDocsCache = () => {
  sectionDocsCache = null;
  cacheTimestamp = 0;
};

module.exports = {
  getAllSectionDocs,
  clearSectionDocsCache
};
