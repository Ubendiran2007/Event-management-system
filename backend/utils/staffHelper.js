const { collection, getDocs, db } = require('../firebaseClientWrapper');

// Helper to fetch all staff category documents (e.g. Incharges, CSE, ECE)
const getAllStaffDocs = async () => {
  const allStaffDocs = [];
  const staffSnap = await getDocs(collection(db, 'staffs'));
  
  for (const doc of staffSnap.docs) {
    allStaffDocs.push({
       ref: doc.ref,
       category: doc.id,
       data: doc.data()
    });
  }
  return allStaffDocs;
};

module.exports = {
  getAllStaffDocs
};
