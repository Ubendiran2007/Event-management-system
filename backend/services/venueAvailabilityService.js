const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const SystemConfig = require('../config/systemConfig');
const { EventStatus } = require('../events/constants/eventTypes');

/**
 * Reservation Lifecycle
 */
const ReservationStatus = {
  RESERVED: 'RESERVED',
  CONSUMED: 'CONSUMED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED'
};

class VenueAvailabilityService {
  /**
   * Internal helper to determine if two date/time ranges overlap.
   * Assumes simple date/time matching. (In a real system, use moment/date-fns)
   */
  static _isOverlapping(startA, endA, startB, endB) {
    return (startA < endB) && (endA > startB);
  }

  /**
   * Main reservation function, executed entirely inside a Firestore Transaction
   * to guarantee consistency and prevent double booking.
   */
  static async reserveVenue(venueId, userUid, date, startTime, endTime) {
    const db = getFirestore();
    const venueRef = db.collection('venues').doc(venueId);
    
    return await db.runTransaction(async (t) => {
      // 1. Verify Venue exists and is ACTIVE
      const venueDoc = await t.get(venueRef);
      if (!venueDoc.exists) {
        throw new Error("Venue does not exist.");
      }
      
      const venueData = venueDoc.data();
      if (venueData.status !== 'ACTIVE') {
        throw new Error(`Venue is currently ${venueData.status} and cannot be reserved.`);
      }

      // 2. Fetch existing Active Reservations for this venue on this date
      const activeReservationsQuery = db.collection('venueReservations')
        .where('venueId', '==', venueId)
        .where('date', '==', date)
        .where('status', '==', ReservationStatus.RESERVED);
        
      const reservationsSnapshot = await t.get(activeReservationsQuery);

      // Lazy Cleanup Check inside the transaction
      const now = new Date();
      for (const resDoc of reservationsSnapshot.docs) {
        const resData = resDoc.data();
        
        // If the lock expired, lazily release it (update status to EXPIRED)
        const expiresAt = resData.expiresAt.toDate();
        if (now > expiresAt) {
          t.update(resDoc.ref, { 
            status: ReservationStatus.EXPIRED,
            updatedAt: FieldValue.serverTimestamp()
          });
          continue; // It's expired, so it doesn't conflict
        }

        // If it hasn't expired, check for time overlap
        // (Assuming time strings can be converted to comparable values, e.g., '14:00' < '15:00')
        if (this._isOverlapping(startTime, endTime, resData.startTime, resData.endTime)) {
          throw new Error("Venue is already reserved for this time slot.");
        }
      }

      // 3. Fetch Approved Events for this venue to avoid overriding a real event
      const approvedEventsQuery = db.collection('events')
        .where('venueId', '==', venueId)
        .where('date', '==', date)
        .where('status', 'in', [
          EventStatus.APPROVED, 
          EventStatus.PUBLISHED, 
          EventStatus.RUNNING
        ]);

      const eventsSnapshot = await t.get(approvedEventsQuery);
      for (const eventDoc of eventsSnapshot.docs) {
        const eventData = eventDoc.data();
        if (this._isOverlapping(startTime, endTime, eventData.startTime, eventData.endTime)) {
          throw new Error("Venue is already booked for an approved event at this time.");
        }
      }

      // 4. Create the new reservation
      const durationMinutes = await SystemConfig.get('venueReservationDuration');
      const expirationDate = new Date(now.getTime() + durationMinutes * 60000);

      const newReservationRef = db.collection('venueReservations').doc();
      const reservationData = {
        reservationId: newReservationRef.id,
        venueId,
        date,
        startTime,
        endTime,
        reservedBy: userUid,
        status: ReservationStatus.RESERVED,
        expiresAt: expirationDate, // Stored as a JS Date (converted to Firestore Timestamp automatically by admin SDK)
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      t.set(newReservationRef, reservationData);

      return {
        reservationId: newReservationRef.id,
        expiresAt: expirationDate
      };
    });
  }

  /**
   * Release a reservation explicitly (e.g., user cancels drafting)
   */
  static async releaseReservation(reservationId, userUid) {
    const db = getFirestore();
    const resRef = db.collection('venueReservations').doc(reservationId);

    await db.runTransaction(async (t) => {
      const doc = await t.get(resRef);
      if (!doc.exists) {
        throw new Error("Reservation not found.");
      }

      const data = doc.data();
      if (data.reservedBy !== userUid) {
        throw new Error("Unauthorized to release this reservation.");
      }

      if (data.status === ReservationStatus.RESERVED) {
        t.update(resRef, {
          status: ReservationStatus.CANCELLED,
          updatedAt: FieldValue.serverTimestamp()
        });
      }
    });

    return true;
  }

  /**
   * Consume a reservation (e.g., when the draft is submitted/saved permanently)
   */
  static async consumeReservation(reservationId, t) {
    const db = getFirestore();
    const resRef = db.collection('venueReservations').doc(reservationId);
    
    // If a transaction 't' is provided (e.g. from the events route batch/tx), use it.
    if (t) {
      t.update(resRef, {
        status: ReservationStatus.CONSUMED,
        updatedAt: FieldValue.serverTimestamp()
      });
      return;
    }

    // Otherwise standard update
    await resRef.update({
      status: ReservationStatus.CONSUMED,
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  /**
   * Expose calendar slots for a venue
   */
  static async getVenueCalendar(venueId, startDate, endDate) {
    const db = getFirestore();
    
    // 1. Get Reserved Slots
    const resSnapshot = await db.collection('venueReservations')
      .where('venueId', '==', venueId)
      .where('status', '==', ReservationStatus.RESERVED)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();
      
    // 2. Get Approved Events
    const eventsSnapshot = await db.collection('events')
      .where('venueId', '==', venueId)
      .where('status', 'in', [EventStatus.APPROVED, EventStatus.PUBLISHED, EventStatus.RUNNING])
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    const calendar = [];

    resSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Filter out logically expired reservations (lazy cleanup preview)
      if (data.expiresAt.toDate() > new Date()) {
        calendar.push({
          type: 'RESERVATION',
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          reservedBy: data.reservedBy
        });
      }
    });

    eventsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      calendar.push({
        type: 'EVENT',
        eventId: doc.id,
        title: data.title,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime
      });
    });

    return calendar;
  }
}

module.exports = VenueAvailabilityService;
