const ScheduleService = require('./ScheduleService');
const eventBus = require('../events/eventBus');

/**
 * RegistrationConflictService
 * Focused solely on registration validation and schedule conflict detection for students.
 * Utilizes ScheduleService for centralized schedule checks and emits EventBus telemetry.
 */
class RegistrationConflictService {
  /**
   * Checks if a student has an overlapping registration or schedule item for the specified time window.
   * @param {string} studentId - User ID of the student
   * @param {string} eventId - ID of the event being registered for
   * @param {string} date - Event date (YYYY-MM-DD)
   * @param {string} startTime - Event start time (HH:mm)
   * @param {string} endTime - Event end time (HH:mm)
   * @returns {Promise<boolean>} True if a conflict exists, false otherwise
   */
  static async checkRegistrationConflict(studentId, eventId, date, startTime, endTime) {
    const { hasConflict } = await ScheduleService.checkOverlap(studentId, date, startTime, endTime, eventId);
    return hasConflict;
  }

  /**
   * Finds all overlapping schedule items for a student in a given time window.
   * @param {string} studentId - User ID of the student
   * @param {string} date - Event date (YYYY-MM-DD)
   * @param {string} startTime - Event start time (HH:mm)
   * @param {string} endTime - Event end time (HH:mm)
   * @param {string} excludeEventId - Optional event ID to exclude from conflict checking
   * @returns {Promise<Array>} Array of conflict objects
   */
  static async findOverlappingRegistrations(studentId, date, startTime, endTime, excludeEventId = null) {
    const { conflicts } = await ScheduleService.checkOverlap(studentId, date, startTime, endTime, excludeEventId);
    return conflicts;
  }

  /**
   * Validates a student's eligibility to register for an event based on time conflicts.
   * Throws an error with conflict details if a schedule overlap is detected.
   * Emits EventBus events ('registration.success' or 'registration.validation.failed').
   */
  static async validateRegistration(studentId, eventId, date, startTime, endTime, studentName = 'Student') {
    if (!studentId || !eventId || !date) {
      throw new Error('BAD_REQUEST:Missing required parameters for registration validation');
    }

    const { hasConflict, conflicts } = await ScheduleService.checkOverlap(studentId, date, startTime, endTime, eventId);

    if (hasConflict) {
      // Emit validation failure event
      eventBus.publish('registration.validation.failed', {
        entityId: `${eventId}_${studentId}`,
        timestamp: Date.now(),
        studentId,
        studentName,
        eventId,
        date,
        startTime,
        endTime,
        conflicts,
        reason: conflicts[0]?.reason || 'Schedule overlap detected'
      });

      const error = new Error(`CONFLICT:Schedule conflict detected. You have an overlapping commitment (${conflicts[0]?.eventName || conflicts[0]?.type}).`);
      error.status = 409;
      error.code = conflicts[0]?.code || 'STUDENT_ALREADY_REGISTERED';
      error.ruleId = conflicts[0]?.ruleId || 'RULE_REGISTRATION_OVERLAP';
      error.conflicts = conflicts;
      throw error;
    }

    // Emit validation success event
    eventBus.publish('registration.success', {
      entityId: `${eventId}_${studentId}`,
      timestamp: Date.now(),
      studentId,
      studentName,
      eventId,
      date,
      startTime,
      endTime
    });

    return {
      success: true,
      message: 'No schedule conflicts detected.'
    };
  }
}

module.exports = RegistrationConflictService;
