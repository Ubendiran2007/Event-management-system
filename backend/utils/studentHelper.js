const { collection, getDocs, db } = require('../firebaseClientWrapper');

// Helper to fetch all section documents across the DB
const getAllSectionDocs = async () => {
  const allSectionDocs = [];
  const batchesSnap = await getDocs(collection(db, 'students'));
  
  for (const batchDoc of batchesSnap.docs) {
    const depts = await batchDoc.ref.listCollections();
    for (const deptCol of depts) {
      if (deptCol.id === 'departments') continue; // skip old structure if present
      const snap = await deptCol.get();
      snap.docs.forEach(d => allSectionDocs.push({
         ref: d.ref,
         data: d.data(),
         batch: batchDoc.id,
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
