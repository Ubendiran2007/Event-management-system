const { dbAdmin, admin } = require('./firebaseAdmin');

const db = dbAdmin;

function doc(dbRef, col, id, ...rest) {
  // If first argument is a CollectionReference (from `collection(db, 'name')`)
  if (dbRef && typeof dbRef.doc === 'function' && typeof dbRef.add === 'function') {
    if (!col) return dbRef.doc(); // Auto-id
    return dbRef.doc(col);
  }

  // doc(db, 'events') -> auto id?
  if (arguments.length === 2) {
    return dbAdmin.collection(col).doc();
  }

  // doc(db, 'events', 'id') or doc(db, 'events', 'id', 'sub', 'subid')
  let ref = dbAdmin.collection(col);
  for (let i = 2; i < arguments.length; i += 2) {
    if (arguments[i]) ref = ref.doc(arguments[i]);
    if (i + 1 < arguments.length && arguments[i+1]) {
      ref = ref.collection(arguments[i+1]);
    }
  }
  return ref;
}

function collection(dbRef, col, ...rest) {
  // if called as collection(docRef, 'subcollection')
  if (dbRef && typeof dbRef.collection === 'function' && typeof dbRef.set === 'function') {
    return dbRef.collection(col);
  }
  
  let ref = dbAdmin.collection(col);
  for (let i = 2; i < arguments.length; i += 2) {
    ref = ref.doc(arguments[i]);
    if (i + 1 < arguments.length) {
      ref = ref.collection(arguments[i+1]);
    }
  }
  return ref;
}

function collectionGroup(dbRef, col) {
  return dbAdmin.collectionGroup(col);
}

const wrapSnapshot = (snap) => {
  if (!snap) return snap;
  // If it's a QuerySnapshot (has docs array)
  if (snap.docs) {
    return {
      ...snap,
      docs: snap.docs.map(wrapSnapshot),
      empty: snap.empty,
      size: snap.size,
      forEach: (cb) => snap.forEach((docSnap) => cb(wrapSnapshot(docSnap)))
    };
  }
  // It's a DocumentSnapshot
  return {
    ...snap,
    id: snap.id,
    ref: snap.ref,
    data: () => snap.data(),
    exists: () => snap.exists, // Web SDK compatibility!
    get: (field) => snap.get(field)
  };
};

const getDoc = async (ref) => {
  const snap = await ref.get();
  return wrapSnapshot(snap);
};

const getDocs = async (queryRef) => {
  const snap = await queryRef.get();
  return wrapSnapshot(snap);
};

const addDoc = async (colRef, data) => {
  const res = await colRef.add(data);
  return res;
};

const updateDoc = async (ref, data) => {
  return await ref.update(data);
};

const setDoc = async (ref, data) => {
  return await ref.set(data);
};

const deleteDoc = async (ref) => {
  return await ref.delete();
};

const query = (baseRef, ...conditions) => {
  let q = baseRef;
  for (const cond of conditions) {
    if (!cond) continue;
    if (cond.type === 'where') q = q.where(cond.field, cond.op, cond.value);
    if (cond.type === 'orderBy') q = q.orderBy(cond.field, cond.dir);
    if (cond.type === 'limit') q = q.limit(cond.val);
    if (cond.type === 'startAfter') q = q.startAfter(...cond.vals);
    if (cond.type === 'endBefore') q = q.endBefore(...cond.vals);
  }
  return q;
};

const getCountFromServer = async (queryRef) => {
  const snapshot = await queryRef.count().get();
  return {
    data: () => ({ count: snapshot.data().count })
  };
};

const where = (field, op, value) => {
  if (value === undefined) {
    const err = new Error(`[FIRESTORE FATAL] where() called with undefined value for field "${field}". This indicates a systemic data flow failure.`);
    console.error(err.stack);
    throw err;
  }
  return { type: 'where', field, op, value };
};
const orderBy = (field, dir = 'asc') => ({ type: 'orderBy', field, dir });
const limit = (val) => ({ type: 'limit', val });
const startAfter = (...vals) => ({ type: 'startAfter', vals });
const endBefore = (...vals) => ({ type: 'endBefore', vals });

const runTransaction = async (dbRef, callback) => {
  return await dbAdmin.runTransaction(async (t) => {
    // We must wrap the transaction object to wrap its get() method
    const wrappedTransaction = {
      ...t,
      get: async (ref) => {
        const snap = await t.get(ref);
        return wrapSnapshot(snap);
      },
      set: (ref, data) => t.set(ref, data),
      update: (ref, data) => t.update(ref, data),
      delete: (ref) => t.delete(ref)
    };
    return await callback(wrappedTransaction);
  });
};

const writeBatch = (dbRef) => {
  return dbAdmin.batch();
};

const arrayUnion = (...args) => admin.firestore.FieldValue.arrayUnion(...args);
const arrayRemove = (...args) => admin.firestore.FieldValue.arrayRemove(...args);
const deleteField = () => admin.firestore.FieldValue.delete();
const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const increment = (n) => admin.firestore.FieldValue.increment(n);

module.exports = {
  db,
  doc,
  collection,
  collectionGroup,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  getCountFromServer,
  runTransaction,
  writeBatch,
  arrayUnion,
  arrayRemove,
  deleteField,
  serverTimestamp,
  increment
};
