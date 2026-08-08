const express = require('express');
const crypto = require('crypto');
const {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  startAfter,
  runTransaction,
  writeBatch,
  arrayUnion,
  deleteField,
  db
} = require('../firebaseClientWrapper');
const { parsePaginationParams, decodeCursor, formatPaginatedResponse } = require('../utils/paginationHelper');
const { storageAdmin } = require('../firebaseAdmin');
// Helper to recursively delete a folder in Firebase Storage using Admin SDK
const deleteStorageFolder = async (folderPath) => {
  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'eventmanagement-58831.firebasestorage.app';
    const bucket = storageAdmin.bucket(bucketName);
    await bucket.deleteFiles({ prefix: folderPath });
  } catch (error) {
    if (error.code !== 404) {
      console.error(`[deleteStorageFolder] Error deleting ${folderPath}:`, error.message);
    }
  }
};
const {
  sendEventNotificationToFaculty,
  sendEventStatusNotification,
  sendApprovalRequestToRole,
  sendPosterRequestEmail,
  sendPosterReadyEmail,
} = require('../services/emailService');
const {
  handleEventStatusChange,
  handleIQACExtensionRequest,
  handleIQACExtensionDecision,
  handleEventCancelled,
  handleEventPostponed,
  notifyManagersAssigned,
  handleModificationRequestSubmitted,
  handleModificationRequestDecision,
  executeBackgroundNotification
} = require('../services/emailHandler');
const { requireAuth, requireRole, assertDeptMatch } = require('../middleware/auth');
const { computeRegistrationStatus, getRegistrationMeta, INDIVIDUAL_REGISTRATION_STATUSES, EXTENSION_POLICY, isExtensionAllowed, isRoleAllowedToExtend } = require('../utils/eventHelpers');
const { validateEvent } = require('../middleware/validators');
const asyncHandler = require('../utils/asyncHandler');
const { getUserId } = require('../utils/authHelper');
const { logActivity, logAudit } = require('../utils/logger');
const eventPublisher = require('../events/publishers/eventPublisher');
const ScheduleService = require('../services/ScheduleService');
const RegistrationConflictService = require('../services/RegistrationConflictService');
const ManagerAvailabilityService = require('../services/ManagerAvailabilityService');
const ManagerRecommendationService = require('../services/ManagerRecommendationService');
const multer = require('multer');

const router = express.Router();

// Enforce authentication for all routes in this router
router.use(requireAuth);

// ── Guard: firebase not ready ────────────────────────────────────────────────
function checkDb(res) {
  if (!db) {
    res.status(503).json({
      success: false,
      message: 'Firebase is not configured. Add backend/serviceAccountKey.json and restart.',
    });
    return false;
  }
  return true;
}

// ── Helper: Generate IQAC Reference ID ─────────────────────────────────────
async function generateEventReferenceId(department, startDateStr) {
  try {
    const date = new Date(startDateStr || Date.now());
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const acYearStart = month >= 6 ? year : year - 1;
    const acYearEnd = String(acYearStart + 1).slice(-2);
    const acYear = `${acYearStart}-${acYearEnd}`;
    const deptCode = String(department || 'GEN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);

    const counterDocId = `events_${acYear}_${deptCode}`;
    const counterRef = doc(db, 'counters', counterDocId);

    const newSeq = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let seq = 1;
      if (counterDoc.exists()) {
        seq = (counterDoc.data().seq || 0) + 1;
      }
      transaction.set(counterRef, { seq }, { merge: true });
      return seq;
    });

    const paddedSeq = String(newSeq).padStart(2, '0');
    return `IQAC/${acYear}/${deptCode}/${paddedSeq}`;
  } catch (error) {
    console.error('[events] Failed to generate Reference ID:', error.message);
    const randomFallback = Math.floor(Math.random() * 900) + 100;
    return `IQAC/TEMP/${randomFallback}`;
  }
}


// â”€â”€ Helper: Fetch faculty email by name â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Searches "coordinators" collection for matching faculty name
async function getFacultyEmailByName(facultyName) {
  if (!facultyName || !db) {
    return null;
  }

  try {
    const coordinatorsSnapshot = await getDocs(
      query(
        collection(db, 'coordinators'),
        where('name', '==', facultyName),
        limit(1)
      )
    );

    if (!coordinatorsSnapshot.empty) {
      const coordinatorData = coordinatorsSnapshot.docs[0].data();
      return coordinatorData.email || null;
    }

    const usersSnapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('name', '==', facultyName),
        where('role', '==', 'FACULTY'),
        limit(1)
      )
    );

    if (!usersSnapshot.empty) {
      return usersSnapshot.docs[0].data().email || null;
    }

    return null;
  } catch (error) {
    console.warn('[events] Error fetching faculty email:', error.message);
    return null;
  }
}

// â”€â”€ Helper: Fetch official emails by role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getOfficialEmailsByRole(role) {
  if (!role || !db) return [];
  try {
    const usersSnapshot = await getDocs(
      query(collection(db, 'users'), where('role', '==', role))
    );
    return usersSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
  } catch (error) {
    console.warn(`[events] Error fetching ${role} emails:`, error.message);
    return [];
  }
}

// â”€â”€ Helper: Get required departments for an event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getRequiredDepartments(eventData) {
  const reqs = eventData.requisition?.step1?.requirements || {};
  // Backward compatibility if requirements are at root level
  const isRequired = (key) => reqs[key] ?? eventData[key] ?? false;

  const requiredDepts = [];
  if (isRequired('venueRequired')) requiredDepts.push('venue');
  if (isRequired('audioRequired')) requiredDepts.push('audio');
  if (isRequired('ictsRequired')) requiredDepts.push('icts');
  if (isRequired('transportRequired')) requiredDepts.push('transport');
  if (isRequired('mediaRequired')) requiredDepts.push('media');

  if (isRequired('accommodationDiningRequired') || isRequired('accommodationRequired')) {
    const accom = eventData.requisition?.annexureV_accommodation || {};
    const males = Number(accom.maleGuests || 0);
    const females = Number(accom.femaleGuests || 0);

    if (males > 0) requiredDepts.push('boysAccommodation');
    if (females > 0) requiredDepts.push('girlsAccommodation');
    if (males === 0 && females === 0) requiredDepts.push('boysAccommodation'); // fallback
  }
  return requiredDepts;
}

// â”€â”€ POST /api/events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ── POST /api/events/upload-poster ──────────────────────────────────────────
// Uploads a poster via backend using Firebase Admin SDK (bypasses client storage auth rules)
const posterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, or WEBP images are allowed.'));
    }
    cb(null, true);
  }
}).single('poster');

router.post('/upload-poster', requireAuth, (req, res) => {
  posterUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No poster file provided.' });
    try {
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'eventmanagement-58831.firebasestorage.app';
      const bucket = storageAdmin.bucket(bucketName);
      const eventId = req.body.eventId || `temp_${req.user.id}_${Date.now()}`;
      const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
      const storagePath = `events/${eventId}/poster_${Date.now()}.${ext}`;
      const fileRef = bucket.file(storagePath);
      await fileRef.save(req.file.buffer, {
        contentType: req.file.mimetype,
        metadata: { uploadedBy: req.user.id, uploadedAt: new Date().toISOString() }
      });
      // Build the Firebase Storage public download URL without calling makePublic()
      // (makePublic() fails on buckets with Uniform bucket-level access control enabled)
      const encodedPath = encodeURIComponent(storagePath);
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;
      return res.json({
        success: true,
        storagePath,
        downloadURL,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString()
      });
    } catch (uploadErr) {
      console.error('[events/upload-poster] Error:', uploadErr.message, uploadErr.code || '');
      return res.status(500).json({ success: false, message: 'Failed to upload poster.', error: uploadErr.message });
    }
  });
});

// Create a new event (saves to Firestore "events" collection)
router.post('/', requireRole(['STUDENT_ORGANIZER', 'FACULTY']), validateEvent, asyncHandler(async (req, res) => {
  if (!checkDb(res)) return;

  const eventData = req.body;
  const actingRole = req.user.role;

  const { parseEventStartDateTime } = require('../services/eventAutoRejectionService');
  const startDateTime = parseEventStartDateTime(eventData);
  if (startDateTime) {
    const nowMs = new Date().getTime();
    const startMs = startDateTime.getTime();
    const rejectAtMs = startMs - parseInt(process.env.AUTO_REJECT_BEFORE_START_MINUTES || '5', 10) * 60 * 1000;
    if (nowMs >= rejectAtMs) {
      return res.status(400).json({ success: false, message: 'Cannot create an event that starts in less than 5 minutes or is already in the past.' });
    }
  }

  const startDateTimeStr = eventData.requisition?.step1?.eventStartDate || eventData.date;
  const department = eventData.department || eventData.requisition?.step1?.organizerDetails?.department || 'GEN';
  const referenceId = await generateEventReferenceId(department, startDateTimeStr);

  const payload = {
    ...eventData,
    referenceId,
    // Ownership constraints - explicitly override client values
    createdBy: req.user.id,
    organizerId: req.user.id,
    organizer: {
      id: req.user.id,
      name: req.user.name || '',
      email: req.user.email || '',
      department: req.user.department || department,
      class: req.user.className || null,
      section: req.user.section || null,
      batch: req.user.batch || null,
      rollNo: req.user.rollNo || null
    },
    department: req.user.department || department,
    // System fields
    creatorType: actingRole === 'FACULTY' ? 'FACULTY' : 'STUDENT',
    status: eventData.status || 'PENDING_MANAGERS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Ensure all managers have a default status of PENDING (except creator who is auto-accepted)
  if (payload.managers && payload.managers.length > 0) {
    payload.managers = payload.managers.map(m => ({
      ...m,
      status: m.status || (m.email === req.user.email ? 'ACCEPTED' : 'PENDING')
    }));
    payload.managerIds = payload.managers.map(m => m.userId || m.id).filter(Boolean);
  } else {
    payload.managerIds = [];
  }

  // Approval chain gate for PENDING_MANAGERS: if managers were pre-accepted, advance
  if (payload.status === 'PENDING_MANAGERS' && payload.managers && payload.managers.length > 0) {
    const nonOrganizerManagers = payload.managers.filter(m => m.email !== req.user.email);
    const acceptedNonOrganizer = nonOrganizerManagers.filter(m => m.status === 'ACCEPTED');
    if (nonOrganizerManagers.length > 0 && acceptedNonOrganizer.length >= 1) {
      // All required managers have accepted; advance to next stage
      payload.status = payload.creatorType === 'FACULTY' ? 'PENDING_HOD' : 'PENDING_FACULTY';
    }
  }

  // Legacy guard: if someone explicitly sent PENDING_FACULTY/PENDING_HOD without manager acceptance, pull back
  if (['PENDING_FACULTY', 'PENDING_HOD'].includes(payload.status) && payload.managers && payload.managers.length > 0) {
    const nonOrganizerManagers = payload.managers.filter(m => m.email !== req.user.email);
    const acceptedNonOrganizer = nonOrganizerManagers.filter(m => m.status === 'ACCEPTED');
    if (nonOrganizerManagers.length > 0 && acceptedNonOrganizer.length < 1) {
      payload.status = 'PENDING_MANAGERS';
    }
  }

  // Validate manager assignments
  if (payload.managers && payload.managers.length > 0) {
    try {
      const evDate = payload.requisition?.step1?.eventStartDate || payload.date;
      const evStartTime = payload.requisition?.step1?.eventStartTime || payload.startTime || '00:00';
      const evEndTime = payload.requisition?.step1?.eventEndTime || payload.endTime || '23:59';
      await ManagerAvailabilityService.validateManagerAssignments(eventData.id || null, evDate, evStartTime, evEndTime, payload.managers, req.user);
    } catch (err) {
      if (err.status === 409 || (err.message && err.message.includes('CONFLICT'))) {
        return res.status(409).json({
          success: false,
          message: err.message.split(':')[1] || err.message,
          conflicts: err.conflicts || []
        });
      }
      throw err;
    }
  }

  const VenueAvailabilityService = require('../services/venueAvailabilityService');
  const { logAudit } = require('../utils/logger');
  const reservationId = eventData.reservationId && String(eventData.reservationId).trim() ? String(eventData.reservationId).trim() : null;

  const isDraft = payload.status === 'DRAFT';
  
  // Stage 4 transaction: Verify Hold → Create Event → Convert HELD→BOOKED → Link → Audit
  let docRef;
  let eventId;
  await runTransaction(db, async (transaction) => {
    // Step 1: if reservationId provided, validate and prepare HOLD→BOOKED (atomic w/ event create)
    // SKIP consuming reservation if this is just a draft
    if (reservationId && !isDraft) {
      await VenueAvailabilityService.consumeReservation(reservationId, {
        t: transaction,
        eventId: eventData.id || null, // will be updated below for new events
        userId: req.user.id, userName: req.user.name || req.user.email,
        bookedBy: { uid: req.user.id, name: req.user.name || req.user.email, role: actingRole }
      });
    }

    // Step 2: Create/Update event document inside same transaction
    if (eventData.id) {
      docRef = doc(db, 'events', eventData.id);
      transaction.set(docRef, payload);
      eventId = eventData.id;
    } else {
      docRef = doc(collection(db, 'events')); // auto-id inside tx
      eventId = docRef.id;
      transaction.set(docRef, payload);
    }

    // Step 3: Link the final eventId onto the reservation (if it was a new id it's docRef.id)
    if (reservationId) {
      transaction.set(doc(db, 'venueReservations', reservationId), {
        eventId,
        eventName: payload.title || payload.eventName || null,
        eventDepartment: payload.department || null,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  });

  // Post-transaction: audit logs for venue booking
  if (reservationId && !isDraft) {
    try {
      const actor = { userId: req.user.id, name: req.user.name || req.user.email, role: actingRole, department: req.user.department };
      const target = { entityType: 'VENUE_RESERVATION', entityId: reservationId, venueId: payload.venueId || eventData.venueId || null, eventId };
      await logAudit({
        category: 'VENUE',
        action: 'VENUE_BOOKED',
        status: 'SUCCESS',
        severity: 'HIGH',
        correlationId: eventId,
        requestId: crypto.randomUUID(),
        actor, target,
        details: {
          date: payload.requisition?.step1?.eventStartDate || payload.date,
          startTime: payload.requisition?.step1?.eventStartTime || payload.startTime,
          endTime: payload.requisition?.step1?.eventEndTime || payload.endTime,
          reservationId,
          eventId
        },
        ipAddress: req.ip || (req.headers && req.headers['x-forwarded-for']) || null,
        userAgent: (req.headers && req.headers['user-agent']) || null
      });
    } catch (auditErr) {
      console.warn('[events] Venue booking audit double-fault (ignored):', auditErr.message);
    }
  }

  // ── Background Notifications (centralized handler) ─────────────────
  const payloadWithId = { id: docRef.id, ...payload };
  if (!isDraft) {
    executeBackgroundNotification('events/create', async () => {
    // Resolve faculty email if student-created event
    let targetApproverId = null;
    if (payload.status === 'PENDING_FACULTY') {
      let facultyEmail = payload.coordinator?.facultyEmail ||
                         payload.coordinator?.faculty_email ||
                         payload.facultyEmail || null;
      if (typeof facultyEmail === 'string') facultyEmail = facultyEmail.trim().toLowerCase();
      if (!facultyEmail && payload.coordinator?.facultyName) {
        facultyEmail = await getFacultyEmailByName(String(payload.coordinator.facultyName).trim());
      }
      targetApproverId = facultyEmail;
      payloadWithId.coordinator = { ...payloadWithId.coordinator, facultyEmail };
    }
    
    // Parallel execution: New EventBus Publisher
    eventPublisher.publishEventCreated({
      eventId: payloadWithId.id,
      organizerId: req.user.id,
      eventTitle: payloadWithId.title || payloadWithId.eventName,
      eventType: payloadWithId.eventType,
      department: payloadWithId.department,
      targetApprovers: targetApproverId ? [targetApproverId] : [],
      correlationId: crypto.randomUUID()
    });

    await handleEventStatusChange(payloadWithId, null, payload.status);
    if (payloadWithId.managers && payloadWithId.managers.length > 0) {
      await notifyManagersAssigned(payloadWithId, payloadWithId.managers, []);
    }
  });
  }

  logActivity({
    category: 'EVENT',
    action: 'EVENT_CREATED',
    status: 'SUCCESS',
    correlationId: docRef.id,
    requestId: crypto.randomUUID(),
    actor: {
      userId: req.user.id,
      name: req.user.name || 'Unknown User',
      role: req.user.role || 'STUDENT'
    },
    target: { entityType: 'EVENT', entityId: docRef.id },
    details: { title: payload.title, status: payload.status }
  });

  return res.status(201).json({
    success: true,
    message: 'Event created successfully',
    event: { id: docRef.id, ...payload },
  });
}));

// ── GET /api/events ────────────────────────────────────────────────────────
// Get all events. Optional query params for filtering and standard pagination.
router.get('/', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { status, organizerId, search, department, batch } = req.query;
    const { limit: limitCount, cursor, sortBy, sortOrder } = parsePaginationParams(req.query, 20);

    const constraints = [];

    if (status) {
      if (status.includes(',')) {
        constraints.push(where('status', 'in', status.split(',')));
      } else {
        constraints.push(where('status', '==', status));
      }
    }
    if (organizerId) constraints.push(where('organizerId', '==', organizerId));
    if (department) constraints.push(where('department', '==', department));
    if (batch) constraints.push(where('academicYear', '==', batch));
    
    // Simple equality for search (Firestore limitations apply without Algolia/Typesense)
    if (search) {
       // Typically you'd use a dedicated search index, but for basic implementation:
       // This requires precise match or prefix match if configured. We'll leave it as a comment 
       // or simple equality if exact name match is desired, but usually we recommend 
       // avoiding full-text search directly on Firestore without external tools.
       // constraints.push(where('eventName', '>=', search), where('eventName', '<=', search + '\uf8ff'));
    }

    // Deterministic sorting
    const allowedSortFields = ['createdAt', 'eventName', 'startDate'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    
    constraints.push(orderBy(sortField, sortOrder));
    if (sortField !== '__name__') {
      constraints.push(orderBy('__name__', 'asc')); // Tie-breaker
    }

    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded && Array.isArray(decoded)) {
        constraints.push(startAfter(...decoded));
      }
    }

    // Fetch limit + 1 to determine hasMore
    constraints.push(limit(limitCount + 1));

    const snapshot = await getDocs(query(collection(db, 'events'), ...constraints));

    const allDocs = snapshot.docs;
    const sortFields = sortField !== '__name__' ? [sortField, '__name__'] : ['__name__'];
    
    const response = formatPaginatedResponse(allDocs, limitCount, sortFields, (d) => {
       const data = d.data();
       return { id: d.id, ...data, registrationStatus: computeRegistrationStatus(data) };
    });

    return res.json(response);
  } catch (error) {
    console.error('[events/list] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch events', error: error.message });
  }
});

