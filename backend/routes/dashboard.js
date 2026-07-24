const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { collection, getDocs, query, where, doc, updateDoc, collectionGroup, db, getCountFromServer } = require('../firebaseClientWrapper');
const { CLASSES } = require('../utils/constants');
const { getAllSectionDocs } = require('../utils/studentHelper');

const router = express.Router();

// Enforce authentication for all routes in this router
router.use(requireAuth);


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
    
    // Evaluate Postponement Expirations Dynamically
    const nowTime = new Date();
    
    for (let ev of events) {
      if (ev.postponementRequest && (ev.postponementRequest.status === 'PENDING_FACULTY' || ev.postponementRequest.status === 'PENDING_HOD' || ev.postponementRequest.status === 'PENDING_IQAC')) {
        const eventDateStr = ev.requisition?.step1?.eventStartDate || ev.date;
        const eventStartTimeStr = ev.requisition?.step1?.eventStartTime || ev.startTime || '00:00';
        
        if (eventDateStr) {
          const createDate = (dateStr, timeStr) => {
            const [h, m] = String(timeStr).split(':').map(Number);
            const d = new Date(dateStr);
            d.setHours(h, m, 0, 0);
            return d;
          };
          
          const eventStart = createDate(eventDateStr, eventStartTimeStr);
          
          if (nowTime.getTime() > eventStart.getTime()) {
             // EXPIRED!
             ev.postponementRequest.status = 'EXPIRED';
             ev.postponementRequest.expiredAt = nowTime.toISOString();
             ev.postponementRequest.expiryReason = 'Original event start time has already been reached.';
             
             const updatePayload = {
               'postponementRequest.status': 'EXPIRED',
               'postponementRequest.expiredAt': ev.postponementRequest.expiredAt,
               'postponementRequest.expiryReason': ev.postponementRequest.expiryReason,
               'eventActions': [...(ev.eventActions || []), {
                  action: 'POSTPONEMENT_EXPIRED',
                  timestamp: nowTime.toISOString(),
                  reason: 'Original event start time reached before approval.'
               }]
             };
             
             // Update Firestore asynchronously
             updateDoc(doc(db, 'events', ev.id), updatePayload).catch(err => {
                console.error('[dashboard/events] Failed to expire postponement for event', ev.id, err);
             });
             
             // Note: Email notifications for expiry would go here (Rule 4 & 5).
             console.log(`[dashboard/events] Event ${ev.id} postponement request automatically expired.`);
          }
        }
      }
    }

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

    const allStudents = [];
    
    const sectionDocs = await getAllSectionDocs();
    sectionDocs.forEach(secDoc => {
      const students = secDoc.data.students || [];
      students.forEach((s) => {
        const { password: _pw, ...safeData } = s;
        
        // If a class filter is provided, ensure it matches
        if (className && safeData.class !== className && safeData.section !== className) {
          return;
        }
        allStudents.push({ id: s.id, ...safeData });
      });
    });

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
    // Aggregation queries for Events
    let eventsCol = collection(db, 'events');
    let odCol = collection(db, 'odRequests');

    // Scope queries based on role
    if (req.user.role === 'STUDENT_GENERAL' || req.user.role === 'STUDENT_ORGANIZER') {
      eventsCol = query(collection(db, 'events'), where('organizerId', '==', req.user.id));
      odCol = query(collection(db, 'odRequests'), where('studentId', '==', req.user.id));
    } else if (req.user.role === 'FACULTY' || req.user.role === 'HOD') {
      if (req.user.department) {
        odCol = query(collection(db, 'odRequests'), where('department', '==', req.user.department));
      }
    }

    const results = await Promise.allSettled([
      getCountFromServer(eventsCol),
      getCountFromServer(query(eventsCol, where('status', '==', 'COMPLETED'))),
      getCountFromServer(query(eventsCol, where('status', '==', 'REJECTED'))),
      getCountFromServer(query(eventsCol, where('status', '==', 'PENDING_FACULTY'))),
      getCountFromServer(query(eventsCol, where('status', '==', 'PENDING_HOD'))),
      getCountFromServer(query(eventsCol, where('status', '==', 'PENDING_IQAC'))),
      getCountFromServer(query(eventsCol, where('status', '==', 'PENDING_DEPARTMENTS'))),
      getCountFromServer(query(eventsCol, where('status', '==', 'POSTED'))),
      getCountFromServer(query(eventsCol, where('status', '==', 'APPROVED'))),
      
      getCountFromServer(odCol),
      getCountFromServer(query(odCol, where('status', '==', 'PENDING_HOD'))), 
      getCountFromServer(query(odCol, where('status', '==', 'APPROVED'))),
      getCountFromServer(query(odCol, where('status', '==', 'REJECTED'))),
      getCountFromServer(query(odCol, where('status', '==', 'PENDING_TUTOR')))
    ]);

    const getCount = (index) => results[index].status === 'fulfilled' ? results[index].value.data().count : 0;

    const eventsTotal = getCount(0);
    const eventsCompleted = getCount(1);
    const eventsRejected = getCount(2);
    const eventsPendingFaculty = getCount(3);
    const eventsPendingHod = getCount(4);
    const eventsPendingIqac = getCount(5);
    const eventsPendingBase = getCount(6);
    const eventsPosted = getCount(7);
    const eventsApproved = getCount(8);
    
    const odTotal = getCount(9);
    const odPendingHod = getCount(10);
    const odApproved = getCount(11);
    const odRejected = getCount(12);
    const odPendingTutorCount = getCount(13);

    const pendingODs = odPendingHod;

    const summary = {
      events: {
        total: eventsTotal,
        pending: eventsPendingFaculty + eventsPendingHod + eventsPendingIqac + eventsPendingBase,
        posted: eventsPosted + eventsApproved,
        completed: eventsCompleted,
        rejected: eventsRejected,
        pendingFaculty: eventsPendingFaculty,
        pendingHod: eventsPendingHod,
        pendingIqac: eventsPendingIqac,
      },
      odRequests: {
        total: odTotal,
        pending: pendingODs + odPendingTutorCount,
        approved: odApproved,
        rejected: odRejected,
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
    // Fetch events, OD requests in parallel
    const [eventsSnap, odSnap] = await Promise.all([
      getDocs(collection(db, 'events')),
      getDocs(collection(db, 'odRequests'))
    ]);

    const events = snapshotToArray(eventsSnap);
    const odRequests = snapshotToArray(odSnap);

    const students = [];
    const sectionDocs = await getAllSectionDocs();
    sectionDocs.forEach(secDoc => {
      const arr = secDoc.data.students || [];
      arr.forEach((s) => {
        const { password: _pw, ...safeData } = s;
        students.push({ id: s.id, ...safeData });
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
