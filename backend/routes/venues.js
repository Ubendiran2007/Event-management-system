const express = require('express');
const router = express.Router();
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { authenticateToken } = require('../middleware/auth');
const PermissionEngine = require('../utils/permissions');
const VenueAvailabilityService = require('../services/venueAvailabilityService');
const { parsePaginationParams } = require('../utils/paginationHelper');

const db = getFirestore();

/**
 * @route   GET /api/venues
 * @desc    Get all active venues (public/read-only)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const venuesSnapshot = await db.collection('venues')
      .where('status', '==', 'ACTIVE')
      .get();
      
    const venues = venuesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return successResponse(res, venues, 'Venues fetched successfully');
  } catch (err) {
    console.error('Error fetching venues:', err);
    return errorResponse(res, err.message, 'FETCH_VENUES_ERROR');
  }
});

/**
 * @route   GET /api/venues/all
 * @desc    Get all venues regardless of status (HR / IQAC / Admin only) with pagination
 */
router.get('/all', authenticateToken, async (req, res) => {
  try {
    if (!PermissionEngine.canManageVenue(req.user)) {
      return errorResponse(res, 'Unauthorized to view all venues', 'UNAUTHORIZED', 403);
    }

    const { limit: limitCount, cursor, sortBy, sortOrder } = parsePaginationParams(req.query, 20, 100);
    const { status: statusFilter, search } = req.query;

    let queryRef = db.collection('venues');
    if (statusFilter) queryRef = queryRef.where('status', '==', statusFilter);

    const sortField = ['name', 'createdAt', 'capacity'].includes(sortBy) ? sortBy : 'name';
    queryRef = queryRef.orderBy(sortField, sortOrder).orderBy('__name__', 'asc');

    if (cursor) {
      try {
        const [sortVal, docId] = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        const cursorDoc = await db.collection('venues').doc(docId).get();
        if (cursorDoc.exists) queryRef = queryRef.startAfter(cursorDoc);
      } catch(_) {}
    }

    const venuesSnapshot = await queryRef.limit(limitCount + 1).get();
    const allDocs = venuesSnapshot.docs;
    const hasMore = allDocs.length > limitCount;
    const dataDocs = hasMore ? allDocs.slice(0, limitCount) : allDocs;

    let venues = dataDocs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Client-side search filter (venue names are small datasets)
    if (search) {
      const q = search.toLowerCase();
      venues = venues.filter(v => (v.name || '').toLowerCase().includes(q) || (v.location || '').toLowerCase().includes(q));
    }

    const lastDoc = dataDocs.length > 0 ? dataDocs[dataDocs.length - 1] : null;
    const nextCursor = hasMore && lastDoc
      ? Buffer.from(JSON.stringify([lastDoc.get(sortField), lastDoc.id])).toString('base64')
      : null;

    return successResponse(res, venues, 'All venues fetched successfully', 200, {
      pagination: { limit: limitCount, hasMore, nextCursor, count: venues.length }
    });
  } catch (err) {
    console.error('Error fetching all venues:', err);
    return errorResponse(res, err.message, 'FETCH_ALL_VENUES_ERROR');
  }
});

/**
 * @route   GET /api/venues/calendar/system
 * @desc    Get system-wide calendar (reservations/events/maintenance across all venues)
 */