// ── GET /api/events/explore ──────────────────────────────────────────────────
// Backend paginated explore events query
router.get('/explore', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { pageSize = 20, lastEventId } = req.query;
    const limitCount = Math.min(parseInt(pageSize) || 20, 100); // Standardize: Max 100

    // HR has cross-department oversight, so its Explore view includes events
    // at every workflow stage. Other roles see public event states only.
    const constraints = [];
    if (req.user?.role !== 'HR_TEAM') {
      constraints.push(where('status', 'in', ['POSTED', 'POSTPONED', 'COMPLETED', 'CANCELLED']));
    }

    // Sort after retrieval because legacy documents do not consistently have
    // `createdAt`; Firestore orderBy would omit those events from Explore.

    const snapshot = await getDocs(query(collection(db, 'events'), ...constraints));

    // Resolve caller's context
    const currentUser = req.user; 
    const globalRoles = [
      'IQAC_TEAM', 'SYSTEM_ADMIN', 'HR_TEAM', 'AUDIO_TEAM',
      'TRANSPORT_TEAM', 'BOYS_WARDEN', 'GIRLS_WARDEN', 'MEDIA'
    ];
    const hasGlobalVisibility = globalRoles.includes(currentUser?.role);
    const userDept = String(currentUser?.department || '').toLowerCase();

    // Perform backend filtering
    const allFetched = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const filteredEvents = allFetched.filter(e => {
      if (e.status === 'CANCELLED' && !e.iqacApprovedAt) return false;

      const isOpenToAll = e.openToAllDepartments === true || e.audienceScope === 'Open To All' || String(e.department).toLowerCase() === 'overall';
      const isMyDept = String(e.department).toLowerCase() === userDept || (e?.requisition?.step1?.department === currentUser?.department);
      const isSelectedDept = Array.isArray(e.selectedDepartments) && e.selectedDepartments.includes(currentUser?.department);

      if (!hasGlobalVisibility && !isOpenToAll && !isMyDept && !isSelectedDept) {
        return false;
      }
      return true;
    });

    const getEventStartTime = (event) => {
      const step = event.requisition?.step1 || {};
      const date = step.eventStartDate || event.startDate || event.date;
      const time = step.eventStartTime || event.startTime || '00:00';
      const timestamp = date ? new Date(`${date}T${time}`).getTime() : 0;
      return Number.isNaN(timestamp) ? 0 : timestamp;
    };

    const orderedEvents = [...filteredEvents].sort((a, b) => {
      const byDate = getEventStartTime(b) - getEventStartTime(a);
      return byDate || String(a.id).localeCompare(String(b.id));
    });
    const cursorIndex = lastEventId ? orderedEvents.findIndex(event => event.id === lastEventId) : -1;
    const startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    const finalEvents = orderedEvents.slice(startIndex, startIndex + limitCount);
    
    // Add registration status
    const events = finalEvents.map(data => ({
      ...data,
      registrationStatus: computeRegistrationStatus(data)
    }));

    const nextCursor = finalEvents.length > 0 ? finalEvents[finalEvents.length - 1].id : null;
    const hasMore = startIndex + finalEvents.length < orderedEvents.length;

    return res.json({ success: true, count: events.length, events, nextCursor, hasMore });
  } catch (error) {
    console.error('[events/explore] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch explore events', error: error.message });
  }
});

