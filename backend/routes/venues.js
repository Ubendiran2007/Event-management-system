const express = require('express');
const router = express.Router();
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const authenticateToken = require('../middleware/auth');
const PermissionEngine = require('../utils/permissions');
const VenueAvailabilityService = require('../services/venueAvailabilityService');

const db = getFirestore();

/**
 * @route   GET /api/venues
 * @desc    Get all active venues (public/read-only)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const venuesSnapshot = await db.collection('venues')
      .where('status', 'in', ['ACTIVE', 'MAINTENANCE'])
      .get();
      
    const venues = venuesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return successResponse(res, venues, 'Venues fetched successfully');
  } catch (err) {
    console.error('Error fetching venues:', err);
    return errorResponse(res, err.message, 'FETCH_VENUES_ERROR');
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

    const reservation = await VenueAvailabilityService.reserveVenue(venueId, req.user.uid, date, startTime, endTime);
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

    await VenueAvailabilityService.releaseReservation(reservationId, req.user.uid);
    return successResponse(res, null, 'Reservation released successfully');
  } catch (err) {
    console.error('Error releasing reservation:', err);
    return errorResponse(res, err.message, 'RELEASE_ERROR');
  }
});

// ==========================================
// IQAC Venue Master Management (Admin Routes)
// ==========================================

/**
 * @route   POST /api/venues
 * @desc    Create a new venue (IQAC only)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (!PermissionEngine.canManageVenue(req.user)) {
      return errorResponse(res, 'Unauthorized to manage venues', 'UNAUTHORIZED', 403);
    }

    const payload = req.body;
    const newVenueRef = db.collection('venues').doc();
    
    const venueData = {
      venueId: newVenueRef.id,
      name: payload.name,
      code: payload.code,
      building: payload.building,
      floor: payload.floor,
      capacity: payload.capacity,
      type: payload.type,
      facilities: payload.facilities || [],
      status: payload.status || 'ACTIVE',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: req.user.uid
    };

    await newVenueRef.set(venueData);

    // Audit Logging
    await db.collection('eventAuditLogs').add({
      module: 'VENUE_MASTER',
      action: 'VENUE_CREATED',
      newValue: venueData,
      performedBy: req.user.uid,
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
 * @desc    Update a venue (IQAC only)
 */
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    if (!PermissionEngine.canManageVenue(req.user)) {
      return errorResponse(res, 'Unauthorized to manage venues', 'UNAUTHORIZED', 403);
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
        updatedBy: req.user.uid
      };

      t.update(venueRef, updateData);

      // Audit Logging
      const auditRef = db.collection('eventAuditLogs').doc();
      t.set(auditRef, {
        module: 'VENUE_MASTER',
        action: 'VENUE_UPDATED',
        oldValue: oldData,
        newValue: updateData,
        performedBy: req.user.uid,
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

module.exports = router;
