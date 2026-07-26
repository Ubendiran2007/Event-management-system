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

      // Check Maintenance Windows
      const maintenanceQuery = db.collection('venueMaintenance')
        .where('venueId', '==', venueId);
      const maintenanceSnapshot = await t.get(maintenanceQuery);
      for (const mDoc of maintenanceSnapshot.docs) {
        const mData = mDoc.data();
        if (date >= mData.startDate && date <= mData.endDate) {
          throw new Error(`Venue is scheduled for maintenance (${mData.reason}) from ${mData.startDate} to ${mData.endDate}.`);
        }
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
      const durationMinutes = await SystemConfig.get('venueReservationDuration') || 10;
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
        expiresAt: expirationDate,
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

    // 3. Get Maintenance Windows
    const maintenanceSnapshot = await db.collection('venueMaintenance')
      .where('venueId', '==', venueId)
      .where('endDate', '>=', startDate)
      .get();

    maintenanceSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.startDate <= endDate) {
        calendar.push({
          type: 'MAINTENANCE',
          maintenanceId: doc.id,
          reason: data.reason || 'Scheduled Maintenance',
          startDate: data.startDate,
          endDate: data.endDate
        });
      }
    });

    return calendar;
  }

  /**
   * Re-reserve an expired or expiring hold
   */
  static async reReserveVenue(reservationId, userUid) {
    const db = getFirestore();
    const resRef = db.collection('venueReservations').doc(reservationId);
    const doc = await resRef.get();
    if (!doc.exists) {
      throw new Error("Previous reservation not found.");
    }
    const data = doc.data();
    if (data.reservedBy !== userUid) {
      throw new Error("Unauthorized to re-reserve this venue slot.");
    }

    // Try to reserve it again using standard reserveVenue logic
    return await this.reserveVenue(data.venueId, userUid, data.date, data.startTime, data.endTime);
  }

  /**
   * Validate hold right before submitting event
   */
  static async validateHoldForSubmission(reservationId, venueId, userUid, date, startTime, endTime) {
    const db = getFirestore();
    if (!reservationId) {
      throw new Error("Reservation validation failed. No hold ID provided. Please reserve the venue again.");
    }

    const resRef = db.collection('venueReservations').doc(reservationId);
    const doc = await resRef.get();
    if (!doc.exists) {
      throw new Error("Reservation validation failed. Hold record not found. Please reserve the venue again.");
    }

    const data = doc.data();
    if (data.reservedBy !== userUid || data.venueId !== venueId || data.date !== date || data.startTime !== startTime || data.endTime !== endTime) {
      throw new Error("Reservation validation failed. Event details do not match the held venue slot. Please reserve the venue again.");
    }

    if (new Date() > data.expiresAt.toDate() || data.status === ReservationStatus.EXPIRED) {
      throw new Error("Your reservation has expired. Please reserve the venue again.");
    }

    // Check if venue is still ACTIVE
    const venueRef = db.collection('venues').doc(venueId);
    const venueDoc = await venueRef.get();
    if (!venueDoc.exists || venueDoc.data().status !== 'ACTIVE') {
      throw new Error(`Venue is no longer ACTIVE (${venueDoc.exists ? venueDoc.data().status : 'Not Found'}). Please select another venue.`);
    }

    // Check if venue entered maintenance in the meantime
    const maintenanceQuery = db.collection('venueMaintenance').where('venueId', '==', venueId);
    const maintenanceSnapshot = await maintenanceQuery.get();
    for (const mDoc of maintenanceSnapshot.docs) {
      const mData = mDoc.data();
      if (date >= mData.startDate && date <= mData.endDate) {
        throw new Error(`Venue has entered maintenance (${mData.reason}). Please select another venue.`);
      }
    }

    return true;
  }

  /**
   * Global cleanup method to sweep and expire old reservations
   */
  static async cleanupAllExpiredHolds() {
    const db = getFirestore();
    try {
      const now = new Date();
      const expiredQuery = db.collection('venueReservations')
        .where('status', '==', ReservationStatus.RESERVED)
        .where('expiresAt', '<=', now);
      const snapshot = await expiredQuery.get();
      if (snapshot.empty) return 0;
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { 
          status: ReservationStatus.EXPIRED,
          updatedAt: FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      return snapshot.size;
    } catch (err) {
      console.error('[VenueAvailabilityService] Error cleaning up expired holds:', err);
      return 0;
    }
  }
}

module.exports = VenueAvailabilityService;