// ── GET /api/events/my-schedule ─────────────────────────────────────────────
router.get('/my-schedule', async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const schedule = await ScheduleService.getStudentSchedule(req.user.id);
    
    // Pagination logic
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // default 20 items per page
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedSchedule = schedule.slice(startIndex, endIndex);
    const hasMore = endIndex < schedule.length;
    
    return res.json({ 
      success: true, 
      schedule: paginatedSchedule, 
      total: schedule.length,
      page,
      hasMore 
    });
  } catch (err) {
    console.error('[events/my-schedule] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/events/check-manager-availability ─────────────────────────────
router.post('/check-manager-availability', async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const { eventId, date, startTime, endTime, managerIds = [] } = req.body;
    const availability = await ManagerAvailabilityService.checkAvailability(eventId, date, startTime, endTime, managerIds);
    return res.json(availability);
  } catch (err) {
    console.error('[events/check-manager-availability] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/events/suggest-managers ───────────────────────────────────────
router.post('/suggest-managers', async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const { eventId, date, startTime, endTime, department = '', limit = 5, excludedIds = [] } = req.body;
    const suggestions = await ManagerRecommendationService.suggestManagers(eventId, date, startTime, endTime, department, limit, excludedIds);
    return res.json({ success: true, suggestions });
  } catch (err) {
    console.error('[events/suggest-managers] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/events/check-edit-impact & /:id/check-edit-impact ─────────────
const checkEditImpactHandler = async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const eventId = req.params.id || req.body.eventId || null;
    const { date, startTime, endTime, managers = [] } = req.body;
    
    // 1. Check registrations for this event — parallel overlap checks per student
    const affectedRegistrationConflicts = [];
    if (eventId) {
      const regSnap = await getDocs(query(collection(db, 'eventRegistrations'), where('eventId', '==', eventId)));
      const activeStatuses = ['REGISTERED', 'APPROVED', 'OD_APPROVED', 'ATTENDED'];

      // Collect all active registrations first
      const activeRegs = regSnap.docs
        .map(d => d.data())
        .filter(reg => activeStatuses.includes(reg.status) && (reg.userId || reg.studentId));

      // Fire all overlap checks in parallel instead of sequentially
      const overlapResults = await Promise.all(
        activeRegs.map(reg => {
          const studentId = String(reg.userId || reg.studentId);
          return ScheduleService.checkOverlap(studentId, date, startTime, endTime, eventId)
            .then(result => ({ reg, studentId, ...result }))
            .catch(() => ({ reg, studentId, hasConflict: false, conflicts: [] }));
        })
      );

      for (const { reg, studentId, hasConflict, conflicts } of overlapResults) {
        if (hasConflict) {
          affectedRegistrationConflicts.push({
            studentId,
            studentName: reg.userName || reg.name || 'Student',
            conflicts
          });
        }
      }
    }

    // 2. Check manager conflicts
    const affectedManagerConflicts = await ManagerAvailabilityService.findConflicts(eventId, date, startTime, endTime, managers);

    const totalAffected = affectedRegistrationConflicts.length + affectedManagerConflicts.length;
    return res.json({
      success: true,
      affectedStudentsCount: totalAffected,
      registrationConflictsCount: affectedRegistrationConflicts.length,
      managerConflictsCount: affectedManagerConflicts.length,
      details: {
        registrationConflicts: affectedRegistrationConflicts,
        managerConflicts: affectedManagerConflicts
      },
      summary: `${totalAffected} students affected -> ${affectedRegistrationConflicts.length} Registration Conflicts -> ${affectedManagerConflicts.length} Manager Conflicts`
    });
  } catch (err) {
    console.error('[events/check-edit-impact] Error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

router.post('/check-edit-impact', checkEditImpactHandler);
router.post('/:id/check-edit-impact', checkEditImpactHandler);

// ── GET /api/events/:id ─────────────────────────────────────────────────────
// Get a single event by ID
router.get('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const docSnap = await getDoc(doc(db, 'events', req.params.id));

    if (!docSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const data = docSnap.data();
    return res.json({ success: true, event: { id: docSnap.id, ...data, registrationStatus: computeRegistrationStatus(data) } });
  } catch (error) {
    console.error('[events/get] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch event', error: error.message });
  }
});

// ── PATCH /api/events/:id/status ───────────────────────────────────────────
// Advance or reject an event through the approval chain
// Auth: requireAuth — role & department come ONLY from the verified token.
const STATUS_ALLOWED_ROLES = ['FACULTY', 'HOD', 'IQAC_TEAM', 'SYSTEM_ADMIN'];
router.patch('/:id/status', requireRole(STATUS_ALLOWED_ROLES), async (req, res) => {
  if (!checkDb(res)) return;

  // ⚠️  Role and department are resolved from the verified session token, NOT req.body
  const actingRole = req.user.role;
  const actingDept = req.user.department;
  const actingName = req.user.name;

  let { status } = req.body; // Only status is read from body

  // SUBMIT VALIDATION: Managers must accept before submission
  if (['PENDING_FACULTY', 'PENDING_HOD'].includes(status)) {
    // Only fetch event if not already done. We do it below anyway, so let's move this check down.
  }

  const allowedStatuses = [
    'PENDING_MANAGERS',
    'PENDING_FACULTY',
    'PENDING_HOD',
    'PENDING_DEPARTMENTS',
    'PENDING_IQAC',
    'APPROVED',
    'POSTED',
    'REJECTED',
    'COMPLETED',
  ];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
    });
  }

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const rawEventData = eventSnap.data();

    // PENDING_MANAGERS gate: if patching to PENDING_MANAGERS and managers already accepted, auto-advance
    if (status === 'PENDING_MANAGERS' && rawEventData.managers && rawEventData.managers.length > 0) {
      const organizerEmail = rawEventData.organizer?.email || rawEventData.organizerEmail || '';
      const nonOrgManagers = rawEventData.managers.filter(m => m.email !== organizerEmail);
      const acceptedNonOrg = nonOrgManagers.filter(m => m.status === 'ACCEPTED');
      if (nonOrgManagers.length > 0 && acceptedNonOrg.length >= 1) {
        status = rawEventData.creatorType === 'FACULTY' ? 'PENDING_HOD' : 'PENDING_FACULTY';
      }
    }

    // SUBMIT VALIDATION: Wait for at least one non-organizer manager to accept
    if (['PENDING_FACULTY', 'PENDING_HOD'].includes(status) && rawEventData.managers && rawEventData.managers.length > 0) {
      const organizerEmail = rawEventData.organizer?.email || rawEventData.organizerEmail || '';
      const nonOrgManagers = rawEventData.managers.filter(m => m.email !== organizerEmail);
      const acceptedNonOrg = nonOrgManagers.filter(m => m.status === 'ACCEPTED');
      if (nonOrgManagers.length > 0 && acceptedNonOrg.length < 1) {
        status = 'PENDING_MANAGERS';
      }
    }

    if (status !== 'REJECTED') {
      const { parseEventStartDateTime } = require('../services/eventAutoRejectionService');
      const startDateTime = parseEventStartDateTime(rawEventData);
      if (startDateTime) {
        const nowMs = new Date().getTime();
        const startMs = startDateTime.getTime();
        const rejectAtMs = startMs - parseInt(process.env.AUTO_REJECT_BEFORE_START_MINUTES || '5', 10) * 60 * 1000;
        if (nowMs >= rejectAtMs) {
          const autoRejectionPayload = {
            status: 'REJECTED',
            updatedAt: new Date().toISOString(),
            autoRejectedAt: new Date().toISOString(),
            autoRejectedBy: 'SYSTEM',
            rejectionReason: `Automatically rejected: action attempted within 5 minutes of event start time.`,
          };
          await updateDoc(eventRef, autoRejectionPayload);

          if (rawEventData.organizerEmail) {
            // Try sending notification but don't fail if it doesn't work
            sendEventStatusNotification(
              rawEventData.organizerEmail,
              { id: eventSnap.id, ...rawEventData, ...autoRejectionPayload },
              'REJECTED'
            ).catch(err => console.error('[events/status] auto-reject email error:', err.message));
          }

          return res.status(400).json({
            success: false,
            message: 'Event has been auto-rejected because it is within 5 minutes of the start time.',
            event: { id: req.params.id, ...rawEventData, ...autoRejectionPayload }
          });
        }
      }
    }

    let finalStatus = status;
    const updatePayload = { status: finalStatus, updatedAt: new Date().toISOString() };
    
    if (finalStatus === 'COMPLETED') {
      updatePayload.needsFeedbackReminders = true;
    }
    
    // approvedBy is set from the verified token identity, not req.body
    const approvedBy = actingName || actingRole;
    updatePayload.approvedBy = approvedBy;

    if (finalStatus === 'REJECTED') {
      const reason = String(req.body.rejectionReason || '').trim();
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is mandatory.',
        });
      }

      // ⚠️ Role comes from token — cannot be spoofed via req.body
      const displayRole = actingRole;
      updatePayload.rejectionReason = reason;
      updatePayload.rejectedByRole = displayRole;
      updatePayload.rejectedByName = actingName || approvedBy || 'Unknown Approver';
      updatePayload.rejectedByDept = actingDept || rawEventData.department || 'N/A';
      updatePayload.rejectedAt = new Date().toISOString();
    }

    // Department isolation: FACULTY and HOD can only act on their own department's events
    if (['FACULTY', 'HOD'].includes(actingRole)) {
      if (!assertDeptMatch(req, rawEventData.department)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: You can only act on events from your department (${actingDept}).`,
        });
      }
    }

    // Workflow guard: enforce correct sequential approval order
    const VALID_TRANSITIONS = {
      FACULTY:    { from: 'PENDING_FACULTY',     to: ['PENDING_HOD', 'REJECTED'] },
      HOD:        { from: 'PENDING_HOD',         to: ['PENDING_DEPARTMENTS', 'REJECTED'] },
      IQAC_TEAM:  { from: 'PENDING_IQAC',        to: ['POSTED', 'REJECTED'] },
    };
    const trans = VALID_TRANSITIONS[actingRole];
    // Fix: use || so that either wrong current state OR wrong target status triggers the block
    if (trans && (rawEventData.status !== trans.from || !trans.to.includes(status))) {
      // Allow system admin to override
      if (actingRole !== 'SYSTEM_ADMIN') {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Event is in status "${rawEventData.status}" — ${actingRole} cannot transition to "${status}" from this state.`,
        });
      }
    }

    // Record timestamped approval for each stage
    const prevStatus = eventSnap.data().status;
    if (finalStatus === 'PENDING_HOD' && prevStatus === 'PENDING_FACULTY') {
      updatePayload.facultyApprovedAt = new Date().toISOString();
      updatePayload.facultyApprovedBy = approvedBy || 'Faculty';

      // Delay sending the poster request to Media until Class Advisor has approved it
      if (rawEventData.posterWorkflow) {
        if (rawEventData.posterWorkflow.status === 'PENDING_FACULTY') {
          updatePayload.posterWorkflow = {
            ...rawEventData.posterWorkflow,
            status: 'REQUESTED',
            requestedAt: new Date().toISOString()
          };
        } else if (rawEventData.posterWorkflow.status === 'PENDING_FACULTY_REVISION') {
          updatePayload.posterWorkflow = {
            ...rawEventData.posterWorkflow,
            status: 'REVISION_REQUIRED',
            requestedAt: new Date().toISOString()
          };
        }
      }
    }
    if (finalStatus === 'PENDING_DEPARTMENTS' && prevStatus === 'PENDING_HOD') {
      updatePayload.hodApprovedAt = new Date().toISOString();
      updatePayload.hodApprovedBy = approvedBy || 'HOD';

      // AUTO-ADVANCE: Skip PENDING_DEPARTMENTS and go to PENDING_IQAC if:
      // - No departments are required
      // - Event is a CANCEL modification request (no need to check venue availability)
      const requiredDepts = getRequiredDepartments(rawEventData);
      const isCancelModification = rawEventData.modificationRequest?.type === 'CANCEL';

      if (requiredDepts.length === 0 || isCancelModification) {
        console.log(`[events/status] Bypassing departments for event ${req.params.id}. Auto-advancing to PENDING_IQAC.`);
        finalStatus = 'PENDING_IQAC';
        updatePayload.status = finalStatus;
      }
    }
    if (finalStatus === 'POSTED' && prevStatus === 'PENDING_IQAC') {
      updatePayload.iqacApprovedAt = new Date().toISOString();
      updatePayload.iqacApprovedBy = approvedBy || 'IQAC';

      if (rawEventData.modificationRequest) {
        if (rawEventData.modificationRequest.type === 'CANCEL') {
          finalStatus = 'CANCELLED';
          updatePayload.status = finalStatus;
          updatePayload.cancelledBy = rawEventData.modificationRequest.requestedBy;
          updatePayload.cancelledAt = updatePayload.iqacApprovedAt;
          updatePayload.cancellationReason = rawEventData.modificationRequest.reason;

          const registeredStudents = rawEventData.registeredStudents || [];
          updatePayload.registeredStudents = registeredStudents.map(student => ({
            ...student,
            status: 'REGISTRATION_CANCELLED',
            cancelledReason: 'Event Cancelled'
          }));

          updatePayload.modificationRequest = deleteField();
        } else if (rawEventData.modificationRequest.type === 'POSTPONE') {
          finalStatus = 'POSTPONED';
          updatePayload.status = finalStatus;
          updatePayload.postponedBy = rawEventData.modificationRequest.requestedBy;
          updatePayload.postponedAt = updatePayload.iqacApprovedAt;
          updatePayload.postponementReason = rawEventData.modificationRequest.reason;

          const modReq = rawEventData.modificationRequest;
          updatePayload.oldDate = modReq.oldDate;
          updatePayload.newDate = modReq.newDate;
          updatePayload.oldStartTime = modReq.oldStartTime;
          updatePayload.newStartTime = modReq.newStartTime;
          updatePayload.oldEndTime = modReq.oldEndTime;
          updatePayload.newEndTime = modReq.newEndTime;
          updatePayload.date = modReq.newDate;
          updatePayload.startDate = modReq.newDate;
          updatePayload.endDate = modReq.newEndDate;
          updatePayload.startTime = modReq.newStartTime;
          updatePayload.endTime = modReq.newEndTime;

          if (rawEventData.requisition && rawEventData.requisition.step1) {
            const step1 = { 
              ...rawEventData.requisition.step1, 
              eventStartDate: modReq.newDate, 
              eventEndDate: modReq.newEndDate, 
              eventStartTime: modReq.newStartTime, 
              eventEndTime: modReq.newEndTime 
            };
            updatePayload.requisition = { ...rawEventData.requisition, step1 };
          }

          updatePayload.modificationRequest = deleteField();
        }
      }
    }

    // [MODULE 3] Atomic Write to events and eventApprovalLogs
    // [MODULE 7] Optmistic concurrency control using transactions
    const logRef = doc(collection(db, 'eventApprovalLogs'));
    const legacyAction = {
      status: finalStatus,
      approvedBy,
      role: actingRole,
      timestamp: new Date().toISOString(),
      remarks: finalStatus === 'REJECTED' ? updatePayload.rejectionReason : ''
    };
    updatePayload.eventActions = arrayUnion(legacyAction);

    try {
      await runTransaction(db, async (t) => {
        const snap = await t.get(eventRef);
        if (!snap.exists()) throw new Error('NOT_FOUND: Event not found');
        if (snap.data().status !== prevStatus) {
          throw new Error('CONFLICT: Event state was modified concurrently.');
        }

        t.update(eventRef, updatePayload);
        t.set(logRef, {
          eventId: req.params.id,
          action: finalStatus,
          approvedBy,
          role: actingRole,
          remarks: finalStatus === 'REJECTED' ? updatePayload.rejectionReason : '',
          timestamp: new Date().toISOString()
        });
      });
    } catch (txErr) {
      if (txErr.message.includes('CONFLICT')) {
        return res.status(409).json({ success: false, message: 'Conflict: This event was modified by someone else. Please refresh and try again.' });
      }
      throw txErr;
    }

    logActivity({
      category: 'EVENT',
      action: finalStatus === 'REJECTED' ? 'EVENT_REJECTED' : 'EVENT_APPROVED',
      status: 'SUCCESS',
      correlationId: req.params.id,
      requestId: crypto.randomUUID(),
      actor: {
        userId: req.user?.email || actingName || actingRole,
        name: actingName || 'Unknown Approver',
        role: actingRole
      },
      target: { entityType: 'EVENT', entityId: req.params.id },
      details: { previousStatus: prevStatus, newStatus: finalStatus }
    });

    const eventData = { id: req.params.id, ...eventSnap.data(), ...updatePayload };
    const notificationStatus = finalStatus; // Use the potentially advanced status for notifications

    // Cancel OD Requests if CANCELLED
    if (finalStatus === 'CANCELLED') {
      const odQuery = query(collection(db, 'odRequests'), where('eventId', '==', req.params.id));
      const odSnap = await getDocs(odQuery);
      if (!odSnap.empty) {
        let odBatch = writeBatch(db);
        let count = 0;
        for (const d of odSnap.docs) {
          odBatch.update(d.ref, {
            odStatus: 'CANCELLED',
            status: 'OD_CANCELLED',
            updatedAt: new Date().toISOString(),
            reason: 'Event Cancelled'
          });
          count++;
          if (count === 500) {
            await odBatch.commit();
            odBatch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await odBatch.commit();
        }
      }

      // Release booked venue on cancellation — idempotent, non-blocking failure
      try {
        const VenueAvailabilityService = require('../services/venueAvailabilityService');
        const venueId = rawEventData.venueId || rawEventData.requisition?.step1?.venueId || null;
        const venueResult = await VenueAvailabilityService.releaseBookedVenue(
          { eventId: req.params.id, venueId },
          {
            id: req.user.id, uid: req.user.id,
            name: actingName || req.user.email,
            role: actingRole,
            department: actingDept || rawEventData.department
          }
        );
        if (venueResult?.released) {
          logAudit({
            category: 'VENUE',
            action: 'VENUE_BOOKING_CANCELLED',
            status: 'SUCCESS',
            severity: 'HIGH',
            correlationId: req.params.id,
            requestId: crypto.randomUUID(),
            actor: {
              userId: req.user.id,
              name: actingName || req.user.email,
              role: actingRole,
              department: actingDept
            },
            target: {
              entityType: 'VENUE_RESERVATION',
              entityId: venueResult.reservationId || 'n/a',
              venueId: venueResult.venueId || venueId,
              eventId: req.params.id
            },
            details: {
              reason: 'Event Cancelled',
              cancellationReason: rawEventData.modificationRequest?.reason || updatePayload.cancellationReason || null
            },
            ipAddress: req.ip || (req.headers && req.headers['x-forwarded-for']) || null,
            userAgent: (req.headers && req.headers['user-agent']) || null
          }).catch(() => {});
        }
      } catch (venueErr) {
        console.warn('[events/status CANCELLED] Failed to release venue booking (non-blocking):', venueErr.message);
      }
    }

    // ── Background Notifications (centralized handler) ──────────────────────
    executeBackgroundNotification('events/status', async () => {
      if (finalStatus === 'CANCELLED') {
        await handleEventCancelled(eventData);
      } else if (finalStatus === 'POSTPONED') {
        await handleEventPostponed(eventData);
      } else {
        // Parallel execution: New EventBus Publisher
        if (notificationStatus.includes('APPROVED')) {
          eventPublisher.publishEventApproved({
            eventId: eventData.id,
            organizerId: eventData.createdBy || eventData.organizerId,
            actorId: getUserId(req), // The person approving
            eventTitle: eventData.title || eventData.eventName,
            approverRole: req.user?.role || 'SYSTEM',
            correlationId: crypto.randomUUID()
          });
        }
      }
    });


    return res.json({
      success: true,
      message: `Event status updated to ${status}`,
      event: eventData,
    });
  } catch (error) {
    console.error('[events/status] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update event status', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/department-approval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Approve a specific department requirement
// Body: { department: 'venue' | 'audio' | 'icts' | 'transport' | 'accommodation' | 'media', approvedBy: string }
// Auth: role comes from verified token — not req.body
const DEPT_APPROVAL_ROLES = ['HR_TEAM', 'AUDIO_TEAM', 'SYSTEM_ADMIN', 'TRANSPORT_TEAM', 'BOYS_WARDEN', 'GIRLS_WARDEN', 'MEDIA'];
router.patch('/:id/department-approval', requireRole(DEPT_APPROVAL_ROLES), async (req, res) => {
  if (!checkDb(res)) return;

  const { department, status = 'APPROVED', reason } = req.body;
  // approvedBy resolved from verified token — cannot be spoofed via req.body
  const approvedBy = req.user.name || req.user.role;

  if (!department) {
    return res.status(400).json({ success: false, message: 'Department is required' });
  }


  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const departmentApprovals = eventData.departmentApprovals || {};

    if (status === 'REJECTED') {
      const reasonStr = String(reason || '').trim();
      if (!reasonStr) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is mandatory.',
        });
      }

      departmentApprovals[department] = {
        status: 'REJECTED',
        rejectedBy: approvedBy,
        rejectedAt: new Date().toISOString(),
        reason: reasonStr,
      };

      // Determine clean role and department names for display
      let displayRole = 'Department Officer';
      let displayDept = department.toUpperCase();

      if (department === 'venue') {
        displayRole = 'HR';
        displayDept = 'Venue';
      } else if (department === 'media') {
        displayRole = 'HR';
        displayDept = 'Media';
      } else if (department === 'audio') {
        displayRole = 'Audio';
        displayDept = 'Audio';
      } else if (department === 'icts') {
        displayRole = 'ICTS';
        displayDept = 'ICTS';
      } else if (department === 'transport') {
        displayRole = 'Transport';
        displayDept = 'Transport';
      } else if (department === 'boysAccommodation') {
        displayRole = 'Warden';
        displayDept = 'Boys Hostel';
      } else if (department === 'girlsAccommodation') {
        displayRole = 'Warden';
        displayDept = 'Girls Hostel';
      }

      const updatePayload = {
        departmentApprovals,
        status: 'REJECTED',
        rejectionReason: reasonStr,
        rejectedByRole: displayRole,
        rejectedByName: approvedBy,
        rejectedByDept: displayDept,
        rejectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await updateDoc(eventRef, updatePayload);

      executeBackgroundNotification('events/dept-approval/reject', async () => {
        if (eventData.organizerEmail) {
          await sendEventStatusNotification(eventData.organizerEmail, { id: req.params.id, ...eventData, ...updatePayload }, 'REJECTED');
        }
      });

      return res.json({
        success: true,
        message: `${department} rejected successfully`,
        event: { id: req.params.id, ...eventData, ...updatePayload },
      });
    }

    departmentApprovals[department] = {
      status: 'APPROVED',
      approvedBy,
      approvedAt: new Date().toISOString(),
    };

    const updatePayload = { departmentApprovals, updatedAt: new Date().toISOString() };

    const requiredDepts = getRequiredDepartments(eventData);
    const allApproved = requiredDepts.every(dept => departmentApprovals[dept]?.status === 'APPROVED');

    if (allApproved && eventData.status === 'PENDING_DEPARTMENTS') {
      updatePayload.status = 'PENDING_IQAC';
      await updateDoc(eventRef, updatePayload);

      executeBackgroundNotification('events/dept-approval/iqac', async () => {
        await handleEventStatusChange({ id: req.params.id, lastApprovedDept: department, ...eventData, ...updatePayload }, 'PENDING_DEPARTMENTS', 'PENDING_IQAC');
      });
    } else {
      await updateDoc(eventRef, updatePayload);
 
      executeBackgroundNotification('events/dept-approval/intermediate', async () => {
        // Pass a pseudo-status 'DEPARTMENT_APPROVED' so the handler emails the organizer about this intermediate step
        await handleEventStatusChange({ id: req.params.id, lastApprovedDept: department, ...eventData, ...updatePayload }, eventData.status, 'DEPARTMENT_APPROVED');
      });
    }

    return res.json({
      success: true,
      message: `${department} approved successfully`,
      event: { id: req.params.id, ...eventData, ...updatePayload },
    });
  } catch (error) {
    console.error('[events/department-approval] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update department approval', error: error.message });
  }
});

// â”€â”€ PUT /api/events/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Full update of an event document
router.put('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const updatePayload = { ...req.body, updatedAt: new Date().toISOString() };
    
    if (updatePayload.managers && updatePayload.managers.length > 0) {
      try {
        const evDate = updatePayload.requisition?.step1?.eventStartDate || updatePayload.date || eventSnap.data().requisition?.step1?.eventStartDate || eventSnap.data().date;
        const evStartTime = updatePayload.requisition?.step1?.eventStartTime || updatePayload.startTime || eventSnap.data().requisition?.step1?.eventStartTime || eventSnap.data().startTime || '00:00';
        const evEndTime = updatePayload.requisition?.step1?.eventEndTime || updatePayload.endTime || eventSnap.data().requisition?.step1?.eventEndTime || eventSnap.data().endTime || '23:59';
        await ManagerAvailabilityService.validateManagerAssignments(req.params.id, evDate, evStartTime, evEndTime, updatePayload.managers, req.user);
      } catch (err) {
        if (err.status === 409 || (err.message && err.message.includes('CONFLICT'))) {
          return res.status(409).json({
            success: false,
            message: err.message.split(':')[1] || err.message,
            conflicts: err.conflicts || []
          });
        }
        throw err;
      }
    }

    if (updatePayload.managers) {
      updatePayload.managerIds = updatePayload.managers.map(m => m.userId || m.id).filter(Boolean);
    }

    await updateDoc(eventRef, updatePayload);

    if (updatePayload.managers) {
      const oldEventData = eventSnap.data();
      const oldManagers = oldEventData.managers || [];
      const oldStatus = oldEventData.status || '';
      const updatedEvent = { id: req.params.id, ...oldEventData, ...updatePayload };
      // Ensure new managers get PENDING status
      updatePayload.managers = updatePayload.managers.map(m => ({
        ...m,
        status: m.status || 'PENDING'
      }));
      executeBackgroundNotification('events/update', async () => {
        // If transitioning from DRAFT, treat ALL managers as new (notify everyone)
        const effectiveOldManagers = oldStatus === 'DRAFT' ? [] : oldManagers;
        await notifyManagersAssigned(updatedEvent, updatePayload.managers, effectiveOldManagers);
      });
    }

    return res.json({
      success: true,
      message: 'Event updated successfully',
      event: { id: req.params.id, ...eventSnap.data(), ...updatePayload },
    });
  } catch (error) {
    console.error('[events/update] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update event', error: error.message });
  }
});

