const { collection, getDocs, db } = require('../firebaseClientWrapper');

// ── In-process cache (5-minute TTL) ──────────────────────────────────────────
let staffDocsCache     = null;
let staffCacheTimestamp = 0;
const STAFF_CACHE_TTL  = 5 * 60 * 1000; // 5 minutes

const getAllStaffDocs = async () => {
  if (staffDocsCache && Date.now() - staffCacheTimestamp < STAFF_CACHE_TTL) {
    return staffDocsCache;
  }

  const allStaffDocs = [];
  const staffSnap = await getDocs(collection(db, 'staffs'));
  for (const doc of staffSnap.docs) {
    allStaffDocs.push({ ref: doc.ref, category: doc.id, data: doc.data() });
  }

  staffDocsCache     = allStaffDocs;
  staffCacheTimestamp = Date.now();
  return allStaffDocs;
};

/** Call after any write to the staffs collection to force a fresh fetch next time. */
const clearStaffDocsCache = () => {
  staffDocsCache     = null;
  staffCacheTimestamp = 0;
};

module.exports = { getAllStaffDocs, clearStaffDocsCache };