router.get('/calendar/system', authenticateToken, async (req, res) => {
  try {
    if (!PermissionEngine.canManageVenue(req.user)) {
      return errorResponse(res, 'Unauthorized to view system calendar', 'UNAUTHORIZED', 403);
    }
    const { startDate, endDate, venueId, building, type, status } = req.query;
    if (!startDate || !endDate) {
      return errorResponse(res, 'startDate and endDate are required', 'VALIDATION_ERROR', 400);
    }

    let venuesQuery = db.collection('venues');
    if (venueId) venuesQuery = venuesQuery.where('venueId', '==', venueId);
    if (building) venuesQuery = venuesQuery.where('building', '==', building);
    if (type) venuesQuery = venuesQuery.where('type', '==', type);
    
    const venuesSnap = await venuesQuery.get();
    const targetVenueIds = venuesSnap.docs.map(d => d.id);
    const venueMap = Object.fromEntries(venuesSnap.docs.map(d => [d.id, d.data()]));

    const calendar = [];
    for (const vId of targetVenueIds) {
      const vCal = await VenueAvailabilityService.getVenueCalendar(vId, startDate, endDate);
      vCal.forEach(item => {
        const vData = venueMap[vId] || {};
        const calItem = { ...item, venueId: vId, venueName: vData.name, building: vData.building, venueType: vData.type };
        if (!status || status === 'ALL' || item.type === status || (status === 'RESERVED' && item.type === 'EVENT')) {
          calendar.push(calItem);
        }
      });
    }

    return successResponse(res, calendar, 'System calendar fetched successfully');
  } catch (err) {
    console.error('Error fetching system calendar:', err);
    return errorResponse(res, err.message, 'FETCH_SYSTEM_CALENDAR_ERROR');
  }
});

/**
 * @route   GET /api/venues/:id/calendar
 * @desc    Get the calendar (reservations/events) for a specific venue
 */
router.get('/:id/calendar', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return errorResponse(res, 'startDate and endDate are required', 'VALIDATION_ERROR', 400);
    }

    const calendar = await VenueAvailabilityService.getVenueCalendar(id, startDate, endDate);
    return successResponse(res, calendar, 'Venue calendar fetched successfully');
  } catch (err) {
    console.error('Error fetching venue calendar:', err);
    return errorResponse(res, err.message, 'FETCH_CALENDAR_ERROR');
  }
});

/**
 * @route   POST /api/venues/reserve
 * @desc    Reserve a venue for 1 hour
 */
router.post('/reserve', authenticateToken, async (req, res) => {
  try {
    const { venueId, date, startTime, endTime } = req.body;
    
    if (!venueId || !date || !startTime || !endTime) {
      return errorResponse(res, 'Missing required reservation fields', 'VALIDATION_ERROR', 400);
    }

    const reservation = await VenueAvailabilityService.reserveVenue(venueId, req.user.id, date, startTime, endTime);
    return successResponse(res, reservation, 'Venue reserved successfully', 201);
  } catch (err) {
    console.error('Error reserving venue:', err);
    return errorResponse(res, err.message, 'RESERVATION_ERROR', 409); // Conflict
  }
});

/**
 * @route   POST /api/venues/release
 * @desc    Explicitly release a reservation
 */
router.post('/release', authenticateToken, async (req, res) => {
  try {
    const { reservationId } = req.body;
    if (!reservationId) {
      return errorResponse(res, 'reservationId is required', 'VALIDATION_ERROR', 400);
    }

    await VenueAvailabilityService.releaseReservation(reservationId, req.user.id);
    return successResponse(res, null, 'Reservation released successfully');
  } catch (err) {
    console.error('Error releasing reservation:', err);
    return errorResponse(res, err.message, 'RELEASE_ERROR');
  }
});

/**
 * @route   POST /api/venues/re-reserve
 * @desc    Re-reserve an expired or expiring hold
 */
router.post('/re-reserve', authenticateToken, async (req, res) => {
  try {
    const { reservationId } = req.body;
    if (!reservationId) {
      return errorResponse(res, 'reservationId is required', 'VALIDATION_ERROR', 400);
    }
    const reservation = await VenueAvailabilityService.reReserveVenue(reservationId, req.user.id);
    return successResponse(res, reservation, 'Venue re-reserved successfully');
  } catch (err) {
    console.error('Error re-reserving venue:', err);
    return errorResponse(res, err.message, 'RE_RESERVE_ERROR', 409);
  }
});

/**
 * @route   POST /api/venues/validate-hold
 * @desc    Validate hold right before event submission
 */
router.post('/validate-hold', authenticateToken, async (req, res) => {
  try {
    const { reservationId, venueId, date, startTime, endTime } = req.body;
    await VenueAvailabilityService.validateHoldForSubmission(reservationId, venueId, req.user.id, date, startTime, endTime);
    return successResponse(res, { valid: true }, 'Hold is valid');
  } catch (err) {
    console.error('Error validating hold:', err);
    return errorResponse(res, err.message, 'VALIDATE_HOLD_ERROR', 400);
  }
});

