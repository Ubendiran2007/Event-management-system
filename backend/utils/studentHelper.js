const { collection, getDocs, db } = require('../firebaseClientWrapper');

// Helper to fetch all section documents across the DB
const getAllSectionDocs = async () => {
  const allSectionDocs = [];
  // Use listDocuments() to find phantom batch documents (documents that only have subcollections)
  const batchDocsRefs = await db.collection('students').listDocuments();
  
  for (const batchRef of batchDocsRefs) {
    const depts = await batchRef.listCollections();
    for (const deptCol of depts) {
      if (deptCol.id === 'departments') continue; // skip old structure if present
      const snap = await deptCol.get();
      snap.docs.forEach(d => allSectionDocs.push({
         ref: d.ref,
         data: d.data(),
         batch: batchRef.id,
         dept: deptCol.id,
         sec: d.id
      }));
    }
  }
  return allSectionDocs;
};

module.exports = {
  getAllSectionDocs
};