// â”€â”€ PUT /api/events/:id/resubmit-edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Resubmit a rejected event
router.put('/:id/resubmit-edit', requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();

    // Ownership guard: only the original organizer can resubmit
    const isOwner = eventData.organizerId === req.user.id || eventData.organizer?.email === req.user.email;
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only resubmit your own events.' });
    }

    const newEventData = req.body;
    
    // Check if the acting user is a Faculty organizer (use their token role, not the stored creatorType)
    const isFacultyOrganizer = req.user.role === 'FACULTY';
    const hasMediaPoster = Boolean(eventData.posterDataUrl || eventData.posterUrl || eventData.posterStorage?.downloadURL || newEventData.posterStorage?.downloadURL);

    // ── Poster Resubmission Logic ──
    let posterWorkflow = newEventData.posterWorkflow || eventData.posterWorkflow || {};
    let posterStatus = newEventData.posterStatus || eventData.posterStatus || 'PENDING';

    if (posterWorkflow.requested || hasMediaPoster || eventData.departmentApprovals?.media) {
      if (posterWorkflow.requested) {
        if (posterStatus === 'UPLOADED' || posterStatus === 'COMPLETED' || posterWorkflow.status === 'UPLOADED' || posterWorkflow.status === 'COMPLETED') {
          posterStatus = isFacultyOrganizer ? 'REVISION_REQUIRED' : 'PENDING_FACULTY_REVISION';
          posterWorkflow.status = isFacultyOrganizer ? 'REVISION_REQUIRED' : 'PENDING_FACULTY_REVISION';
        } else {
          posterStatus = isFacultyOrganizer ? 'REQUESTED' : 'PENDING_FACULTY';
          posterWorkflow.status = isFacultyOrganizer ? 'REQUESTED' : 'PENDING_FACULTY';
        }
      }
    }

    // Reset all approvals upon resubmission
    const newDeptApprovals = {};

    const isDraft = req.body.status === 'DRAFT';

    const updatePayload = {
      ...req.body,
      status: isDraft ? 'DRAFT' : 'PENDING_MANAGERS',
      isResubmitted: !isDraft,
      updatedAt: new Date().toISOString(),
      posterStatus,
      posterWorkflow,

      // Clear all stage approvals
      approvedBy: null,
      rejectionReason: null,
      rejectedByRole: null,
      rejectedByName: null,
      rejectedByDept: null,
      rejectedAt: null,

      facultyApprovedAt: null,
      facultyApprovedBy: null,
      hodApprovedAt: null,
      hodApprovedBy: null,
      iqacApprovedAt: null,
      iqacApprovedBy: null,

      // Reset department approvals (except media if poster exists)
      departmentApprovals: newDeptApprovals,
      managerIds: req.body.managers ? req.body.managers.map(m => m.userId || m.id).filter(Boolean) : []
    };

    if (updatePayload.managers && updatePayload.managers.length > 0) {
      // Preserve accepted managers' status; set PENDING for new ones
      updatePayload.managers = updatePayload.managers.map(m => ({
        ...m,
        status: m.status || 'PENDING'
      }));
      // Validate manager schedule conflicts
      try {
        const evDate = updatePayload.requisition?.step1?.eventStartDate || updatePayload.date || eventData.requisition?.step1?.eventStartDate || eventData.date;
        const evStartTime = updatePayload.requisition?.step1?.eventStartTime || updatePayload.startTime || eventData.startTime || '00:00';
        const evEndTime = updatePayload.requisition?.step1?.eventEndTime || updatePayload.endTime || eventData.endTime || '23:59';
        await ManagerAvailabilityService.validateManagerAssignments(req.params.id, evDate, evStartTime, evEndTime, updatePayload.managers, req.user);
      } catch (err) {
        if (err.status === 409 || (err.message && err.message.includes('CONFLICT'))) {
          return res.status(409).json({ success: false, message: err.message.split(':')[1] || err.message, conflicts: err.conflicts || [] });
        }
        throw err;
      }
    }

    // ── Venue Transition: release OLD booking + consume NEW HOLD (if provided) ──
    const VenueAvailabilityService = require('../services/venueAvailabilityService');
    const { logAudit: logAudit2 } = require('../utils/logger');
    const actingRole = req.user.role || (req.user.roles && req.user.roles[0]) || 'USER';
    const actingName = req.user.name || req.user.email;
    const actingDept = req.user.department || eventData.department;

    const oldReservationId = eventData.reservationId || eventData.venueReservationId || null;
    const newReservationIdRaw = updatePayload.reservationId || updatePayload.venueReservationId || null;
    const newReservationId = newReservationIdRaw && String(newReservationIdRaw).trim() ? String(newReservationIdRaw).trim() : null;
    const oldVenueId = eventData.venueId || eventData.requisition?.step1?.venueId || null;
    const newVenueId = updatePayload.venueId || updatePayload.requisition?.step1?.venueId || null;
    const venueChanged = (newVenueId && newVenueId !== oldVenueId) || (newReservationId && newReservationId !== oldReservationId);

    if (!isDraft && (newReservationId || venueChanged)) {
      // ── Stage 1: atomic HELD→BOOKED + event update transaction ──
      await runTransaction(db, async (transaction) => {
        if (newReservationId && newReservationId !== oldReservationId) {
          await VenueAvailabilityService.consumeReservation(newReservationId, {
            t: transaction,
            eventId: req.params.id,
            userId: req.user.id,
            userName: actingName,
            bookedBy: { uid: req.user.id, name: actingName, role: actingRole }
          });
        }

        transaction.update(eventRef, updatePayload);

        if (newReservationId) {
          transaction.set(doc(db, 'venueReservations', newReservationId), {
            eventId: req.params.id,
            eventName: updatePayload.title || updatePayload.eventName || eventData.title || null,
            eventDepartment: updatePayload.department || eventData.department || null,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      });

      // ── Stage 2: non-blocking release of the old venue (if changed) ──
      if (venueChanged && (oldReservationId || (oldVenueId && newVenueId !== oldVenueId))) {
        try {
          const releaseKeys = { eventId: req.params.id, skipReservationId: newReservationId || null };
          if (oldReservationId) {
            releaseKeys.reservationId = oldReservationId;
          } else {
            releaseKeys.venueId = oldVenueId;
          }
          const venueResult = await VenueAvailabilityService.releaseBookedVenue(
            releaseKeys,
            {
              id: req.user.id, uid: req.user.id,
              name: actingName,
              role: actingRole,
              department: actingDept
            }
          );
          if (venueResult?.released) {
            logAudit2({
              category: 'VENUE',
              action: 'VENUE_BOOKING_CANCELLED',
              status: 'SUCCESS',
              severity: 'HIGH',
              correlationId: req.params.id,
              requestId: crypto.randomUUID(),
              actor: {
                userId: req.user.id,
                name: actingName,
                role: actingRole,
                department: actingDept
              },
              target: {
                entityType: 'VENUE_RESERVATION',
                entityId: venueResult.reservationId || oldReservationId || 'n/a',
                venueId: venueResult.venueId || oldVenueId,
                eventId: req.params.id
              },
              details: {
                reason: 'Resubmission – Venue Changed',
                oldVenueId,
                newVenueId,
                oldReservationId,
                newReservationId
              },
              ipAddress: req.ip || (req.headers && req.headers['x-forwarded-for']) || null,
              userAgent: (req.headers && req.headers['user-agent']) || null
            }).catch(() => {});
          }
        } catch (venueErr) {
          console.warn('[events/resubmit-edit] Failed to release old venue booking (non-blocking):', venueErr.message);
        }
      }

      // ── Stage 3: audit log for NEW venue booking (consumed) ──
      if (newReservationId && newReservationId !== oldReservationId) {
        try {
          const eventDate = updatePayload.requisition?.step1?.eventStartDate || updatePayload.date || eventData.date;
          const eventStartTime = updatePayload.requisition?.step1?.eventStartTime || updatePayload.startTime || eventData.startTime;
          const eventEndTime = updatePayload.requisition?.step1?.eventEndTime || updatePayload.endTime || eventData.endTime;
          await logAudit2({
            category: 'VENUE',
            action: 'VENUE_BOOKED',
            status: 'SUCCESS',
            severity: 'HIGH',
            correlationId: req.params.id,
            requestId: crypto.randomUUID(),
            actor: { userId: req.user.id, name: actingName, role: actingRole, department: actingDept },
            target: { entityType: 'VENUE_RESERVATION', entityId: newReservationId, venueId: newVenueId, eventId: req.params.id },
            details: {
              date: eventDate,
              startTime: eventStartTime,
              endTime: eventEndTime,
              reservationId: newReservationId,
              eventId: req.params.id,
              resubmission: true,
              oldReservationId
            },
            ipAddress: req.ip || (req.headers && req.headers['x-forwarded-for']) || null,
            userAgent: (req.headers && req.headers['user-agent']) || null
          });
        } catch (auditErr) {
          console.warn('[events/resubmit-edit] Failed to write venue booked audit log:', auditErr.message);
        }
      }
    } else {
      // Draft or no venue change: simple update
      await updateDoc(eventRef, updatePayload);
    }

    // After resubmitting, notify the faculty in the background
    if (!isDraft) {
      executeBackgroundNotification('events/resubmit-edit', async () => {
        const payloadWithId = { id: req.params.id, ...updatePayload };
        let facultyEmail = updatePayload.coordinator?.facultyEmail || updatePayload.coordinator?.faculty_email || updatePayload.facultyEmail || null;
        if (typeof facultyEmail === 'string') facultyEmail = facultyEmail.trim().toLowerCase();

        if (!facultyEmail && updatePayload.coordinator?.facultyName) {
          facultyEmail = await getFacultyEmailByName(String(updatePayload.coordinator.facultyName).trim());
        }

        if (facultyEmail) {
          await sendEventNotificationToFaculty(payloadWithId, facultyEmail);
        }

        // Notify all managers (pass empty oldManagers so ALL managers get notified on (re)submit)
        if (updatePayload.managers && updatePayload.managers.length > 0) {
          await notifyManagersAssigned(payloadWithId, updatePayload.managers, []);
        }
      });
    }

    return res.json({
      success: true,
      message: 'Event resubmitted successfully',
      event: { id: req.params.id, ...eventSnap.data(), ...updatePayload },
    });
  } catch (error) {
    console.error('[events/resubmit-edit] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resubmit event', error: error.message });
  }
});

// ─── POST /api/events/:id/register ───────────────────────────────────────────
// A student registers for an event — adds them to the registeredStudents array
router.post('/:id/register', async (req, res) => {
  if (!checkDb(res)) return;  // checkDb returns false when db is ready

  try {
    const { userId, userName, userEmail, userDepartment, userYear, rollNo, userClass } = req.body;

    if (!userId || !userName) {
      return res.status(400).json({ success: false, message: 'userId and userName are required' });
    }

    const eventRef = doc(db, 'events', req.params.id);
    const registrationId = `${req.params.id}_${userId}`;
    const registrationRef = doc(db, 'eventRegistrations', registrationId);

    const newEntry = {
      eventId: req.params.id,
      studentId: userId,
      userId,
      userName,
      userEmail: userEmail || '',
      userDepartment: userDepartment || '',
      userYear: userYear || '',
      rollNo: rollNo || '',
      userClass: userClass || '',
      status: 'PENDING',
      registrationStatus: 'PENDING',
      registeredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let eventData;

    await runTransaction(db, async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists()) {
        throw new Error('NOT_FOUND:Event not found');
      }

      eventData = eventSnap.data();
      const regMeta = getRegistrationMeta(eventData);

      if (eventData.status !== 'POSTED') {
        throw new Error('BAD_REQUEST:Cannot register for an event that is not approved and posted.');
      }

      // Prevent organizers from registering for their own event
      if (String(eventData.organizerId) === String(userId) || (eventData.organizerEmail && userEmail && eventData.organizerEmail.toLowerCase() === userEmail.toLowerCase())) {
        throw new Error('BAD_REQUEST:Organizers cannot register for their own events.');
      }

      if (!regMeta.enabled) {
        throw new Error('BAD_REQUEST:Registration is not enabled for this event.');
      }
      if (regMeta.status === 'FINALIZED') {
        throw new Error('BAD_REQUEST:Registration has been finalized and is now closed.');
      }
      if (regMeta.status === 'CLOSED') {
        throw new Error('BAD_REQUEST:Registration is closed. The deadline has passed.');
      }
      if (regMeta.opensAt && Date.now() < new Date(regMeta.opensAt).getTime()) {
        throw new Error('BAD_REQUEST:Registration is not open yet.');
      }

      const startDateStr = eventData.requisition?.step1?.eventStartDate || eventData.date;
      const startTimeStr = eventData.requisition?.step1?.eventStartTime || eventData.startTime || '00:00';
      let eventStartTimestamp = null;
      try {
        if (startDateStr) {
          const sDP = startDateStr.split('-');
          const sTP = startTimeStr.split(':');
          eventStartTimestamp = new Date(parseInt(sDP[0]), parseInt(sDP[1]) - 1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1])).getTime();
        }
      } catch (err) {}

      const effectiveDeadlineTimestamp = regMeta.currentDeadline ? new Date(regMeta.currentDeadline).getTime() : eventStartTimestamp;

      if (eventStartTimestamp && Date.now() >= eventStartTimestamp - 30 * 60 * 1000) {
        throw new Error('BAD_REQUEST:Registration is closed. Registrations automatically close 30 minutes before the event starts.');
      }

      if (effectiveDeadlineTimestamp && Date.now() >= effectiveDeadlineTimestamp) {
        throw new Error('BAD_REQUEST:Registration is closed. The deadline has passed.');
      } else if (!effectiveDeadlineTimestamp && startDateStr) {
        const today = new Date().toISOString().split('T')[0];
        if (startDateStr < today) {
          throw new Error('BAD_REQUEST:Registration is closed. The deadline has passed.');
        }
      }

      // Check capacity
      const stats = eventData.stats || {};
      const currentRegisteredCount = stats.registeredCount || 0;
      const maxParticipants = regMeta.maxParticipants || eventData.capacity;
      if (maxParticipants && currentRegisteredCount >= maxParticipants) {
        throw new Error('BAD_REQUEST:Registration is closed. Maximum capacity reached.');
      }

      // Backward compat: legacy requiresRegistrationApproval still honored (but all are PENDING now)
      if (eventData.requiresRegistrationApproval) {
        newEntry.status = 'PENDING';
        newEntry.registrationStatus = 'PENDING';
      }

      const regSnap = await transaction.get(registrationRef);
      if (regSnap.exists()) {
        throw new Error('CONFLICT:Already registered for this event');
      }

      // [LEGACY COMPATIBILITY - REMOVE LATER]
      const registeredStudents = eventData.registeredStudents || [];
      if (registeredStudents.some(s => s.userId === userId)) {
        throw new Error('CONFLICT:Already registered for this event');
      }

      const endTimeStr = eventData.requisition?.step1?.eventEndTime || eventData.endTime || '23:59';
      await RegistrationConflictService.validateRegistration(userId, req.params.id, startDateStr, startTimeStr, endTimeStr, userName);
      
      const updatedList = [...registeredStudents, newEntry];
      const newStats = {
        ...stats,
        registeredCount: (stats.registeredCount || 0) + 1
      };

      // 1. Create root collection doc
      transaction.set(registrationRef, newEntry);
      
      // 2. Update events document (stats + dual-write legacy)
      transaction.update(eventRef, {
        registeredStudents: updatedList, // [LEGACY COMPATIBILITY - REMOVE LATER]
        stats: newStats,
        updatedAt: new Date().toISOString(),
      });
    });

    // ── Background Notifications (centralized handler) ─────────────────
    eventPublisher.publishRegistrationSubmitted({
      registrationId: `${req.params.id}_${userId}`,
      studentId: userId,
      studentName: req.user?.name || req.user?.displayName || req.body?.name || 'Unknown Student',
      organizerIds: eventData.organizerId ? [eventData.organizerId] : (eventData.createdBy ? [eventData.createdBy] : []),
      eventId: req.params.id,
      eventTitle: eventData.title || eventData.eventName,
      correlationId: crypto.randomUUID()
    });

    return res.status(201).json({ success: true, message: 'Registered successfully', entry: newEntry });
  } catch (error) {
    if (error.message.includes('NOT_FOUND')) return res.status(404).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('BAD_REQUEST')) return res.status(400).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('CONFLICT')) return res.status(409).json({ success: false, message: error.message.split(':')[1], conflicts: error.conflicts || [] });
    
    console.error('[events/register] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to register', error: error.message });
  }
});

// ─── PATCH /api/events/:id/registrations/:userId/status ──────────────────────
// Organizer or Faculty approves/rejects a pending registration
router.patch('/:id/registrations/:userId/status', requireRole(['STUDENT_ORGANIZER', 'FACULTY', 'HOD']), async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'WAITLISTED', 'REGISTERED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const eventId = req.params.id;
    const studentId = req.params.userId;
    const eventRef = doc(db, 'events', eventId);
    const registrationId = `${eventId}_${studentId}`;
    const registrationRef = doc(db, 'eventRegistrations', registrationId);

    await runTransaction(db, async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists()) {
        throw new Error('NOT_FOUND:Event not found');
      }

      const eventData = eventSnap.data();
      const regMeta = getRegistrationMeta(eventData);

      // Cannot change individual registration statuses once finalized
      if (regMeta.status === 'FINALIZED') {
        throw new Error('BAD_REQUEST:Registration has been finalized. No further changes allowed.');
      }

      // Authorization Check
      const actingRole = req.user.role;
      const actingDept = req.user.department;
      
      let isAuthorized = false;
      if (actingRole === 'STUDENT_ORGANIZER') {
        if (eventData.organizerId === req.user.id) isAuthorized = true;
      } else if (['FACULTY', 'HOD'].includes(actingRole)) {
        if (actingDept.toUpperCase() === (eventData.department || '').toUpperCase()) isAuthorized = true;
      } else if (['IQAC_TEAM', 'SYSTEM_ADMIN'].includes(actingRole)) {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        throw new Error('FORBIDDEN:You do not have permission to modify registrations for this event.');
      }

      const regSnap = await transaction.get(registrationRef);
      if (!regSnap.exists()) {
        throw new Error('NOT_FOUND:Registration not found');
      }
      
      const regData = regSnap.data();

      if (regData.status === status) {
        throw new Error(`NO_OP:Already ${status}`);
      }

      // Allow transition from legacy PENDING_APPROVAL or current PENDING or any status
      const allowedFromLegacy = ['PENDING', 'PENDING_APPROVAL', 'REGISTERED', 'REJECTED', 'WAITLISTED'];
      if (!allowedFromLegacy.includes(regData.status) && regData.registrationStatus !== 'PENDING_APPROVAL') {
        if (status !== 'PENDING' && status !== 'REGISTERED') {
          // Still allow it — more permissive for backward compat — just record reviewedAt
        }
      }

      // Calculate scheduled notification time (30 mins before event start) — reminder only sent for APPROVED later
      const startDateStr = eventData.requisition?.step1?.eventStartDate || eventData.date;
      const startTimeStr = eventData.requisition?.step1?.eventStartTime || eventData.startTime || '00:00';
      let eventStartTimestamp = 0;
      try {
        if (startDateStr) {
          const sDP = startDateStr.split('-');
          const sTP = startTimeStr.split(':');
          eventStartTimestamp = new Date(parseInt(sDP[0]), parseInt(sDP[1]) - 1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1])).getTime();
        }
      } catch (err) {}
      const scheduledAt = eventStartTimestamp ? new Date(eventStartTimestamp - 30 * 60 * 1000).toISOString() : new Date(Date.now() + 30 * 60 * 1000).toISOString();

      // Update registration document
      const normalisedStatus = status === 'REGISTERED' ? 'APPROVED' : status;
      transaction.update(registrationRef, {
        status: normalisedStatus,
        registrationStatus: normalisedStatus,
        notificationPending: normalisedStatus === 'APPROVED' ? true : (regData.notificationPending || false),
        notificationSent: false,
        notificationScheduledAt: scheduledAt,
        eventId: eventId,
        studentId: studentId,
        updatedAt: new Date().toISOString(),
        reviewedBy: req.user.id,
        reviewedByName: req.user.name || req.user.email,
        reviewedByRole: actingRole,
        reviewedAt: new Date().toISOString()
      });

      // Maintain legacy array sync
      const registeredStudents = eventData.registeredStudents || [];
      const updatedList = registeredStudents.map(s => s.userId === studentId ? { ...s, status: normalisedStatus } : s);
      transaction.update(eventRef, {
        registeredStudents: updatedList,
        updatedAt: new Date().toISOString()
      });
    });

    // Generate audit log for the approval action
    await logAudit({
      category: 'REGISTRATION',
      action: status === 'REJECTED' ? 'REGISTRATION_REJECTED' : (status === 'WAITLISTED' ? 'REGISTRATION_WAITLISTED' : 'REGISTRATION_APPROVED'),
      status: 'SUCCESS',
      severity: 'INFO',
      actor: {
        userId: req.user.id,
        name: req.user.name || req.user.email,
        role: req.user.role,
        department: req.user.department
      },
      target: { entityType: 'REGISTRATION', entityId: studentId },
      correlationId: eventId,
      requestId: crypto.randomUUID(),
      details: {
        registrationId,
        previousStatus: 'PENDING/PENDING_APPROVAL',
        newStatus: status === 'REGISTERED' ? 'APPROVED' : status
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null
    });

    return res.status(200).json({ success: true, message: `Registration successfully updated to ${status}` });

  } catch (error) {
    if (error.message.includes('NO_OP')) return res.status(200).json({ success: true, message: error.message.split(':')[1] });
    if (error.message.includes('NOT_FOUND')) return res.status(404).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('BAD_REQUEST')) return res.status(400).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('FORBIDDEN')) return res.status(403).json({ success: false, message: error.message.split(':')[1] });
    
    console.error('[events/registrations/status] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update registration status', error: error.message });
  }
});