// ==========================================
// HR / IQAC Venue Master Management Routes
// ==========================================

/**
 * @route   POST /api/venues
 * @desc    Create a new venue (HR / Super Admin only)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (!PermissionEngine.canEditVenue(req.user)) {
      return errorResponse(res, 'Unauthorized to create venues (Read Only)', 'UNAUTHORIZED', 403);
    }

    const payload = req.body;
    const newVenueRef = db.collection('venues').doc();
    
    const venueData = {
      venueId: newVenueRef.id,
      name: payload.name,
      code: payload.code || '',
      building: payload.building,
      floor: payload.floor,
      capacity: Number(payload.capacity),
      type: payload.type,
      facilities: payload.facilities || [],
      status: payload.status || 'ACTIVE',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.id
    };

    await newVenueRef.set(venueData);

    await db.collection('eventAuditLogs').add({
      module: 'VENUE_MASTER',
      action: 'VENUE_CREATED',
      newValue: venueData,
      performedBy: req.user.id,
      role: req.user.role,
      timestamp: FieldValue.serverTimestamp()
    });

    return successResponse(res, venueData, 'Venue created successfully', 201);
  } catch (err) {
    console.error('Error creating venue:', err);
    return errorResponse(res, err.message, 'CREATE_VENUE_ERROR');
  }
});

/**
 * @route   PATCH /api/venues/:id
 * @desc    Update a venue (HR / Super Admin only)
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    if (!PermissionEngine.canEditVenue(req.user)) {
      return errorResponse(res, 'Unauthorized to edit venues (Read Only)', 'UNAUTHORIZED', 403);
    }

    const { id } = req.params;
    const payload = req.body;
    
    const venueRef = db.collection('venues').doc(id);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(venueRef);
      if (!doc.exists) {
        throw new Error("Venue not found");
      }
      
      const oldData = doc.data();
      const updateData = {
        ...payload,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: req.user.id
      };

      t.update(venueRef, updateData);

      const auditRef = db.collection('eventAuditLogs').doc();
      t.set(auditRef, {
        module: 'VENUE_MASTER',
        action: 'VENUE_UPDATED',
        oldValue: oldData,
        newValue: updateData,
        performedBy: req.user.id,
        role: req.user.role,
        timestamp: FieldValue.serverTimestamp()
      });
    });

    return successResponse(res, null, 'Venue updated successfully');
  } catch (err) {
    console.error('Error updating venue:', err);
    return errorResponse(res, err.message, 'UPDATE_VENUE_ERROR');
  }
});

/**
 * @route   DELETE /api/venues/:id
 * @desc    Archive/Disable a venue (Soft delete, unless SUPER_ADMIN & permanent=true)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (!PermissionEngine.canEditVenue(req.user)) {
      return errorResponse(res, 'Unauthorized to delete venues (Read Only)', 'UNAUTHORIZED', 403);
    }

    const { id } = req.params;
    const { permanent } = req.query;
    const venueRef = db.collection('venues').doc(id);
    const doc = await venueRef.get();
    if (!doc.exists) {
      return errorResponse(res, 'Venue not found', 'NOT_FOUND', 404);
    }
    const oldData = doc.data();

    // Check if active reservations exist
    const activeResSnap = await db.collection('venueReservations')
      .where('venueId', '==', id)
      .where('status', 'in', ['RESERVED', 'CONSUMED'])
      .get();

    // If future reservations or holds exist, cannot delete
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const hasFuture = activeResSnap.docs.some(d => d.data().date >= todayStr);
    if (hasFuture) {
      return errorResponse(res, 'Cannot delete venue. Future reservations exist. Disable or archive the venue instead.', 'VALIDATION_ERROR', 400);
    }

    if (permanent === 'true' && req.user.role === 'SUPER_ADMIN') {
      await venueRef.delete();
      await db.collection('eventAuditLogs').add({
        module: 'VENUE_MASTER',
        action: 'VENUE_DELETED_PERMANENTLY',
        oldValue: oldData,
        performedBy: req.user.id,
        role: req.user.role,
        timestamp: FieldValue.serverTimestamp()
      });
      return successResponse(res, null, 'Venue permanently deleted');
    } else {
      // Soft Delete -> ARCHIVED
      await venueRef.update({
        status: 'ARCHIVED',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: req.user.id
      });
      await db.collection('eventAuditLogs').add({
        module: 'VENUE_MASTER',
        action: 'VENUE_ARCHIVED',
        oldValue: oldData,
        newValue: { ...oldData, status: 'ARCHIVED' },
        performedBy: req.user.id,
        role: req.user.role,
        timestamp: FieldValue.serverTimestamp()
      });
      return successResponse(res, null, 'Venue archived successfully');
    }
  } catch (err) {
    console.error('Error deleting venue:', err);
    return errorResponse(res, err.message, 'DELETE_VENUE_ERROR');
  }
});

/**
 * @route   POST /api/venues/:id/maintenance
 * @desc    Schedule maintenance for a venue
 */
