const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { collection, getDocs, doc, getDoc } = require('firebase/firestore');

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

// Statuses that are publicly visible on the Explore page
const PUBLIC_STATUSES = ['POSTED', 'APPROVED', 'COMPLETED'];

// GET /api/explore — all publicly visible events
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const snapshot = await getDocs(collection(db, 'events'));
    const events = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => PUBLIC_STATUSES.includes(e.status));

    res.json({ success: true, events, total: events.length });
  } catch (err) {
    console.error('Error fetching explore events:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/explore/:id — single publicly visible event
router.get('/:id', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const docRef = doc(db, 'events', req.params.id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const event = { id: docSnap.id, ...docSnap.data() };
    if (!PUBLIC_STATUSES.includes(event.status)) {
      return res.status(403).json({ success: false, message: 'Event is not publicly available' });
    }

    res.json({ success: true, event });
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