// â”€â”€ POST /api/events/:id/withdraw â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// A student withdraws their registration â€” removes them from registeredStudents
router.post('/:id/withdraw', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const eventRef = doc(db, 'events', req.params.id);
    const registrationId = `${req.params.id}_${userId}`;
    const registrationRef = doc(db, 'eventRegistrations', registrationId);

    await runTransaction(db, async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists()) {
        throw new Error('NOT_FOUND:Event not found');
      }

      const regSnap = await transaction.get(registrationRef);
      const isNewArchitectureRegistered = regSnap.exists() && regSnap.data().status === 'REGISTERED';
      
      const eventData = eventSnap.data();
      const registeredStudents = eventData.registeredStudents || [];
      const isLegacyRegistered = registeredStudents.some(s => s.userId === userId);

      if (!isNewArchitectureRegistered && !isLegacyRegistered) {
         // Idempotency: already withdrawn or never registered
         return;
      }

      const updatedList = registeredStudents.filter(s => s.userId !== userId);
      
      const stats = eventData.stats || {};
      const currentCount = stats.registeredCount || 0;
      const newStats = {
        ...stats,
        // Only decrement if we are actually removing them from new architecture OR if legacy list was shortened
        registeredCount: Math.max(0, currentCount - 1)
      };

      if (regSnap.exists()) {
         transaction.update(registrationRef, { status: 'WITHDRAWN', updatedAt: new Date().toISOString() });
      }

      transaction.update(eventRef, {
        registeredStudents: updatedList, // [LEGACY COMPATIBILITY - REMOVE LATER]
        stats: newStats,
        updatedAt: new Date().toISOString(),
      });
    });

    // ── Background Notifications (centralized handler) ─────────────────
    eventPublisher.publishRegistrationCancelled({
      registrationId: `${req.params.id}_${userId}`,
      studentId: userId,
      studentName: req.user?.name || req.user?.displayName || 'Student',
      organizerIds: eventData.organizerId ? [eventData.organizerId] : (eventData.createdBy ? [eventData.createdBy] : []),
      eventId: req.params.id,
      eventTitle: eventData.title || eventData.eventName,
      correlationId: crypto.randomUUID()
    });

    return res.json({ success: true, message: 'Withdrawn successfully' });
  } catch (error) {
    if (error.message.includes('NOT_FOUND')) return res.status(404).json({ success: false, message: error.message.split(':')[1] });
    
    console.error('[events/withdraw] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to withdraw', error: error.message });
  }
});

// ————————————————————————————————————————————
router.delete('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();

    // Only allow deletion before any approval has been granted
    const PRE_APPROVAL_STATUSES = ['DRAFT', 'PENDING_MANAGERS', 'PENDING_FACULTY', 'PENDING_HOD'];
    if (!PRE_APPROVAL_STATUSES.includes(eventData.status)) {
      return res.status(403).json({
        success: false,
        message: `Cannot delete an event with status "${eventData.status}". Events can only be deleted before any approval.`
      });
    }

    // Only the organizer (or admin) can delete
    if (eventData.organizerId !== req.user.id && req.user.role !== 'IQAC_TEAM' && req.user.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only the event organizer can delete this event.' });
    }

    // Delete associated OD requests to prevent orphans
    const odQuery = query(collection(db, 'odRequests'), where('eventId', '==', req.params.id));
    const odSnap = await getDocs(odQuery);
    const deleteODPromises = odSnap.docs.map(d => deleteDoc(d.ref));

    // Delete associated Correction requests to prevent orphans
    const correctionQuery = query(collection(db, 'correctionRequests'), where('eventId', '==', req.params.id));
    const correctionSnap = await getDocs(correctionQuery);
    const deleteCorrectionPromises = correctionSnap.docs.map(d => deleteDoc(d.ref));

    await Promise.all([...deleteODPromises, ...deleteCorrectionPromises]);
    await deleteDoc(eventRef);

    // Clean up Firebase Storage files associated with this event
    await deleteStorageFolder(`events/${req.params.id}`);

    // Release booked venue (best effort, non-blocking)
    try {
      const VenueAvailabilityService = require('../services/venueAvailabilityService');
      const venueId = eventData.venueId || eventData.requisition?.step1?.venueId || null;
      await VenueAvailabilityService.releaseBookedVenue(
        { eventId: req.params.id, venueId },
        {
          id: req.user.id, uid: req.user.id,
          name: req.user.name || req.user.email,
          role: req.user.role,
          department: req.user.department
        }
      );
    } catch (venueErr) {
      console.warn('[events/delete] Failed to release venue booking (non-blocking):', venueErr.message);
    }

    return res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('[events/delete] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete event', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/poster â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Update just the poster data of an event
router.patch('/:id/poster', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const { posterDataUrl, posterFileName, posterMimeType, updatedBy, action } = req.body;

    const now = new Date().toISOString();
    let updatePayload = {};
    let isMediaUpload = false;
    const currentWorkflow = eventData.posterWorkflow || {};

    if (action === 'remove') {
      updatePayload = {
        posterDataUrl: null,
        posterFileName: null,
        posterMimeType: null,
        posterStorage: null,
        updatedAt: now,
        posterStatus: 'PENDING'
      };
      
      if (currentWorkflow.requested) {
        updatePayload.posterWorkflow = {
          ...currentWorkflow,
          status: 'REQUESTED' // Revert to requested
        };
      }
    } else {
      const { posterStorage } = req.body;
      if (!posterDataUrl && !posterStorage) {
        return res.status(400).json({ success: false, message: 'Poster data or storage metadata is required' });
      }

      updatePayload = {
        posterDataUrl: posterDataUrl || null,
        posterStorage: posterStorage || null,
        posterFileName,
        posterMimeType,
        updatedAt: now,
        posterUploadedAt: now,
        posterStatus: 'UPLOADED'
      };

      if (updatedBy) {
        updatePayload.posterUpdatedBy = updatedBy;
        updatePayload.posterUploadedBy = updatedBy;
      }

      // If a poster was requested from media team, update the workflow to reflect completion
      if (currentWorkflow.requested) {
        isMediaUpload = true;
        updatePayload.posterWorkflow = {
          ...currentWorkflow,
          status: 'UPLOADED',
          finalUploadedAt: now,
          finalUploadedBy: updatedBy || 'Media Team'
        };
      }
    }

    await updateDoc(eventRef, updatePayload);

    // Send notification if this was a requested media poster upload
    if (isMediaUpload && eventData.organizerEmail) {
      console.log(`[LEGACY_DISABLED] Poster ready email to organizer disabled per 23-template whitelist (In-App only).`);
    }

    return res.json({
      success: true,
      message: 'Poster uploaded successfully'
    });
  } catch (error) {
    console.error('[events/poster] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload poster', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/poster-workflow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Update just the poster workflow sub-object of an event
router.patch('/:id/poster-workflow', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const currentWorkflow = eventData.posterWorkflow || {};

    const updates = req.body;
    const { updatedBy, ...workflowFields } = updates;

    const newWorkflow = {
      ...currentWorkflow,
      ...workflowFields,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: updatedBy || 'Unknown User'
    };

    await updateDoc(eventRef, {
      posterWorkflow: newWorkflow,
      updatedAt: new Date().toISOString()
    });

    const refreshedData = { id: req.params.id, ...eventData, posterWorkflow: newWorkflow };

    // Trigger emails for specific steps in the workflow
    if ((updates.status === 'SENT_TO_ORGANIZER' || updates.status === 'COMPLETED') && eventData.organizerEmail) {
      console.log(`[LEGACY_DISABLED] Poster ready workflow email to organizer disabled per 23-template whitelist (In-App only).`);
    }

    return res.json({
      success: true,
      message: 'Poster workflow updated',
      posterWorkflow: newWorkflow
    });
  } catch (error) {
    console.error('[events/poster-workflow] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update poster workflow', error: error.message });
  }
});

// â”€â”€ POST /api/events/test-email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Test endpoint to verify email configuration
router.post('/test-email', async (req, res) => {
  const { emailAddress } = req.body;

  if (!emailAddress) {
    return res.status(400).json({
      success: false,
      message: 'Email address is required',
    });
  }

  try {
    const testEventData = {
      title: 'Test Event',
      description: 'This is a test email to verify SMTP configuration.',
      eventType: 'Test',
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '12:00',
      venue: 'Test Venue',
      organizerName: 'Test Organizer',
      organizingDepartment: 'CSE',
    };

    const emailResult = await sendEventNotificationToFaculty(testEventData, emailAddress);

    if (emailResult.success) {
      return res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: emailResult.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: emailResult.error,
      });
    }
  } catch (error) {
    console.error('[events/test-email] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message,
    });
  }
});

// â”€â”€ GET /api/events/coordinators/list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Get all faculty coordinators
router.get('/coordinators/list', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const snapshot = await getDocs(collection(db, 'coordinators'));
    const coordinators = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    return res.json({
      success: true,
      count: coordinators.length,
      coordinators,
    });
  } catch (error) {
    console.error('[events/coordinators/list] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch coordinators',
      error: error.message,
    });
  }
});

// â”€â”€ POST /api/events/coordinators/add â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Add a new faculty coordinator
// Body: { name: string, email: string, department?: string }
router.post('/coordinators/add', async (req, res) => {
  if (!checkDb(res)) return;

  const { name, email, department } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Faculty name and email are required',
    });
  }

  try {
    const coordinatorData = {
      name,
      email,
      department: department || 'CSE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'coordinators'), coordinatorData);

    return res.status(201).json({
      success: true,
      message: 'Coordinator added successfully',
      coordinator: { id: docRef.id, ...coordinatorData },
    });
  } catch (error) {
    console.error('[events/coordinators/add] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add coordinator',
      error: error.message,
    });
  }
});

// â”€â”€ DELETE /api/events/coordinators/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Delete a faculty coordinator
router.delete('/coordinators/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const coordinatorRef = doc(db, 'coordinators', req.params.id);
    const coordinatorSnap = await getDoc(coordinatorRef);

    if (!coordinatorSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Coordinator not found',
      });
    }

    await deleteDoc(coordinatorRef);

    return res.json({
      success: true,
      message: 'Coordinator deleted successfully',
    });
  } catch (error) {
    console.error('[events/coordinators/delete] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete coordinator',
      error: error.message,
    });
  }
});

// â”€â”€ PATCH /api/events/:id/request-iqac-extension â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Organizer requests an extension for IQAC submission with a reason
router.patch('/:id/request-iqac-extension', async (req, res) => {
  if (!checkDb(res)) return;
  const { reason, requestedBy } = req.body;
  if (!reason || !requestedBy) {
    return res.status(400).json({ success: false, message: 'Reason and requestedBy are required' });
  }
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();

    const iqacExtensionRequest = {
      reason,
      requestedBy,
      requestedAt: new Date().toISOString(),
      status: 'PENDING'
    };
    const updatePayload = { iqacExtensionRequest, updatedAt: new Date().toISOString() };
    await updateDoc(eventRef, updatePayload);

    (async () => {
      try {
        const hodEmails = await getOfficialEmailsByRole('HOD');
        if (hodEmails.length > 0) {
          Promise.allSettled(hodEmails.map(email =>
            sendIQACExtensionRequestEmail(email, { id: req.params.id, ...eventData }, reason)
          )).catch(e => console.error('[events/request-iqac-extension/bg] Error:', e.message));
        }
      } catch (err) {
        console.error('[events/request-iqac-extension/bg] background err:', err.message);
      }
    })();

    return res.json({ success: true, message: 'IQAC extension requested successfully', event: { id: req.params.id, ...eventData, ...updatePayload } });
  } catch (error) {
    console.error('[events/request-iqac-extension] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to request extension', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/approve-iqac-extension â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HOD approves an IQAC extension request with a specific end date
router.patch('/:id/approve-iqac-extension', async (req, res) => {
  if (!checkDb(res)) return;
  const { endDate, approvedBy } = req.body;
  if (!endDate || !approvedBy) {
    return res.status(400).json({ success: false, message: 'End date and approvedBy (HOD name) are required' });
  }
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();
    const updatePayload = {
      iqacWindowExtended: true,
      iqacWindowExtendedAt: new Date().toISOString(),
      iqacWindowExtendedBy: approvedBy,
      iqacExtensionEndDate: endDate,
      'iqacExtensionRequest.status': 'APPROVED',
      updatedAt: new Date().toISOString()
    };
    await updateDoc(eventRef, updatePayload);

    executeBackgroundNotification('events/approve-iqac-extension', async () => {
      if (eventData.organizerEmail) {
        await sendIQACExtensionStatusEmail(eventData.organizerEmail, { id: req.params.id, ...eventData }, true);
      }
    });

    return res.json({ success: true, message: 'IQAC extension approved successfully', event: { id: req.params.id, ...eventData, ...updatePayload } });
  } catch (error) {
    console.error('[events/approve-iqac-extension] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to approve extension', error: error.message });
  }
});

// PATCH /api/events/:id/reject-iqac-extension
router.patch('/:id/reject-iqac-extension', async (req, res) => {
  if (!checkDb(res)) return;
  const { rejectedBy } = req.body;
  if (!rejectedBy) {
    return res.status(400).json({ success: false, message: 'rejectedBy (HOD name) is required' });
  }
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();
    const updatePayload = {
      'iqacExtensionRequest.status': 'REJECTED',
      'iqacExtensionRequest.rejectedBy': rejectedBy,
      'iqacExtensionRequest.rejectedAt': new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await updateDoc(eventRef, updatePayload);

    executeBackgroundNotification('events/reject-iqac-extension', async () => {
      if (eventData.organizerEmail) {
        await sendIQACExtensionStatusEmail(eventData.organizerEmail, { id: req.params.id, ...eventData }, false);
      }
    });

    return res.json({ success: true, message: 'IQAC extension rejected successfully' });
  } catch (error) {
    console.error('[events/reject-iqac-extension] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject extension', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/extend-iqac-window â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// (Existing) Legacy/Faculty-only quick extension (grants 2 extra days from now)
router.patch('/:id/extend-iqac-window', async (req, res) => {
  if (!checkDb(res)) return;
  const { extendedBy } = req.body;
  if (!extendedBy) return res.status(400).json({ success: false, message: 'extendedBy is required' });
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    // Legacy logic: 2 days from now
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const updatePayload = {
      iqacWindowExtended: true,
      iqacWindowExtendedBy: extendedBy,
      iqacWindowExtendedAt: new Date().toISOString(),
      iqacExtensionEndDate: twoDaysFromNow.toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(eventRef, updatePayload);
    return res.json({ success: true, message: 'IQAC window extended successfully', event: { id: req.params.id, ...eventSnap.data(), ...updatePayload } });
  } catch (error) {
    console.error('[events/extend-iqac-window] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to extend window', error: error.message });
  }
});

// ── PATCH /api/events/:id/cancel ───────────────────────────────────────────
// Cancel an event (STUDENT_ORGANIZER or FACULTY)
router.patch('/:id/cancel', requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { cancellationReason, confirmationText } = req.body;
  
  if (!cancellationReason || typeof cancellationReason !== 'string' || cancellationReason.trim() === '') {
    return res.status(400).json({ success: false, message: 'Cancellation reason is mandatory' });
  }
  
  if (confirmationText !== 'CANCEL EVENT') {
    return res.status(400).json({ success: false, message: 'Invalid confirmation text' });
  }

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    
    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only cancel your own events' });
    }
    
    if (eventData.status === 'COMPLETED' || eventData.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel an event that is already completed or cancelled' });
    }

    const now = new Date().toISOString();
    
    const newStatus = req.user.role === 'STUDENT_ORGANIZER' ? 'PENDING_FACULTY' : 'PENDING_HOD';
    const updatePayload = {
      status: newStatus,
      modificationRequest: {
        type: 'CANCEL',
        reason: cancellationReason.trim(),
        requestedBy: req.user.name || req.user.email,
        requestedAt: now
      },
      updatedAt: now,
      facultyApprovedAt: null,
      facultyApprovedBy: null,
      hodApprovedAt: null,
      hodApprovedBy: null,
      iqacApprovedAt: null,
      iqacApprovedBy: null
    };

    // [MODULE 3] Atomic Write for cancellation
    const batch = writeBatch(db);
    
    // [LEGACY COMPATIBILITY - REMOVE LATER] Dual-write to embedded array
    const legacyAction = {
      action: 'CANCEL_REQUESTED',
      status: newStatus,
      approvedBy: req.user.name || req.user.email,
      role: req.user.role,
      timestamp: new Date().toISOString(),
      remarks: cancellationReason.trim()
    };
    updatePayload.eventActions = arrayUnion(legacyAction);
    
    batch.update(eventRef, updatePayload);

    // [NEW ARCHITECTURE] Write to normalized eventApprovalLogs collection
    const logRef = doc(collection(db, 'eventApprovalLogs'));
    batch.set(logRef, {
      eventId: req.params.id,
      action: newStatus,
      approvedBy: req.user.name || req.user.email,
      role: req.user.role,
      remarks: cancellationReason.trim(),
      timestamp: new Date().toISOString()
    });

    await batch.commit();

    // Notifications
    executeBackgroundNotification('events/cancel', async () => {
      const updatedEvent = { id: req.params.id, ...eventData, ...updatePayload };
      await handleEventStatusChange(updatedEvent, eventData.status, newStatus);
      await handleModificationRequestSubmitted(updatedEvent, 'CANCEL', newStatus, cancellationReason.trim());
    });

    return res.json({ success: true, message: 'Event cancelled successfully', event: { id: req.params.id, ...eventData, ...updatePayload } });
  } catch (error) {
    console.error('[events/cancel] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel event', error: error.message });
  }
});