router.post('/:id/maintenance', authenticateToken, async (req, res) => {
  try {
    if (!PermissionEngine.canEditVenue(req.user)) {
      return errorResponse(res, 'Unauthorized to schedule maintenance', 'UNAUTHORIZED', 403);
    }
    const { id } = req.params;
    const { startDate, endDate, reason } = req.body;
    if (!startDate || !endDate) {
      return errorResponse(res, 'startDate and endDate are required', 'VALIDATION_ERROR', 400);
    }

    const mRef = db.collection('venueMaintenance').doc();
    const mData = {
      maintenanceId: mRef.id,
      venueId: id,
      startDate,
      endDate,
      reason: reason || 'Scheduled Maintenance',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: req.user.id
    };
    await mRef.set(mData);

    // If currently during maintenance dates, update venue status
    const todayStr = new Date().toISOString().split('T')[0];
    if (todayStr >= startDate && todayStr <= endDate) {
      await db.collection('venues').doc(id).update({ status: 'MAINTENANCE' });
    }

    return successResponse(res, mData, 'Maintenance scheduled successfully', 201);
  } catch (err) {
    console.error('Error scheduling maintenance:', err);
    return errorResponse(res, err.message, 'SCHEDULE_MAINTENANCE_ERROR');
  }
});

/**
 * @route   GET /api/venues/:id/maintenance
 * @desc    Get maintenance schedules for a venue
 */
router.get('/:id/maintenance', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const snap = await db.collection('venueMaintenance').where('venueId', '==', id).get();
    const schedules = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return successResponse(res, schedules, 'Maintenance fetched successfully');
  } catch (err) {
    console.error('Error fetching maintenance:', err);
    return errorResponse(res, err.message, 'FETCH_MAINTENANCE_ERROR');
  }
});

/**
 * @route   DELETE /api/venues/:id/maintenance/:maintenanceId
 * @desc    Cancel maintenance for a venue
 */
router.delete('/:id/maintenance/:maintenanceId', authenticateToken, async (req, res) => {
  try {
    if (!PermissionEngine.canEditVenue(req.user)) {
      return errorResponse(res, 'Unauthorized to cancel maintenance', 'UNAUTHORIZED', 403);
    }
    const { id, maintenanceId } = req.params;
    await db.collection('venueMaintenance').doc(maintenanceId).delete();

    // Recheck remaining maintenance for venue
    const snap = await db.collection('venueMaintenance').where('venueId', '==', id).get();
    const todayStr = new Date().toISOString().split('T')[0];
    const activeNow = snap.docs.some(d => todayStr >= d.data().startDate && todayStr <= d.data().endDate);
    if (!activeNow) {
      const vDoc = await db.collection('venues').doc(id).get();
      if (vDoc.exists && vDoc.data().status === 'MAINTENANCE') {
        await db.collection('venues').doc(id).update({ status: 'ACTIVE' });
      }
    }

    return successResponse(res, null, 'Maintenance cancelled successfully');
  } catch (err) {
    console.error('Error cancelling maintenance:', err);
    return errorResponse(res, err.message, 'CANCEL_MAINTENANCE_ERROR');
  }
});

module.exports = router;
