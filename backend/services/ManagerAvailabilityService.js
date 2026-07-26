const ScheduleService = require('./ScheduleService');
const eventBus = require('../events/eventBus');

/**
 * ManagerAvailabilityService
 * Deterministic validation and conflict detection for student manager assignments.
 * Prevents a student manager from being assigned to multiple overlapping events, registrations, or ODs.
 */
class ManagerAvailabilityService {
  /**
   * Checks availability for a list of candidate manager IDs or objects.
   * @param {string} eventId - Current event ID (excluded from overlap checks during edits)
   * @param {string} date - Event date (YYYY-MM-DD)
   * @param {string} startTime - Event start time (HH:mm)
   * @param {string} endTime - Event end time (HH:mm)
   * @param {Array<string|object>} managers - Array of user IDs or manager objects ({ userId, name, email })
   * @returns {Promise<object>} { success: boolean, availableManagers: Array, conflicts: Array }
   */
  static async checkAvailability(eventId, date, startTime, endTime, managers = []) {
    if (!managers || !Array.isArray(managers) || managers.length === 0) {
      return { success: true, availableManagers: [], conflicts: [] };
    }

    const conflicts = await this.findConflicts(eventId, date, startTime, endTime, managers);
    const conflictingIds = new Set(conflicts.map(c => String(c.studentId)));

    const availableManagers = managers.map(m => typeof m === 'object' ? (m.userId || m.id) : m)
                                      .filter(id => id && !conflictingIds.has(String(id)));

    return {
      success: conflicts.length === 0,
      availableManagers,
      conflicts
    };
  }

  /**
   * Finds all schedule conflicts for a list of candidate managers.
   * @returns {Promise<Array>} Array of detailed conflict descriptions
   */
  static async findConflicts(eventId, date, startTime, endTime, managers = []) {
    if (!managers || !Array.isArray(managers) || managers.length === 0) return [];
    if (!date) return [];

    const conflictList = [];

    // Run schedule checks in parallel across all candidate managers
    await Promise.all(managers.map(async (mgr) => {
      const studentId = typeof mgr === 'object' ? (mgr.userId || mgr.id) : mgr;
      const studentName = typeof mgr === 'object' ? (mgr.name || mgr.userName || 'Student Manager') : String(mgr);
      if (!studentId) return;

      const { hasConflict, conflicts } = await ScheduleService.checkOverlap(studentId, date, startTime, endTime, eventId);

      if (hasConflict) {
        for (const c of conflicts) {
          conflictList.push({
            studentId: String(studentId),
            studentName,
            reason: c.reason || 'Already managing another event',
            code: c.code || 'MANAGER_ALREADY_ASSIGNED',
            ruleId: c.ruleId || 'RULE_MANAGER_OVERLAP',
            conflictingEvent: c.eventName || c.title || 'Overlapping commitment',
            startTime: c.startTime,
            endTime: c.endTime,
            date: c.date,
            type: c.type
          });
        }
      }
    }));

    return conflictList;
  }

  /**
   * Validates manager assignments before event saving or modification.
   * Throws a 409 Conflict error if any selected manager is unavailable.
   * Emits EventBus events ('manager.assignment.success' or 'manager.assignment.conflict').
   */
  static async validateManagerAssignments(eventId, date, startTime, endTime, managers = [], actor = {}) {
    if (!managers || !Array.isArray(managers) || managers.length === 0) {
      return { success: true, conflicts: [] };
    }

    // Only check managers who are not explicitly declined
    const activeManagers = managers.filter(m => {
      const status = typeof m === 'object' ? m.status : 'INVITED';
      return status !== 'DECLINED' && status !== 'REJECTED';
    });

    if (activeManagers.length === 0) {
      return { success: true, conflicts: [] };
    }

    const conflicts = await this.findConflicts(eventId, date, startTime, endTime, activeManagers);

    if (conflicts.length > 0) {
      // Emit conflict telemetry event
      eventBus.publish('manager.assignment.conflict', {
        entityId: `${eventId || 'new'}_mgr_conflict_${Date.now()}`,
        timestamp: Date.now(),
        eventId: eventId || 'new',
        date,
        startTime,
        endTime,
        conflicts,
        actorId: actor.userId || actor.id || 'system'
      });

      const error = new Error(`CONFLICT:Manager availability conflict. One or more selected student managers are already committed during this time window.`);
      error.status = 409;
      error.code = 'MANAGER_ALREADY_ASSIGNED';
      error.ruleId = 'RULE_MANAGER_OVERLAP';
      error.conflicts = conflicts;
      throw error;
    }

    // Emit success event for assigned managers
    if (eventId) {
      eventBus.publish('manager.assignment.success', {
        entityId: `${eventId}_mgrs_${Date.now()}`,
        timestamp: Date.now(),
        eventId,
        date,
        startTime,
        endTime,
        managerCount: activeManagers.length,
        actorId: actor.userId || actor.id || 'system'
      });
    }

    return {
      success: true,
      conflicts: []
    };
  }

  /**
   * Helper to clean up or log manager assignment removal.
   */
  static async removeManagerAssignment(eventId, managerId, actor = {}) {
    if (!eventId || !managerId) return;

    eventBus.publish('manager.assignment.removed', {
      entityId: `${eventId}_${managerId}`,
      timestamp: Date.now(),
      eventId,
      managerId,
      actorId: actor.userId || actor.id || 'system'
    });

    return { success: true };
  }
}

module.exports = ManagerAvailabilityService;
