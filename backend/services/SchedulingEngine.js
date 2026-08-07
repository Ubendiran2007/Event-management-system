const ManagerAvailabilityService = require('./ManagerAvailabilityService');
const RegistrationConflictService = require('./RegistrationConflictService');
const ScheduleService = require('./ScheduleService');
const ManagerRecommendationService = require('./ManagerRecommendationService');
const { dbAdmin } = require('../firebaseAdmin');

/**
 * SchedulingEngine
 * Centralized orchestration layer that coordinates venue availability, manager assignments,
 * participant registrations, and schedule timelines.
 * 
 * Acts as a single entry point for all scheduling validations and future AI agent integrations.
 */
class SchedulingEngine {
  /**
   * Validates all scheduling constraints for a proposed event creation or update.
   * Coordinates Venue, Manager, and Schedule rules.
   * 
   * @param {Object} params
   * @param {string} [params.eventId] - Event ID (if updating)
   * @param {string} params.date - YYYY-MM-DD
   * @param {string} params.startTime - HH:mm
   * @param {string} params.endTime - HH:mm
   * @param {Array<string>} [params.managerIds] - Student IDs of assigned managers
   * @param {string} [params.venueId] - Venue ID (optional check)
   * @returns {Promise<{ success: boolean, venueAvailable: boolean, managersAvailable: boolean, conflicts: Array, summary: string }>}
   */
  static async validateEventSchedule({ eventId = null, date, startTime, endTime, managerIds = [], venueId = null, department = '' }) {
    const startTimeMs = Date.now();
    const checkedServices = [];
    const venueConflicts = [];
    const managerConflicts = [];
    const registrationConflicts = [];
    const warnings = [];
    let managerRecommendations = [];

    // 1. Validate Manager Availability
    if (managerIds && managerIds.length > 0) {
      checkedServices.push('manager');
      const managerCheck = await ManagerAvailabilityService.checkAvailability(
        eventId,
        date,
        startTime,
        endTime,
        managerIds
      );

      if (managerCheck.conflicts && managerCheck.conflicts.length > 0) {
        for (const c of managerCheck.conflicts) {
          managerConflicts.push({
            type: 'MANAGER_CONFLICT',
            ...c
          });
        }
      }
    }

    // 2. Validate Venue Availability (if venueId is specified)
    if (venueId && date && startTime && endTime) {
      checkedServices.push('venue');
      try {
        const eventsRef = dbAdmin.collection('events');
        let query = eventsRef.where('date', '==', date).where('venueId', '==', venueId);
        const snap = await query.get();
        
        const activeStatuses = ['POSTED', 'APPROVED', 'PENDING_MANAGERS', 'PENDING_FACULTY', 'PENDING_HOD', 'PENDING_IQAC', 'PENDING_PRINCIPAL', 'PUBLISHED', 'IN_PROGRESS'];
        for (const doc of snap.docs) {
          if (eventId && doc.id === eventId) continue;
          const ev = doc.data();
          const status = (ev.status || '').toUpperCase();
          if (!activeStatuses.includes(status)) continue;

          if (ScheduleService._isTimeOverlapping(date, startTime, endTime, ev.date || date, ev.startTime, ev.endTime)) {
            venueConflicts.push({
              type: 'VENUE_CONFLICT',
              code: 'VENUE_ALREADY_BOOKED',
              ruleId: 'RULE_VENUE_BOOKED',
              venueId,
              conflictingEvent: ev.eventName || ev.title || doc.id,
              startTime: ev.startTime,
              endTime: ev.endTime,
              reason: `Venue is already booked for "${ev.eventName || 'another event'}"`
            });
          }
        }
      } catch (err) {
        warnings.push({ type: 'VENUE_CHECK_WARNING', message: err.message });
        console.warn('[SchedulingEngine] Venue check warning:', err.message);
      }
    }

    // 3. Optional: Recommend managers if there are conflicts or none selected
    if ((managerConflicts.length > 0 || managerIds.length === 0) && date && startTime && endTime && department) {
      checkedServices.push('recommendation');
      try {
        managerRecommendations = await ManagerRecommendationService.suggestManagers(eventId, date, startTime, endTime, department, 3, managerIds);
      } catch (err) {
        warnings.push({ type: 'RECOMMENDATION_WARNING', message: err.message });
      }
    }

    const valid = venueConflicts.length === 0 && managerConflicts.length === 0 && registrationConflicts.length === 0;

    // Attach structured properties onto an array for 100% backward compatibility
    const allConflicts = [...venueConflicts, ...managerConflicts, ...registrationConflicts];
    allConflicts.venue = venueConflicts;
    allConflicts.managers = managerConflicts;
    allConflicts.registrations = registrationConflicts;

    return {
      valid,
      success: valid, // backwards compatibility
      venueAvailable: venueConflicts.length === 0, // backwards compatibility
      managersAvailable: managerConflicts.length === 0, // backwards compatibility
      summary: {
        venue: venueConflicts.length === 0,
        managers: managerConflicts.length === 0,
        registrations: registrationConflicts.length === 0,
        text: valid ? 'All scheduling constraints satisfied.' : `Detected ${allConflicts.length} scheduling conflict(s).`
      },
      conflicts: allConflicts,
      warnings,
      recommendations: {
        managers: managerRecommendations
      },
      metadata: {
        durationMs: Date.now() - startTimeMs,
        checkedServices
      }
    };
  }

  /**
   * Orchestrates registration conflict checking for a participant.
   */
  static async validateParticipantRegistration(eventId, userId, userEmail, userRole) {
    return await RegistrationConflictService.validateRegistration(eventId, userId, userEmail, userRole);
  }

  /**
   * Evaluates the full schedule impact of modifying an existing event.
   */
  static async assessEditImpact(eventId, newDate, newStartTime, newEndTime, newManagerIds = []) {
    return await RegistrationConflictService.assessEditImpact(eventId, newDate, newStartTime, newEndTime, newManagerIds);
  }

  /**
   * Retrieves unified chronological timeline and recommendations.
   */
  static async getUnifiedSchedule(userId, role, dateRange = {}) {
    if (role && role.includes('FACULTY')) {
      return await ScheduleService.getFacultySchedule(userId, dateRange);
    }
    return await ScheduleService.getStudentSchedule(userId, dateRange);
  }

  /**
   * Recommends optimal, conflict-free managers for an event window.
   */
  static async recommendManagers(eventId, date, startTime, endTime, department, limit = 5, excludedIds = []) {
    return await ManagerRecommendationService.suggestManagers(eventId, date, startTime, endTime, department, limit, excludedIds);
  }
}

module.exports = SchedulingEngine;
