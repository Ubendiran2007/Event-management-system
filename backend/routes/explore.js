const express = require('express');
const router = express.Router();
const { getFirestore } = require('firebase-admin/firestore');
const { parsePaginationParams, encodeCursor, decodeCursor } = require('../utils/paginationHelper');

const db = getFirestore();

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

// Statuses that are publicly visible on the Explore page
const PUBLIC_STATUSES = ['POSTED', 'APPROVED', 'COMPLETED'];

// GET /api/explore — publicly visible events with cursor-based pagination
router.get('/', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const { limit: limitCount, cursor, sortOrder } = parsePaginationParams(req.query, 20, 50);
    const { status, search } = req.query;

    // Filter to allowed statuses
    const allowedStatuses = status && PUBLIC_STATUSES.includes(status)
      ? [status]
      : PUBLIC_STATUSES;

    // Use 'in' query for status filtering with deterministic sort
    let queryRef = db.collection('events')
      .where('status', 'in', allowedStatuses)
      .orderBy('date', 'desc')
      .orderBy('__name__', 'asc');

    // Apply cursor if provided
    if (cursor) {
      const cursorValues = decodeCursor(cursor);
      if (cursorValues && cursorValues.length === 2) {
        const [dateVal, docId] = cursorValues;
        try {
          const cursorDoc = await db.collection('events').doc(docId).get();
          if (cursorDoc.exists) {
            queryRef = queryRef.startAfter(cursorDoc);
          }
        } catch (_) {}
      }
    }

    const snapshot = await queryRef.limit(limitCount + 1).get();
    const allDocs = snapshot.docs;
    const hasMore = allDocs.length > limitCount;
    const dataDocs = hasMore ? allDocs.slice(0, limitCount) : allDocs;

    let events = dataDocs.map(d => ({ id: d.id, ...d.data() }));

    // Server-side search (lightweight — only for small filtered sets)
    if (search) {
      const q = search.toLowerCase();
      events = events.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.venue || '').toLowerCase().includes(q) ||
        (e.organizerName || '').toLowerCase().includes(q)
      );
    }

    const lastDoc = dataDocs.length > 0 ? dataDocs[dataDocs.length - 1] : null;
    const nextCursor = hasMore && lastDoc
      ? encodeCursor(lastDoc, ['date', '__name__'])
      : null;

    res.json({
      success: true,
      events,
      // Also expose in standard paginated format
      data: events,
      hasMore,
      nextCursor,
      pagination: { limit: limitCount, hasMore, nextCursor, count: events.length }
    });
  } catch (err) {
    console.error('Error fetching explore events:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/explore/:id — single publicly visible event
router.get('/:id', async (req, res) => {
  if (checkDb(res)) return;
  try {
    const docRef = db.collection('events').doc(req.params.id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
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
