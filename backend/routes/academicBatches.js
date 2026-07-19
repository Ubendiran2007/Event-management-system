const express = require('express');
const router = express.Router();

const { collection, getDocs, doc, getDoc, updateDoc, setDoc, query, where, db } = require('../firebaseClientWrapper');

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

// Use the same CLASSES array as students.js to ensure we cover all students
const CLASSES = [
  'CSE-A', 'CSE-B', 'CSE-C', 'CSE-D',
  'ECE-A', 'ECE-B', 'ECE-C',
  'CCE-A', 'CCE-B',
  'CSBS-A', 'CSBS-B',
  'MECH-A', 'MECH-B', 'MECH-C',
  'CIVIL-A', 'CIVIL-B',
  'IT-A', 'IT-B', 'IT-C',
  'AIDS-A', 'AIDS-B',
  'AIML-A', 'AIML-B',
  'MTR-A', 'BME-A',
  'CYBER-A', 'EEE-A'
];

// GET /api/academic-batches - Fetch all academic batches
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const snapshot = await getDocs(collection(db, 'academicBatches'));
    const batches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, data: batches });
  } catch (error) {
    console.error('Error fetching academic batches:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch academic batches' });
  }
});

// POST /api/academic-batches - Create a new batch
router.post('/', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { name, admissionYear, graduationYear } = req.body;
    if (!name || !admissionYear || !graduationYear) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Create an ID from the name (e.g. 2024-2028 -> batch_2024_2028)
    const id = `batch_${name.replace('-', '_')}`;
    
    // Check for duplicates
    const existingSnap = await getDoc(doc(db, 'academicBatches', id));
    if (existingSnap.exists()) {
      return res.status(400).json({ success: false, message: 'An Academic Batch with this name already exists' });
    }
    
    const batchData = {
      name,
      admissionYear: Number(admissionYear),
      graduationYear: Number(graduationYear),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'academicBatches', id), batchData);
    res.json({ success: true, data: { id, ...batchData } });
  } catch (error) {
    console.error('Error creating academic batch:', error);
    res.status(500).json({ success: false, message: 'Failed to create academic batch' });
  }
});

// PUT /api/academic-batches/:id - Update batch
router.put('/:id', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    const { status, name, admissionYear, graduationYear } = req.body;
    
    const batchRef = doc(db, 'academicBatches', id);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    
    const updates = { updatedAt: new Date().toISOString() };
    if (status !== undefined) updates.status = status;
    if (name !== undefined && name !== batchSnap.data().name) {
      // If name is changing, we must check if the new ID already exists
      const newId = `batch_${name.replace('-', '_')}`;
      const existingSnap = await getDoc(doc(db, 'academicBatches', newId));
      if (existingSnap.exists()) {
        return res.status(400).json({ success: false, message: 'An Academic Batch with this name already exists' });
      }
      updates.name = name;
      
      // We also need to migrate the document to the new ID, but that's complex since we'd need to update all students. 
      // For now, we will reject name changes for simplicity, or we can just update the name field but keep the original document ID.
      // Keeping the original document ID is fine, but it might misalign with the ID scheme.
      // Let's just update the name. It's safer.
    }
    
    if (admissionYear !== undefined) updates.admissionYear = Number(admissionYear);
    if (graduationYear !== undefined) updates.graduationYear = Number(graduationYear);
    
    await updateDoc(batchRef, updates);
    res.json({ success: true, data: { id, ...batchSnap.data(), ...updates } });
  } catch (error) {
    console.error('Error updating academic batch:', error);
    res.status(500).json({ success: false, message: 'Failed to update academic batch' });
  }
});

// POST /api/academic-batches/:id/graduate - Graduate a batch and all its students
router.post('/:id/graduate', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { id } = req.params;
    
    const batchRef = doc(db, 'academicBatches', id);
    const batchSnap = await getDoc(batchRef);
    if (!batchSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    
    const batchData = batchSnap.data();
    if (batchData.status === 'GRADUATED') {
      return res.status(400).json({ success: false, message: 'Batch is already graduated' });
    }
    if (batchData.status === 'ARCHIVED') {
      return res.status(400).json({ success: false, message: 'Cannot graduate an archived batch. Please activate it first.' });
    }
    
    // 1. Query all students across all classes where academicBatch == batchData.name
    // To validate that the batch contains students before allowing graduation.
    let studentsToUpdate = [];
    for (const className of CLASSES) {
      const classRef = collection(db, 'students', className, 'members');
      const q = query(classRef, where('academicBatch', '==', batchData.name));
      const snap = await getDocs(q);
      
      snap.docs.forEach(doc => {
        if (doc.data().studentStatus !== 'GRADUATED') {
          studentsToUpdate.push(doc.ref);
        }
      });
    }

    if (studentsToUpdate.length === 0) {
      return res.status(400).json({ success: false, message: 'Cannot graduate batch: No active students found in this batch.' });
    }
    
    // 2. Mark batch as graduated
    await updateDoc(batchRef, {
      status: 'GRADUATED',
      updatedAt: new Date().toISOString()
    });

    // 3. Update students
    const updatePromises = studentsToUpdate.map(ref => 
      updateDoc(ref, { 
        studentStatus: 'GRADUATED', 
        updatedAt: new Date().toISOString() 
      })
    );
    await Promise.all(updatePromises);
    
    res.json({ 
      success: true, 
      message: `Successfully graduated batch. Updated ${studentsToUpdate.length} students.` 
    });
  } catch (error) {
    console.error('Error graduating academic batch:', error);
    res.status(500).json({ success: false, message: 'Failed to graduate academic batch' });
  }
});

module.exports = router;