// ── PATCH /api/events/:id/postpone ─────────────────────────────────────────
// Postpone an event (STUDENT_ORGANIZER or FACULTY)
router.patch('/:id/postpone', requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { reason, newDate, newEndDate: providedEndDate, newStartTime, newEndTime, venueId: bodyVenueId, skipVenueAvailabilityCheck: skipVenueCheck } = req.body;
  const newEndDate = providedEndDate || newDate;
  
  if (!reason || !newDate || !newStartTime || !newEndTime) {
    return res.status(400).json({ success: false, message: 'Reason, newDate, newStartTime, and newEndTime are mandatory' });
  }

  // Basic time validation
  if (newDate > newEndDate) {
    return res.status(400).json({ success: false, message: 'End date must be after or equal to start date' });
  }
  if (newDate === newEndDate && newStartTime >= newEndTime) {
    return res.status(400).json({ success: false, message: 'End time must be after start time on the same day' });
  }

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    
    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only postpone your own events' });
    }
    
    if (eventData.status === 'COMPLETED' || eventData.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Cannot postpone an event that is completed or cancelled' });
    }

    // ── Server-side venue availability check (non-skippable by frontend, protected by RBAC) ──
    // Only IQAC_TEAM or SYSTEM_ADMIN callers may explicitly skip the venue availability check via role guard
    const canExplicitlySkipVenueCheck = (req.user.role === 'IQAC_TEAM' || req.user.role === 'SYSTEM_ADMIN') && skipVenueCheck === true;
    const resolveVenueId = () => {
      if (bodyVenueId) return String(bodyVenueId);
      if (eventData.venueId || eventData.venue_id) return String(eventData.venueId || eventData.venue_id);
      const step1VenueId = eventData.requisition?.step1?.venueId;
      if (step1VenueId) return String(step1VenueId);
      const hrSelections = Object.entries(eventData.requisition?.annexureI_venue?.venueSelection || {})
        .filter(([, v]) => v && v.selected).map(([k]) => k);
      if (hrSelections[0]) return hrSelections[0];
      const audioVenue = eventData.requisition?.annexureII_audio?.venueName;
      return audioVenue || null;
    };
    const eventVenueId = resolveVenueId();
    const eventReservationId = eventData.reservationId || eventData.venueReservationId || null;
    const VenueAvailabilityService = require('../services/venueAvailabilityService');

    if (eventVenueId && !canExplicitlySkipVenueCheck) {
      // Iterate over all days in the new date range (multi-day safety): at least one slot must be free per day.
      const startDp = new Date(newDate);
      const endDp = new Date(newEndDate);
      const totalDays = Math.max(1, Math.round((endDp - startDp) / (1000 * 60 * 60 * 24)) + 1);
      let firstConflict = null;
      for (let dayOffset = 0; dayOffset < totalDays; dayOffset += 1) {
        const curDate = new Date(startDp.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const yyyy = curDate.getFullYear();
        const mm = String(curDate.getMonth() + 1).padStart(2, '0');
        const dd = String(curDate.getDate()).padStart(2, '0');
        const curDateStr = `${yyyy}-${mm}-${dd}`;
        // For multi-day events, use the actual start/end times only on first/last day; all-day window otherwise.
        const dayStart = (dayOffset === 0) ? newStartTime : '00:01';
        const dayEnd = (dayOffset === totalDays - 1) ? newEndTime : '23:59';
        // eslint-disable-next-line no-await-in-loop
        const slotOutcome = await VenueAvailabilityService.getVenueSlotStatus(
          eventVenueId,
          curDateStr,
          dayStart,
          dayEnd,
          { skipEventId: req.params.id, skipReservationId: eventReservationId }
        );
        if (!slotOutcome.available) {
          firstConflict = slotOutcome;
          break;
        }
      }
      if (firstConflict) {
        const earliest = firstConflict.earliestAvailable
          ? new Date(firstConflict.earliestAvailable).toLocaleString()
          : null;
        const actorHint = firstConflict.conflictingReservation?.organizerId
          ? ` (by ${firstConflict.conflictingReservation.organizerName || 'another organizer'})`
          : '';
        const baseMsg = `Venue currently reserved for the selected new date/time${actorHint}.${earliest ? ` Available after ${earliest}.` : ''}`;
        const logger = require('../utils/logger');
        logger.logAudit({
          category: 'VENUE',
          action: 'VENUE_POSTPONE_BLOCKED',
          status: 'BLOCKED',
          severity: 'MEDIUM',
          actor: { id: req.user.id, name: req.user.name, role: req.user.role, department: req.user.department },
          target: { entityType: 'VENUE_RESERVATION', entityId: eventReservationId || 'n/a', venueId: eventVenueId, eventId: req.params.id },
          correlationId: crypto.randomUUID(),
          requestId: req.id || crypto.randomUUID(),
          details: {
            requestedNew: { newDate, newEndDate, newStartTime, newEndTime },
            conflictingReservation: firstConflict.conflictingReservation || null,
            earliestAvailable: firstConflict.earliestAvailable || null
          },
          ipAddress: req.ipAddress || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
          device: req.headers['user-agent'] || null
        });
        return res.status(409).json({
          success: false,
          message: baseMsg,
          earliestAvailable: firstConflict.earliestAvailable || null,
          conflictingReservation: firstConflict.conflictingReservation || null,
          status: firstConflict.status
        });
      }
    }

    const now = new Date().toISOString();
    
    const oldDate = eventData.requisition?.step1?.eventStartDate || eventData.date;
    const oldStartTime = eventData.requisition?.step1?.eventStartTime || eventData.startTime;
    const oldEndTime = eventData.requisition?.step1?.eventEndTime || eventData.endTime;

    const newStatus = req.user.role === 'STUDENT_ORGANIZER' ? 'PENDING_FACULTY' : 'PENDING_HOD';
    
    // Reset poster workflow if a poster was already handled
    let posterWorkflow = eventData.posterWorkflow || {};
    let posterStatus = eventData.posterStatus || 'PENDING';
    const hasMediaPoster = Boolean(eventData.posterDataUrl || eventData.posterUrl);

    if (posterWorkflow.requested || hasMediaPoster || eventData.departmentApprovals?.media) {
      if (posterWorkflow.requested) {
        if (posterStatus === 'UPLOADED' || posterStatus === 'COMPLETED' || posterWorkflow.status === 'UPLOADED' || posterWorkflow.status === 'COMPLETED') {
          posterStatus = (req.user.role === 'STUDENT_ORGANIZER') ? 'PENDING_FACULTY_REVISION' : 'REVISION_REQUIRED';
          posterWorkflow.status = (req.user.role === 'STUDENT_ORGANIZER') ? 'PENDING_FACULTY_REVISION' : 'REVISION_REQUIRED';
        }
      }
    }

    const firestoreUpdate = {
      status: newStatus,
      posterStatus,
      posterWorkflow,
      modificationRequest: {
        type: 'POSTPONE',
        reason: reason.trim(),
        newDate,
        newEndDate,
        newStartTime,
        newEndTime,
        oldDate,
        oldStartTime,
        oldEndTime,
        requestedBy: req.user.name || req.user.email,
        requestedAt: now
      },
      updatedAt: now,
      facultyApprovedAt: null,
      facultyApprovedBy: null,
      hodApprovedAt: null,
      hodApprovedBy: null,
      iqacApprovedAt: null,
      iqacApprovedBy: null,
      departmentApprovals: {}, // Reset department approvals as dates have changed
      eventActions
    };

    // [MODULE 3] Atomic Write for postpone
    const batch = writeBatch(db);
    
    // [LEGACY COMPATIBILITY - REMOVE LATER] Dual-write to embedded array
    const legacyAction = {
      action: 'POSTPONE_REQUESTED',
      status: newStatus,
      approvedBy: req.user.name || req.user.email,
      role: req.user.role,
      timestamp: new Date().toISOString(),
      remarks: reason.trim()
    };
    firestoreUpdate.eventActions = arrayUnion(legacyAction);
    batch.update(eventRef, firestoreUpdate);

    // [NEW ARCHITECTURE] Write to normalized eventApprovalLogs collection
    const logRef = doc(collection(db, 'eventApprovalLogs'));
    batch.set(logRef, {
      eventId: req.params.id,
      action: newStatus,
      approvedBy: req.user.name || req.user.email,
      role: req.user.role,
      remarks: reason,
      timestamp: new Date().toISOString()
    });

    await batch.commit();

    // Notifications
    executeBackgroundNotification('events/postpone', async () => {
      const updatedEvent = { id: req.params.id, ...eventData, ...firestoreUpdate };
      await handleEventStatusChange(updatedEvent, eventData.status, newStatus);
      await handleModificationRequestSubmitted(updatedEvent, 'POSTPONE', newStatus, reason.trim(), newDate);
    });

    return res.json({ success: true, message: 'Event postponed successfully', event: { id: req.params.id, ...eventData, ...firestoreUpdate } });
  } catch (error) {
    console.error('[events/postpone] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to postpone event', error: error.message });
  }
});

// ── ATTENDANCE ROUTES ────────────────────────────────────────────────────────

