const express = require('express');
const { collection, getDocs, query, where } = require('firebase/firestore');
const { db } = require('../firebase');

const router = express.Router();

// ── Helper: abort early if Firebase isn't initialised yet ────────────────────
function checkDb(res) {
  if (!db) {
    res.status(503).json({
      success: false,
      message:
        'Firebase is not configured. Add backend/serviceAccountKey.json and restart the server.',
    });
    return false;
  }
  return true;
}

// ── Helper: flatten a Firestore snapshot into a plain array ──────────────────
function snapshotToArray(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/events
// Query params (all optional):
//   ?status=PENDING_FACULTY        → filter by event status
//   ?organizerId=<id>              → filter by organiser
// ────────────────────────────────────────────────────────────────────────────
router.get('/events', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { status, organizerId } = req.query;

    let q = collection(db, 'events');

    // Build a constrained query only when filters are present
    const constraints = [];
    if (status) constraints.push(where('status', '==', status));
    if (organizerId) constraints.push(where('organizerId', '==', organizerId));

    const snapshot =
      constraints.length > 0
        ? await getDocs(query(q, ...constraints))
        : await getDocs(q);

    const events = snapshotToArray(snapshot);

    return res.json({ success: true, count: events.length, events });
  } catch (error) {
    console.error('[dashboard/events] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch events', error: error.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/od-requests
// Query params (all optional):
//   ?studentId=<id>   → filter by student
//   ?status=<status>  → filter by status
// ────────────────────────────────────────────────────────────────────────────
router.get('/od-requests', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { studentId, status } = req.query;

    const constraints = [];
    if (studentId) constraints.push(where('studentId', '==', studentId));
    if (status) constraints.push(where('status', '==', status));

    const snapshot =
      constraints.length > 0
        ? await getDocs(query(collection(db, 'odRequests'), ...constraints))
        : await getDocs(collection(db, 'odRequests'));

    const odRequests = snapshotToArray(snapshot);

    return res.json({ success: true, count: odRequests.length, odRequests });
  } catch (error) {
    console.error('[dashboard/od-requests] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch OD requests', error: error.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/students
// Query params (all optional):
//   ?class=CSE-D   → restrict to a single class
// ────────────────────────────────────────────────────────────────────────────
router.get('/students', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { class: className } = req.query;
    const classesToFetch = className ? [className] : ['CSE-B', 'CSE-D'];

    const allStudents = [];

    for (const cls of classesToFetch) {
      const snapshot = await getDocs(collection(db, 'students', cls, 'members'));
      snapshot.docs.forEach((d) => {
        // Never expose stored passwords
        const { password: _pw, ...safeData } = d.data();
        allStudents.push({ id: d.id, class: cls, ...safeData });
      });
    }

    return res.json({ success: true, count: allStudents.length, students: allStudents });
  } catch (error) {
    console.error('[dashboard/students] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch students', error: error.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/summary
// Returns aggregated counts for all dashboard stat cards in one request.
// ────────────────────────────────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    // Fetch events and OD requests in parallel
    const [eventsSnap, odSnap] = await Promise.all([
      getDocs(collection(db, 'events')),
      getDocs(collection(db, 'odRequests')),
    ]);

    const events = snapshotToArray(eventsSnap);
    const odRequests = snapshotToArray(odSnap);

    const summary = {
      events: {
        total: events.length,
        pending: events.filter((e) => e.status?.startsWith('PENDING')).length,
        posted: events.filter(
          (e) => e.status === 'POSTED' || e.status === 'APPROVED'
        ).length,
        completed: events.filter((e) => e.status === 'COMPLETED').length,
        rejected: events.filter((e) => e.status === 'REJECTED').length,
        // Breakdown by approval stage
        pendingFaculty: events.filter((e) => e.status === 'PENDING_FACULTY').length,
        pendingHod: events.filter((e) => e.status === 'PENDING_HOD').length,
        pendingPrincipal: events.filter((e) => e.status === 'PENDING_PRINCIPAL').length,
      },
      odRequests: {
        total: odRequests.length,
        pending: odRequests.filter((r) => r.status?.startsWith('PENDING')).length,
        approved: odRequests.filter((r) => r.status === 'APPROVED').length,
        rejected: odRequests.filter((r) => r.status === 'REJECTED').length,
      },
    };

    return res.json({ success: true, summary });
  } catch (error) {
    console.error('[dashboard/summary] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard summary', error: error.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard
// Single endpoint that returns everything the dashboard needs in one shot.
// ────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const classes = ['CSE-B', 'CSE-D'];

    // Fetch events and OD requests in parallel; students class-by-class
    const [eventsSnap, odSnap, ...studentSnaps] = await Promise.all([
      getDocs(collection(db, 'events')),
      getDocs(collection(db, 'odRequests')),
      ...classes.map((cls) => getDocs(collection(db, 'students', cls, 'members'))),
    ]);

    const events = snapshotToArray(eventsSnap);
    const odRequests = snapshotToArray(odSnap);

    const students = [];
    studentSnaps.forEach((snap, idx) => {
      snap.docs.forEach((d) => {
        const { password: _pw, ...safeData } = d.data();
        students.push({ id: d.id, class: classes[idx], ...safeData });
      });
    });

    return res.json({
      success: true,
      events,
      odRequests,
      students,
      summary: {
        totalEvents: events.length,
        pendingEvents: events.filter((e) => e.status?.startsWith('PENDING')).length,
        postedEvents: events.filter(
          (e) => e.status === 'POSTED' || e.status === 'APPROVED'
        ).length,
        completedEvents: events.filter((e) => e.status === 'COMPLETED').length,
        totalODRequests: odRequests.length,
        pendingODRequests: odRequests.filter((r) => r.status?.startsWith('PENDING')).length,
        totalStudents: students.length,
      },
    });
  } catch (error) {
    console.error('[dashboard] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard data', error: error.message });
  }
});

module.exports = router;