// Helper to log attendance modifications
async function logAttendanceAudit(eventId, logData) {
  try {
    const auditRef = collection(db, 'events', eventId, 'attendanceAuditLogs');
    await addDoc(auditRef, {
      ...logData,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to log attendance audit:', err.message);
  }
}

// ── GET /api/events/:id/attendance-audit ──────────────────────────────────
router.get('/:id/attendance-audit', requireRole(['IQAC_TEAM']), async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const auditRef = collection(db, 'events', req.params.id, 'attendanceAuditLogs');
    const snapshot = await getDocs(auditRef);
    const logs = snapshot.docs.map(d => {
      const data = d.data();
      const dateObj = new Date(data.timestamp);
      const dateStamp = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
      const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return {
        id: d.id,
        dateStamp,
        time,
        action: data.action || 'N/A',
        studentName: data.studentName || 'N/A',
        rollNo: data.rollNo || 'N/A',
        date: data.date || 'N/A',
        session: data.session || 'N/A',
        previousStatus: data.previousStatus || 'N/A',
        updatedStatus: data.updatedStatus || 'N/A',
        reason: data.reason || 'N/A',
        modifiedBy: data.modifiedBy || 'Unknown',
        userRole: data.userRole || 'N/A',
        timestamp: data.timestamp
      };
    });
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitCount = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 100);
    const offset = Math.max(parseInt(req.query.cursor, 10) || 0, 0);
    const pageLogs = logs.slice(offset, offset + limitCount);
    const nextCursor = offset + pageLogs.length < logs.length ? String(offset + pageLogs.length) : null;
    return res.json({ success: true, logs: pageLogs, pagination: { hasMore: Boolean(nextCursor), nextCursor, count: pageLogs.length } });
  } catch (error) {
    console.error('[events/attendance-audit] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
});

// ── PATCH /api/events/:id/attendance-config ────────────────────────────────
router.patch('/:id/attendance-config', requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { date, attendanceType } = req.body;
  if (!date || !attendanceType) return res.status(400).json({ success: false, message: 'Date and attendanceType required' });

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    
    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const attendanceConfigs = eventData.attendanceConfigs || {};
    
    attendanceConfigs[date] = {
      ...attendanceConfigs[date],
      attendanceType,
      session1Status: attendanceConfigs[date]?.session1Status || 'NotStarted',
      session2Status: attendanceType === 'Both Sessions' ? (attendanceConfigs[date]?.session2Status || 'Disabled') : 'Disabled',
      attendanceFinalized: attendanceConfigs[date]?.attendanceFinalized || false
    };

    await updateDoc(eventRef, { attendanceConfigs });

    await logAttendanceAudit(req.params.id, {
      action: 'Configuration Saved',
      date,
      session: 'N/A',
      previousStatus: eventData.attendanceConfigs?.[date]?.attendanceType || 'N/A',
      updatedStatus: attendanceType,
      reason: 'Configuration updated',
      modifiedBy: req.user.name || req.user.email,
      userRole: req.user.role
    });

    return res.json({ success: true, attendanceConfigs, attendanceStats: eventData.attendanceStats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/events/:id/attendance-session ───────────────────────────────
router.patch('/:id/attendance-session', requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { date, sessionKey, action } = req.body;
  
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false });
    
    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const attendanceConfigs = eventData.attendanceConfigs || {};
    const config = attendanceConfigs[date];
    if (!config) return res.status(400).json({ success: false, message: 'Config not found' });

    if (sessionKey === 'S1') {
      config.session1Status = action === 'START' ? 'Running' : 'Closed';
      if (action === 'START') {
        config.session1StartTime = new Date().toISOString();
        if (config.attendanceType === 'Both Sessions') {
          config.session2Status = 'Disabled';
        }
      }
      if (action === 'END') {
        config.session1EndTime = new Date().toISOString();
        if (config.attendanceType === 'Both Sessions') {
          config.session2Status = 'NotStarted';
        }
      }
    } else if (sessionKey === 'S2') {
      config.session2Status = action === 'START' ? 'Running' : 'Closed';
      if (action === 'START') config.session2StartTime = new Date().toISOString();
      if (action === 'END') config.session2EndTime = new Date().toISOString();
    }

    attendanceConfigs[date] = config;
    await updateDoc(eventRef, { attendanceConfigs });
    
    await logAttendanceAudit(req.params.id, {
      action: 'Session Toggle',
      date,
      session: sessionKey,
      previousStatus: 'N/A',
      updatedStatus: action,
      reason: `Session ${sessionKey} ${action}`,
      modifiedBy: req.user.name || req.user.email,
      userRole: req.user.role
    });

    return res.json({ success: true, attendanceConfigs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/events/:id/finalize-attendance ──────────────────────────────
router.patch('/:id/finalize-attendance', requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { date } = req.body;
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const attendanceConfigs = eventData.attendanceConfigs || {};
    if (attendanceConfigs[date]) {
      attendanceConfigs[date].attendanceFinalized = true;
      attendanceConfigs[date].session1Status = attendanceConfigs[date].session1Status === 'Running' ? 'Closed' : attendanceConfigs[date].session1Status;
      if (attendanceConfigs[date].attendanceType === 'Both Sessions') {
         attendanceConfigs[date].session2Status = attendanceConfigs[date].session2Status === 'Running' ? 'Closed' : attendanceConfigs[date].session2Status;
      }
    }
    await updateDoc(eventRef, { attendanceConfigs });

    await logAttendanceAudit(req.params.id, {
      action: 'Finalized',
      date,
      session: 'N/A',
      previousStatus: 'Open',
      updatedStatus: 'Finalized',
      reason: 'Attendance finalized for date',
      modifiedBy: req.user.name || req.user.email,
      userRole: req.user.role
    });

    return res.json({ success: true, attendanceConfigs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/events/:id/attendance ────────────────────────────────────────
router.post('/:id/attendance', requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { rollNo, studentName, eventId, registrationId, date } = req.body;
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    const eventData = eventSnap.data();
    
    if (eventData.organizerId !== req.user.id) return res.status(403).json({ success: false, silentMessage: 'Forbidden' });

    const config = (eventData.attendanceConfigs || {})[date];
    if (!config) return res.status(400).json({ success: false, silentMessage: 'Attendance not configured for this date' });
    
    const activeSession = config.session1Status === 'Running' ? 'S1' : config.session2Status === 'Running' ? 'S2' : null;
    if (!activeSession) return res.status(400).json({ success: false, silentMessage: 'No active session' });

    // Validate registration
    const reqRef = doc(db, 'odRequests', registrationId);

    const transactionResult = await runTransaction(db, async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      const eventData = eventSnap.data();
      
      if (eventData.organizerId !== req.user.id) {
        throw new Error('FORBIDDEN:Forbidden');
      }

      const config = (eventData.attendanceConfigs || {})[date];
      if (!config) throw new Error('BAD_REQUEST:Attendance not configured for this date');
      
      const activeSession = config.session1Status === 'Running' ? 'S1' : config.session2Status === 'Running' ? 'S2' : null;
      if (!activeSession) throw new Error('BAD_REQUEST:No active session');

      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) throw new Error('BAD_REQUEST:Registration not found');
      
      const reqData = reqSnap.data();
      if (reqData.eventId !== eventId || reqData.status !== 'APPROVED') {
        throw new Error('BAD_REQUEST:Student is not an approved participant');
      }

      // [MODULE 4] Normalized eventAttendance Collection
      const studentId = reqData.studentId || reqData.userId || reqData.rollNo;
      const attId = `${eventId}_${studentId}`;
      const attRef = doc(db, 'eventAttendance', attId);
      const attSnap = await transaction.get(attRef);
      
      let eventAttendanceData = attSnap.exists() ? attSnap.data() : {
          eventId: eventId,
          studentId: studentId,
          studentName: reqData.studentName,
          rollNo: reqData.rollNo,
          attendance: {},
          status: 'ATTENDED',
          createdAt: new Date().toISOString(),
      };

      const dateAttendance = eventAttendanceData.attendance[date] || {};
      if (dateAttendance[activeSession]) {
        return { 
          duplicate: true, 
          studentName: reqData.studentName, 
          rollNo: reqData.rollNo, 
          sessionLabel: activeSession === 'S1' ? 'Session 1' : 'Session 2' 
        };
      }

      let wasAlreadyPresentAtAll = false;
      Object.values(eventAttendanceData.attendance).forEach(dateAtt => {
         if (dateAtt.S1 || dateAtt.S2) wasAlreadyPresentAtAll = true;
      });

      dateAttendance[activeSession] = true;
      eventAttendanceData.attendance[date] = dateAttendance;
      eventAttendanceData.updatedAt = new Date().toISOString();

      // [LEGACY COMPATIBILITY - REMOVE LATER] Dual-write to odRequests
      const legacyAttendance = reqData.attendance || {};
      const legacyDateAtt = legacyAttendance[date] || {};
      legacyDateAtt[activeSession] = true;
      legacyAttendance[date] = legacyDateAtt;
      transaction.update(reqRef, { attendance: legacyAttendance });

      // 1. Create/Update root collection doc
      transaction.set(attRef, eventAttendanceData);

      // 2. Update events stats
      const stats = eventData.attendanceStats || { totalApproved: 0, totalPresent: 0, s1Present: 0, s2Present: 0 };
      if (activeSession === 'S1') stats.s1Present = (stats.s1Present || 0) + 1;
      if (activeSession === 'S2') stats.s2Present = (stats.s2Present || 0) + 1;
      if (!wasAlreadyPresentAtAll) {
         stats.totalPresent = (stats.totalPresent || 0) + 1;
      }
      
      transaction.update(eventRef, { attendanceStats: stats });

      return {
        success: true, 
        studentName: reqData.studentName, 
        rollNo: reqData.rollNo, 
        sessionLabel: activeSession === 'S1' ? 'Session 1' : 'Session 2',
        sessionKey: activeSession,
        isFirstScan: !wasAlreadyPresentAtAll
      };
    });

    if (transactionResult.duplicate) {
       return res.json({ success: false, ...transactionResult });
    }

    return res.json(transactionResult);
  } catch (err) {
    if (err.message.includes('FORBIDDEN')) return res.status(403).json({ success: false, silentMessage: err.message.split(':')[1] });
    if (err.message.includes('BAD_REQUEST')) return res.status(400).json({ success: false, silentMessage: err.message.split(':')[1] });
    
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/events/:id/attendance/correct ──────────────────────────────
router.patch('/:id/attendance/correct', requireRole(['STUDENT_ORGANIZER', 'FACULTY']), async (req, res) => {
  if (!checkDb(res)) return;
  const { registrationId, date, session, s1Present, s2Present, reason } = req.body;
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    
    if (eventSnap.data().organizerId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const reqRef = doc(db, 'odRequests', registrationId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return res.status(404).json({ success: false, message: 'Registration not found' });
    
    const reqData = reqSnap.data();
    if (reqData.eventId !== req.params.id || reqData.status !== 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Invalid registration state' });
    }

    const attendance = reqData.attendance || {};
    const dateAttendance = attendance[date] || {};
    
    const correctionLogs = reqData.correctionLogs || [];
    const oldStatus = `S1: ${dateAttendance.S1 ? 'true' : 'false'}${session === 'BOTH' ? `, S2: ${dateAttendance.S2 ? 'true' : 'false'}` : ''}`;
    const newStatus = `S1: ${s1Present}${session === 'BOTH' ? `, S2: ${s2Present}` : ''}`;

    if (session === 'S1') {
       dateAttendance.S1 = s1Present;
    } else {
       dateAttendance.S1 = s1Present;
       dateAttendance.S2 = s2Present;
    }
    attendance[date] = dateAttendance;

    correctionLogs.push({
      timestamp: new Date().toISOString(),
      correctedBy: req.user.id,
      reason,
      changes: `Date: ${date} | ${newStatus}`
    });
    
    const studentId = reqData.studentId || reqData.userId || reqData.rollNo;
    const attId = `${req.params.id}_${studentId}`;
    const attRef = doc(db, 'eventAttendance', attId);
    
    // [MODULE 4] Atomic Write for Attendance Correction
    const batch = writeBatch(db);

    batch.update(reqRef, { attendance, correctionLogs }); // [LEGACY COMPATIBILITY - REMOVE LATER]
    
    batch.set(attRef, {
       eventId: req.params.id,
       studentId: studentId,
       studentName: reqData.studentName,
       rollNo: reqData.rollNo,
       attendance: attendance,
       status: 'ATTENDED',
       updatedAt: new Date().toISOString()
    }, { merge: true });

    await batch.commit();
    await logAttendanceAudit(req.params.id, {
      action: 'Correction',
      date,
      session,
      studentName: reqData.studentName,
      rollNo: reqData.rollNo,
      previousStatus: oldStatus,
      updatedStatus: newStatus,
      reason: reason || 'Manual correction',
      modifiedBy: req.user.name || req.user.email,
      userRole: req.user.role
    });

    // Recalculate global stats for bulletproof accuracy
    const qSnapshot = await getDocs(query(collection(db, 'odRequests'), where('eventId', '==', req.params.id), where('status', '==', 'APPROVED')));
    let newS1 = 0; let newS2 = 0; let newTotal = 0;
    qSnapshot.forEach(docSnap => {
       const d = docSnap.data();
       const att = d.attendance || {};
       let studentPresentAtAll = false;
       Object.values(att).forEach(dateAtt => {
          if (dateAtt.S1) newS1++;
          if (dateAtt.S2) newS2++;
          if (dateAtt.S1 || dateAtt.S2) studentPresentAtAll = true;
       });
       if (studentPresentAtAll) newTotal++;
    });

    const stats = eventSnap.data().attendanceStats || {};
    stats.s1Present = newS1;
    stats.s2Present = newS2;
    stats.totalPresent = newTotal;
    
    await updateDoc(eventRef, { attendanceStats: stats });

    return res.json({ success: true, message: 'Attendance corrected successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/events/:id/registrations ────────────────────────────────────────
// List event registrations with optional status filter + pagination
router.get('/:id/registrations', requireRole(['STUDENT_ORGANIZER', 'FACULTY', 'HOD', 'IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventId = req.params.id;
    const { status } = req.query;
    const limitCount = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();
    const organizerId = eventData.organizerId || eventData.createdBy;
    const actingRole = req.user.role;
    const actingDept = req.user.department;

    let authorized = false;
    if (['IQAC_TEAM', 'SYSTEM_ADMIN'].includes(actingRole)) authorized = true;
    else if (actingRole === 'STUDENT_ORGANIZER' && String(organizerId) === String(req.user.id)) authorized = true;
    else if (['FACULTY', 'HOD'].includes(actingRole) && actingDept.toUpperCase() === (eventData.department || '').toUpperCase()) authorized = true;

    if (!authorized) return res.status(403).json({ success: false, message: 'Forbidden' });

    const regMeta = getRegistrationMeta(eventData);

    // Query root eventRegistrations collection
    const baseConstraints = [where('eventId', '==', eventId)];
    if (status && status !== 'ALL') {
      baseConstraints.push(where('status', 'in', Array.isArray(status) ? status : status.split(',')));
    }
    baseConstraints.push(orderBy('registeredAt', 'desc'));
    baseConstraints.push(limit(limitCount + 1));

    const regSnap = await getDocs(query(collection(db, 'eventRegistrations'), ...baseConstraints));
    const all = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const items = all.slice(0, limitCount);
    const hasMore = all.length > limitCount;

    // Counts per status (independent query for speed: use stats or compute)
    const countSnap = await getDocs(query(collection(db, 'eventRegistrations'), where('eventId', '==', eventId)));
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, WAITLISTED: 0, WITHDRAWN: 0 };
    countSnap.forEach(d => {
      const s = d.data().status || 'PENDING';
      if (s === 'PENDING_APPROVAL') counts.PENDING++;
      else counts[s] = (counts[s] || 0) + 1;
    });
    counts.TOTAL = countSnap.size;

    return res.json({
      success: true,
      count: items.length,
      items,
      hasMore,
      counts,
      meta: regMeta,
      eventTitle: eventData.title || eventData.eventName
    });
  } catch (error) {
    console.error('[events/registrations/list] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list registrations', error: error.message });
  }
});

// ─── GET /api/events/:id/registration/history ─────────────────────────────────
// Full deadline extension timeline + registration version history
router.get('/:id/registration/history', requireRole(['STUDENT_ORGANIZER', 'FACULTY', 'HOD', 'IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const eventId = req.params.id;
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    const eventData = eventSnap.data();
    const regMeta = getRegistrationMeta(eventData);

    // Build timeline
    const timeline = [];
    if (regMeta.originalDeadline) {
      timeline.push({
        version: 'Original',
        deadline: regMeta.originalDeadline,
        changedBy: { id: 'SYSTEM', name: 'System', role: 'SYSTEM' },
        reason: 'Initial schedule',
        timestamp: eventData.createdAt || null,
        registrationCount: 0
      });
    }
    (regMeta.extensions || []).forEach((ext, idx) => {
      timeline.push({
        version: `Extension #${idx + 1}`,
        oldDeadline: ext.oldDeadline,
        deadline: ext.newDeadline,
        changedBy: ext.extendedBy || { id: 'Unknown' },
        reason: ext.reason,
        timestamp: ext.extendedAt,
        registrationCount: ext.registrationCount || 0
      });
    });
    if (regMeta.status === 'CLOSED') {
      timeline.push({
        version: 'Registration Closed',
        deadline: regMeta.currentDeadline,
        changedBy: { id: regMeta.closedBy || 'SYSTEM', name: regMeta.closedBy || 'System', role: 'SYSTEM' },
        reason: 'Deadline reached',
        timestamp: regMeta.autoClosedAt || null
      });
    }
    if (regMeta.status === 'FINALIZED') {
      timeline.push({
        version: 'Registration Finalized',
        changedBy: regMeta.finalizedBy || { id: 'Unknown' },
        reason: 'Participant list locked + notifications queued',
        timestamp: regMeta.finalizedAt,
        notificationSent: regMeta.notificationSent,
        notificationSentAt: regMeta.notificationSentAt
      });
    }

    return res.json({ success: true, meta: regMeta, timeline, extensions: regMeta.extensions || [] });
  } catch (error) {
    console.error('[events/registration/history] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch history', error: error.message });
  }
});

// ─── PATCH /api/events/:id/registration/deadline ──────────────────────────────
// Extend registration deadline (with mandatory reason)
router.patch('/:id/registration/deadline', requireRole(['STUDENT_ORGANIZER', 'FACULTY', 'HOD', 'IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const eventId = req.params.id;
    const { newDeadline, reason } = req.body;
    const reasonStr = String(reason || '').trim();

    if (!newDeadline) return res.status(400).json({ success: false, message: 'newDeadline is required.' });
    if (!reasonStr) return res.status(400).json({ success: false, message: 'Reason is mandatory when extending the registration deadline.' });
    const newDeadlineTs = new Date(newDeadline).getTime();
    if (Number.isNaN(newDeadlineTs)) return res.status(400).json({ success: false, message: 'Invalid newDeadline timestamp.' });

    const eventRef = doc(db, 'events', eventId);
    let eventData;
    let regMeta;
    let registrationCount = 0;

    await runTransaction(db, async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists()) throw new Error('NOT_FOUND:Event not found');
      eventData = eventSnap.data();
      regMeta = getRegistrationMeta(eventData);

      // Role check
      if (!isRoleAllowedToExtend(req.user.role, eventData, req.user.id)) {
        throw new Error('FORBIDDEN:Your role is not allowed to extend this registration deadline.');
      }

      // Policy check
      const check = isExtensionAllowed(eventData, req.user.role);
      if (!check.allowed) throw new Error(`BAD_REQUEST:${check.reason}`);

      // Event hasn't started
      const startDateStr = eventData.requisition?.step1?.eventStartDate || eventData.date;
      const startTimeStr = eventData.requisition?.step1?.eventStartTime || eventData.startTime || '23:59';
      let eventStartTs = null;
      try {
        const sDP = startDateStr.split('-'); const sTP = startTimeStr.split(':');
        eventStartTs = new Date(parseInt(sDP[0]), parseInt(sDP[1]) - 1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1])).getTime();
      } catch {}
      if (eventStartTs && newDeadlineTs >= eventStartTs) {
        throw new Error('BAD_REQUEST:New deadline must be before the event start time.');
      }

      // Max duration check
      const oldDeadlineTs = regMeta.currentDeadline ? new Date(regMeta.currentDeadline).getTime() : Date.now();
      const maxExtensionMs = EXTENSION_POLICY.MAX_EXTENSION_DAYS * 24 * 60 * 60 * 1000;
      const diffMs = newDeadlineTs - (oldDeadlineTs > Date.now() ? oldDeadlineTs : Date.now());
      if (diffMs > maxExtensionMs && !['IQAC_TEAM', 'SYSTEM_ADMIN'].includes(req.user.role)) {
        throw new Error(`BAD_REQUEST:Extension cannot exceed ${EXTENSION_POLICY.MAX_EXTENSION_DAYS} days. Admin override required.`);
      }

      // Count registrations at time of extension
      const countSnap = await getDocs(query(collection(db, 'eventRegistrations'), where('eventId', '==', eventId)));
      registrationCount = countSnap.size;

      // Build new registration object (preserves original deadline immutably)
      const existingReg = eventData.registration || {};
      const originalDeadline = existingReg.originalDeadline || regMeta.originalDeadline || eventData.registrationDeadline || regMeta.currentDeadline;
      const extensionRecord = {
        oldDeadline: regMeta.currentDeadline || null,
        newDeadline: new Date(newDeadline).toISOString(),
        reason: reasonStr,
        extendedBy: {
          uid: req.user.id,
          name: req.user.name || req.user.email,
          role: req.user.role,
          department: req.user.department
        },
        extendedAt: new Date().toISOString(),
        registrationCount
      };

      const extensions = Array.isArray(existingReg.extensions) ? existingReg.extensions : [];
      const wasClosed = existingReg.status === 'CLOSED';
      const newStatus = wasClosed ? 'OPEN' : (existingReg.status || 'OPEN');

      const newRegObj = {
        ...existingReg,
        enabled: true,
        originalDeadline,
        currentDeadline: extensionRecord.newDeadline,
        status: newStatus,
        reopened: wasClosed ? true : (existingReg.reopened || false),
        extensionCount: (existingReg.extensionCount || 0) + 1,
        extensions: [...extensions, extensionRecord]
      };

      transaction.update(eventRef, {
        registration: newRegObj,
        updatedAt: new Date().toISOString()
      });

      eventData = { ...eventData, registration: newRegObj };
      regMeta = getRegistrationMeta(eventData);
    });

    // Audit log
    await logAudit({
      category: 'REGISTRATION',
      action: 'REGISTRATION_DEADLINE_EXTENDED',
      status: 'SUCCESS',
      severity: 'INFO',
      actor: {
        userId: req.user.id,
        name: req.user.name || req.user.email,
        role: req.user.role,
        department: req.user.department
      },
      target: { entityType: 'EVENT', entityId: eventId },
      correlationId: eventId,
      requestId: crypto.randomUUID(),
      details: {
        oldDeadline: regMeta.extensions?.slice(-1)[0]?.oldDeadline || null,
        newDeadline: regMeta.currentDeadline,
        reason: reasonStr,
        registrationCount,
        newStatus: regMeta.status
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null
    });

    logActivity({
      category: 'REGISTRATION',
      action: 'REGISTRATION_DEADLINE_EXTENDED',
      status: 'SUCCESS',
      correlationId: eventId,
      requestId: crypto.randomUUID(),
      actor: { userId: req.user.id, name: req.user.name || req.user.email, role: req.user.role },
      target: { entityType: 'EVENT', entityId: eventId },
      details: { newDeadline: regMeta.currentDeadline, reason: reasonStr }
    });

    return res.json({
      success: true,
      message: `Registration deadline extended successfully. New status: ${regMeta.status}.`,
      meta: regMeta,
      extensionCount: regMeta.extensionCount
    });

  } catch (error) {
    if (error.message.includes('NOT_FOUND')) return res.status(404).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('BAD_REQUEST')) return res.status(400).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('FORBIDDEN')) return res.status(403).json({ success: false, message: error.message.split(':')[1] });
    console.error('[events/registration/deadline] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to extend deadline', error: error.message });
  }
});

// ─── POST /api/events/:id/registration/bulk-approve ──────────────────────────
router.post('/:id/registration/bulk-approve', requireRole(['STUDENT_ORGANIZER', 'FACULTY', 'HOD', 'IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const eventId = req.params.id;
    const { ids = [] } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids (array of studentIds) is required.' });
    }

    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    const eventData = eventSnap.data();
    const regMeta = getRegistrationMeta(eventData);
    if (regMeta.status === 'FINALIZED') return res.status(400).json({ success: false, message: 'Registration already finalized; bulk changes not permitted.' });

    // Authz
    const actingRole = req.user.role; const actingDept = req.user.department;
    const organizerId = eventData.organizerId || eventData.createdBy;
    let authed = false;
    if (['IQAC_TEAM', 'SYSTEM_ADMIN'].includes(actingRole)) authed = true;
    else if (actingRole === 'STUDENT_ORGANIZER' && String(organizerId) === String(req.user.id)) authed = true;
    else if (['FACULTY', 'HOD'].includes(actingRole) && actingDept.toUpperCase() === (eventData.department || '').toUpperCase()) authed = true;
    if (!authed) return res.status(403).json({ success: false, message: 'Forbidden' });

    const nowIso = new Date().toISOString();
    let applied = 0;
    const BATCH_LIMIT = 500;
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const chunk = ids.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const studentId of chunk) {
        const regId = `${eventId}_${studentId}`;
        const regRef = doc(db, 'eventRegistrations', regId);
        batch.update(regRef, {
          status: 'APPROVED',
          registrationStatus: 'APPROVED',
          notificationSent: false,
          reviewedBy: req.user.id,
          reviewedByName: req.user.name || req.user.email,
          reviewedByRole: actingRole,
          reviewedAt: nowIso,
          updatedAt: nowIso
        });
        applied++;
      }
      await batch.commit();
    }

    await logAudit({
      category: 'REGISTRATION',
      action: 'REGISTRATION_BULK_APPROVED',
      status: 'SUCCESS',
      severity: 'INFO',
      actor: { userId: req.user.id, name: req.user.name || req.user.email, role: req.user.role, department: req.user.department },
      target: { entityType: 'EVENT', entityId: eventId },
      correlationId: eventId,
      requestId: crypto.randomUUID(),
      details: { count: applied, ids },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({ success: true, message: `Bulk approved ${applied} registration(s).`, count: applied });
  } catch (error) {
    console.error('[events/registration/bulk-approve] Error:', error);
    return res.status(500).json({ success: false, message: 'Bulk approve failed', error: error.message });
  }
});

// ─── POST /api/events/:id/registration/bulk-reject ──────────────────────────
router.post('/:id/registration/bulk-reject', requireRole(['STUDENT_ORGANIZER', 'FACULTY', 'HOD', 'IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const eventId = req.params.id;
    const { ids = [], reason = '' } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'ids (array of studentIds) is required.' });
    }

    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });
    const eventData = eventSnap.data();
    const regMeta = getRegistrationMeta(eventData);
    if (regMeta.status === 'FINALIZED') return res.status(400).json({ success: false, message: 'Registration already finalized; bulk changes not permitted.' });

    const actingRole = req.user.role; const actingDept = req.user.department;
    const organizerId = eventData.organizerId || eventData.createdBy;
    let authed = false;
    if (['IQAC_TEAM', 'SYSTEM_ADMIN'].includes(actingRole)) authed = true;
    else if (actingRole === 'STUDENT_ORGANIZER' && String(organizerId) === String(req.user.id)) authed = true;
    else if (['FACULTY', 'HOD'].includes(actingRole) && actingDept.toUpperCase() === (eventData.department || '').toUpperCase()) authed = true;
    if (!authed) return res.status(403).json({ success: false, message: 'Forbidden' });

    const nowIso = new Date().toISOString();
    let applied = 0;
    const BATCH_LIMIT = 500;
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const chunk = ids.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const studentId of chunk) {
        const regId = `${eventId}_${studentId}`;
        const regRef = doc(db, 'eventRegistrations', regId);
        batch.update(regRef, {
          status: 'REJECTED',
          registrationStatus: 'REJECTED',
          rejectionReason: reason || undefined,
          notificationSent: false,
          reviewedBy: req.user.id,
          reviewedByName: req.user.name || req.user.email,
          reviewedByRole: actingRole,
          reviewedAt: nowIso,
          updatedAt: nowIso
        });
        applied++;
      }
      await batch.commit();
    }

    await logAudit({
      category: 'REGISTRATION',
      action: 'REGISTRATION_BULK_REJECTED',
      status: 'SUCCESS',
      severity: 'INFO',
      actor: { userId: req.user.id, name: req.user.name || req.user.email, role: req.user.role, department: req.user.department },
      target: { entityType: 'EVENT', entityId: eventId },
      correlationId: eventId,
      requestId: crypto.randomUUID(),
      details: { count: applied, ids, reason: reason || null },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null
    });

    return res.json({ success: true, message: `Bulk rejected ${applied} registration(s).`, count: applied });
  } catch (error) {
    console.error('[events/registration/bulk-reject] Error:', error);
    return res.status(500).json({ success: false, message: 'Bulk reject failed', error: error.message });
  }
});

// ─── POST /api/events/:id/registration/finalize ──────────────────────────────
// Locks registration list, queues batch notifications (approved / rejected / waitlisted).
// If pending registrations remain, the client must explicitly pass either
// autoRejectPending:true (with optional pendingRejectionReason) OR acknowledgePending:true
// to deliberately leave them unresolved (they will receive NO email).
router.post('/:id/registration/finalize', requireRole(['STUDENT_ORGANIZER', 'FACULTY', 'HOD', 'IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  if (!checkDb(res)) return;
  try {
    const eventId = req.params.id;
    const { confirm, autoRejectPending, acknowledgePending, pendingRejectionReason } = req.body;
    if (confirm !== true) {
      return res.status(400).json({ success: false, message: 'Finalization confirmation is required. Pass confirm: true to lock the registration list and send emails.' });
    }

    const eventRef = doc(db, 'events', eventId);
    let approvedList = [];
    let rejectedList = [];
    let waitlistedList = [];
    let pendingList = [];
    let autoRejectedCount = 0;
    let pendingLeftUnresolved = 0;
    const actingRole = req.user.role;
    const nowIso = new Date().toISOString();
    const defaultPendingReason = 'Not selected after registration review';

    await runTransaction(db, async (transaction) => {
      const eventSnap = await transaction.get(eventRef);
      if (!eventSnap.exists()) throw new Error('NOT_FOUND:Event not found');
      const eventData = eventSnap.data();
      const regMeta = getRegistrationMeta(eventData);

      if (regMeta.status === 'FINALIZED') throw new Error(`NO_OP:Already finalized.`);
      if (regMeta.notificationSent) throw new Error(`BAD_REQUEST:Notification emails have already been sent.`);

      // Authz
      const actingDept = req.user.department;
      const organizerId = eventData.organizerId || eventData.createdBy;
      let authed = false;
      if (['IQAC_TEAM', 'SYSTEM_ADMIN'].includes(actingRole)) authed = true;
      else if (actingRole === 'STUDENT_ORGANIZER' && String(organizerId) === String(req.user.id)) authed = true;
      else if (['FACULTY', 'HOD'].includes(actingRole) && actingDept.toUpperCase() === (eventData.department || '').toUpperCase()) authed = true;
      if (!authed) throw new Error('FORBIDDEN:Not authorized to finalize this registration.');

      // Pre-scan to find PENDING before any writes so we can validate gating
      const regSnap = await getDocs(query(collection(db, 'eventRegistrations'), where('eventId', '==', eventId)));
      const pendingDocs = [];
      regSnap.forEach(d => {
        const r = d.data();
        const st = r.status === 'PENDING_APPROVAL' ? 'PENDING' : (r.status || 'PENDING');
        if (st === 'PENDING') pendingDocs.push({ id: d.id, data: r });
      });

      const hasPending = pendingDocs.length > 0;
      if (hasPending && !autoRejectPending && !acknowledgePending) {
        throw new Error(`BAD_REQUEST:${pendingDocs.length} registration(s) are still PENDING. Pass autoRejectPending:true to reject them, or acknowledgePending:true to leave them unresolved.`);
      }
      if (hasPending && autoRejectPending) {
        const BATCH_LIMIT = 500;
        for (let i = 0; i < pendingDocs.length; i += BATCH_LIMIT) {
          const chunk = pendingDocs.slice(i, i + BATCH_LIMIT);
          // Note: we are already inside a transaction; direct writes go via the transaction
          for (const p of chunk) {
            const regRef = doc(db, 'eventRegistrations', p.id);
            const rejectionText = String(pendingRejectionReason || defaultPendingReason).trim() || defaultPendingReason;
            transaction.update(regRef, {
              status: 'REJECTED',
              registrationStatus: 'REJECTED',
              rejectionReason: rejectionText,
              autoRejectedAtFinalize: true,
              notificationSent: false,
              reviewedBy: req.user.id,
              reviewedByName: req.user.name || req.user.email,
              reviewedByRole: actingRole,
              reviewedAt: nowIso,
              updatedAt: nowIso
            });
          }
        }
        autoRejectedCount = pendingDocs.length;
      } else if (hasPending && acknowledgePending) {
        pendingLeftUnresolved = pendingDocs.length;
      }

      // Finalize: lock status
      const existingReg = eventData.registration || {};
      transaction.update(eventRef, {
        registration: {
          ...existingReg,
          status: 'FINALIZED',
          finalizedAt: nowIso,
          finalizedBy: { uid: req.user.id, name: req.user.name || req.user.email, role: actingRole, department: req.user.department },
          notificationSent: false,
          pendingAtFinalize: {
            total: pendingDocs.length,
            autoRejected: autoRejectedCount,
            unresolved: pendingLeftUnresolved,
            autoRejectReason: autoRejectedCount > 0
              ? (String(pendingRejectionReason || defaultPendingReason).trim() || defaultPendingReason)
              : null
          }
        },
        updatedAt: nowIso
      });

      // Categorize again (post auto-reject writes) for notification batches
      const regSnap2 = await getDocs(query(collection(db, 'eventRegistrations'), where('eventId', '==', eventId)));
      regSnap2.forEach(d => {
        const r = d.data();
        const st = r.status === 'PENDING_APPROVAL' ? 'PENDING' : (r.status || 'PENDING');
        if (st === 'APPROVED') approvedList.push(r);
        else if (st === 'REJECTED') rejectedList.push(r);
        else if (st === 'WAITLISTED') waitlistedList.push(r);
        else pendingList.push(r);
      });
    });

    // ── Queue Group Batch Notifications in background ───────────────────
    // IMPORTANT: No emails are ever sent on auto-close, deadline extension,
    // individual review, or bulk-approve/reject. This executeBackgroundNotification
    // call is the ONLY place participant emails are generated and dispatched.
    // GroupNotificationDispatcher handles batching, BCC/TO modes, retries,
    // idempotency, per-batch status, notification history doc, and all audits.
    executeBackgroundNotification(`events/${eventId}/registration/finalize`, async () => {
      try {
        const GroupNotificationDispatcher = require('../services/GroupNotificationDispatcher');
        const eventSnap2 = await getDoc(eventRef);
        const eventData2 = eventSnap2.exists ? eventSnap2.data() : {};
        const fullEvent = { id: eventId, ...eventData2 };
        const finalizedAt = (eventData2.registration && eventData2.registration.finalizedAt) || nowIso;
        const actor = {
          uid: req.user.id,
          name: req.user.name || req.user.email,
          role: actingRole,
          department: req.user.department
        };
        await GroupNotificationDispatcher.dispatchFinalizeNotifications(
          fullEvent,
          { approvedList, rejectedList, waitlistedList },
          actor,
          finalizedAt
        );
      } catch (err) {
        console.error('[finalize] GroupNotificationDispatcher dispatch failed:', err.message);
        try {
          await logAudit({
            category: 'REGISTRATION',
            action: 'GROUP_NOTIFICATION_COMPLETED',
            status: 'FAILED',
            severity: 'ERROR',
            source: 'events.route/finalize',
            correlationId: eventId,
            requestId: crypto.randomUUID(),
            actor: { userId: req.user.id, name: req.user.name || req.user.email, role: actingRole, department: req.user.department },
            target: { entityType: 'EVENT', entityId: eventId },
            details: {
              approvedCount: approvedList.length,
              rejectedCount: rejectedList.length,
              waitlistedCount: waitlistedList.length,
              error: err.message
            },
            ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
            userAgent: req.headers['user-agent'] || null
          });
        } catch (_) { /* swallow double-fault */ }
      }
    });

    // Audit
    await logAudit({
      category: 'REGISTRATION',
      action: 'REGISTRATION_FINALIZED',
      status: 'SUCCESS',
      severity: 'HIGH',
      actor: { userId: req.user.id, name: req.user.name || req.user.email, role: req.user.role, department: req.user.department },
      target: { entityType: 'EVENT', entityId: eventId },
      correlationId: eventId,
      requestId: crypto.randomUUID(),
      details: {
        approvedCount: approvedList.length,
        rejectedCount: rejectedList.length,
        waitlistedCount: waitlistedList.length,
        pendingAutoRejectedCount: autoRejectedCount,
        pendingLeftUnresolved: pendingLeftUnresolved,
        autoRejectReason: autoRejectedCount > 0
          ? (String(pendingRejectionReason || defaultPendingReason).trim() || defaultPendingReason)
          : null,
        notificationStatus: 'QUEUED'
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null
    });

    logActivity({
      category: 'REGISTRATION',
      action: 'REGISTRATION_FINALIZED',
      status: 'SUCCESS',
      correlationId: eventId,
      requestId: crypto.randomUUID(),
      actor: { userId: req.user.id, name: req.user.name || req.user.email, role: req.user.role },
      target: { entityType: 'EVENT', entityId: eventId },
      details: {
        approvedCount: approvedList.length,
        rejectedCount: rejectedList.length,
        waitlistedCount: waitlistedList.length,
        pendingAutoRejectedCount: autoRejectedCount,
        pendingLeftUnresolved: pendingLeftUnresolved
      }
    });

    return res.json({
      success: true,
      message: 'Registration finalized. Notification emails have been queued.',
      counts: {
        approved: approvedList.length,
        rejected: rejectedList.length,
        waitlisted: waitlistedList.length,
        pending: pendingList.length,
        pendingAutoRejected: autoRejectedCount,
        pendingLeftUnresolved: pendingLeftUnresolved
      },
      notificationStatus: 'QUEUED'
    });

  } catch (error) {
    if (error.message.includes('NO_OP')) return res.status(200).json({ success: true, message: error.message.split(':')[1] });
    if (error.message.includes('NOT_FOUND')) return res.status(404).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('BAD_REQUEST')) return res.status(400).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('FORBIDDEN')) return res.status(403).json({ success: false, message: error.message.split(':')[1] });
    console.error('[events/registration/finalize] Error:', error);
    return res.status(500).json({ success: false, message: 'Finalization failed', error: error.message });
  }
});

module.exports = router;
