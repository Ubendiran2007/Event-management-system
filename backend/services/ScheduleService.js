const { dbAdmin } = require('../firebaseAdmin');

/**
 * ScheduleService
 * Centralized service for retrieving student and faculty schedules.
 * Aggregates active registered events, managed events, organized events, and approved OD events.
 * Fully optimized to run queries in parallel without N+1 reads.
 */
class ScheduleService {
  /**
   * Helper to determine if two date and time windows overlap.
   */
  static _isTimeOverlapping(dateA, startA, endA, dateB, startB, endB, endDateA = null, endDateB = null) {
    const dStartA = dateA || '';
    const dEndA = endDateA || dateA || '';
    const dStartB = dateB || '';
    const dEndB = endDateB || dateB || '';

    // If date ranges do not overlap at all
    if (dEndA < dStartB || dStartA > dEndB) {
      return false;
    }

    const sA = (startA || '00:00').trim();
    const eA = (endA || '23:59').trim();
    const sB = (startB || '00:00').trim();
    const eB = (endB || '23:59').trim();

    const startIsoA = `${dStartA}T${sA}`;
    const endIsoA = `${dEndA}T${eA}`;
    const startIsoB = `${dStartB}T${sB}`;
    const endIsoB = `${dEndB}T${eB}`;

    return (startIsoA < endIsoB) && (endIsoA > startIsoB);
  }

  /**
   * Retrieves all active schedule items for a student.
   * @param {string} studentId - User ID of the student
   * @param {object} dateRange - Optional { startDate, endDate } filter
   * @returns {Promise<Array>} Array of standardized schedule items
   */
  static async getStudentSchedule(studentId, dateRange = {}) {
    if (!studentId) return [];

    try {
      // Execute parallel queries against eventRegistrations, events, and odRequests
      const [regSnap, eventsSnap, odSnap] = await Promise.all([
        dbAdmin.collection('eventRegistrations').where('userId', '==', studentId).get(),
        dbAdmin.collection('events').get(),
        dbAdmin.collection('odRequests').where('status', '==', 'APPROVED').get()
      ]);

      const scheduleItems = [];

      // 1. Process Registrations
      const activeRegStatuses = ['REGISTERED', 'APPROVED', 'OD_APPROVED', 'ATTENDED'];
      const registeredEventIds = new Set();

      for (const doc of regSnap.docs) {
        const data = doc.data();
        if (activeRegStatuses.includes(data.status)) {
          registeredEventIds.add(String(data.eventId));
        }
      }

      // 2. Process Events (matching registrations, manager assignments, or organized events)
      const activeEventStatuses = ['POSTED', 'APPROVED', 'PENDING_FACULTY', 'PENDING_HOD', 'PENDING_IQAC', 'PENDING_PRINCIPAL', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED'];

      for (const doc of eventsSnap.docs) {
        const ev = doc.data();
        const evId = doc.id;

        if (!activeEventStatuses.includes(ev.status)) continue;

        const evDate = ev.requisition?.step1?.eventStartDate || ev.date || '';
        const evEndDate = ev.requisition?.step1?.eventEndDate || evDate;
        const startTime = ev.requisition?.step1?.eventStartTime || ev.startTime || '00:00';
        const endTime = ev.requisition?.step1?.eventEndTime || ev.endTime || '23:59';
        const title = ev.requisition?.step1?.eventTitle || ev.title || ev.name || 'Untitled Event';
        const venue = ev.requisition?.step1?.venue || ev.venue || 'TBD';

        // Filter by optional dateRange
        if (dateRange.startDate && evEndDate < dateRange.startDate) continue;
        if (dateRange.endDate && evDate > dateRange.endDate) continue;

        // Check if registered
        if (registeredEventIds.has(String(evId))) {
          scheduleItems.push({
            id: `reg_${evId}_${studentId}`,
            eventId: evId,
            title,
            type: 'REGISTRATION',
            role: 'Participant',
            date: evDate,
            endDate: evEndDate,
            startTime,
            endTime,
            venue,
            status: 'REGISTERED'
          });
        }

        // Check if managing
        const managers = Array.isArray(ev.managers) ? ev.managers : [];
        const isManager = managers.some(m => 
          (String(m.userId) === String(studentId) || String(m.id) === String(studentId)) && 
          m.status !== 'DECLINED'
        );

        if (isManager) {
          scheduleItems.push({
            id: `mgr_${evId}_${studentId}`,
            eventId: evId,
            title,
            type: 'MANAGED_EVENT',
            role: 'Student Manager',
            date: evDate,
            endDate: evEndDate,
            startTime,
            endTime,
            venue,
            status: 'ASSIGNED'
          });
        }

        // Check if organizer
        if (String(ev.organizerId) === String(studentId)) {
          scheduleItems.push({
            id: `org_${evId}_${studentId}`,
            eventId: evId,
            title,
            type: 'ORGANIZED_EVENT',
            role: 'Organizer',
            date: evDate,
            endDate: evEndDate,
            startTime,
            endTime,
            venue,
            status: ev.status
          });
        }
      }

      // 3. Process Approved OD Requests (if not already captured as an event item above)
      for (const doc of odSnap.docs) {
        const od = doc.data();
        if (String(od.studentId) === String(studentId) || String(od.userId) === String(studentId)) {
          const odDate = od.date || od.eventDate || '';
          if (!odDate) continue;

          if (dateRange.startDate && odDate < dateRange.startDate) continue;
          if (dateRange.endDate && odDate > dateRange.endDate) continue;

          // Avoid duplicate display if already added as REGISTRATION
          if (!scheduleItems.some(item => String(item.eventId) === String(od.eventId))) {
            scheduleItems.push({
              id: `od_${doc.id}`,
              eventId: od.eventId || doc.id,
              title: od.eventName || od.eventTitle || 'Approved OD Duty',
              type: 'OD_APPROVED',
              role: 'On Duty',
              date: odDate,
              endDate: odDate,
              startTime: od.startTime || '08:00',
              endTime: od.endTime || '18:00',
              venue: 'Campus',
              status: 'APPROVED'
            });
          }
        }
      }

      // Sort chronologically by date and start time
      scheduleItems.sort((a, b) => {
        const timeA = `${a.date}T${a.startTime}`;
        const timeB = `${b.date}T${b.startTime}`;
        return timeA.localeCompare(timeB);
      });

      return scheduleItems;
    } catch (err) {
      console.error('[ScheduleService] Error fetching student schedule:', err);
      throw err;
    }
  }

  /**
   * Retrieves all active schedule items for a faculty member.
   */
  static async getFacultySchedule(facultyId, dateRange = {}) {
    if (!facultyId) return [];

    try {
      const eventsSnap = await dbAdmin.collection('events').get();
      const scheduleItems = [];
      const activeEventStatuses = ['POSTED', 'APPROVED', 'PENDING_FACULTY', 'PENDING_HOD', 'PENDING_IQAC', 'PENDING_PRINCIPAL', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED'];

      for (const doc of eventsSnap.docs) {
        const ev = doc.data();
        const evId = doc.id;

        if (!activeEventStatuses.includes(ev.status)) continue;

        const evDate = ev.requisition?.step1?.eventStartDate || ev.date || '';
        const evEndDate = ev.requisition?.step1?.eventEndDate || evDate;
        const startTime = ev.requisition?.step1?.eventStartTime || ev.startTime || '00:00';
        const endTime = ev.requisition?.step1?.eventEndTime || ev.endTime || '23:59';
        const title = ev.requisition?.step1?.eventTitle || ev.title || ev.name || 'Untitled Event';
        const venue = ev.requisition?.step1?.venue || ev.venue || 'TBD';

        if (dateRange.startDate && evEndDate < dateRange.startDate) continue;
        if (dateRange.endDate && evDate > dateRange.endDate) continue;

        if (String(ev.organizerId) === String(facultyId) || String(ev.facultyCoordinatorId) === String(facultyId)) {
          scheduleItems.push({
            id: `fac_${evId}_${facultyId}`,
            eventId: evId,
            title,
            type: 'FACULTY_DUTY',
            role: String(ev.organizerId) === String(facultyId) ? 'Organizer' : 'Coordinator',
            date: evDate,
            endDate: evEndDate,
            startTime,
            endTime,
            venue,
            status: ev.status
          });
        }
      }

      scheduleItems.sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
      return scheduleItems;
    } catch (err) {
      console.error('[ScheduleService] Error fetching faculty schedule:', err);
      throw err;
    }
  }

  /**
   * Retrieves chronological daily items for a user on a specific date.
   */
  static async getDailySchedule(userId, date) {
    if (!userId || !date) return [];
    const schedule = await this.getStudentSchedule(userId, { startDate: date, endDate: date });
    return schedule.filter(item => item.date <= date && (item.endDate || item.date) >= date);
  }

  /**
   * Retrieves structured time intervals for conflict comparison.
   */
  static async getTimeline(userId, date) {
    const dailyItems = await this.getDailySchedule(userId, date);
    return dailyItems.map(item => ({
      id: item.id,
      eventId: item.eventId,
      title: item.title,
      type: item.type,
      role: item.role,
      startTime: item.startTime,
      endTime: item.endTime,
      date: item.date,
      endDate: item.endDate
    }));
  }

  /**
   * Convenience check if a user has any schedule overlap with a specified date/time window.
   */
  static async checkOverlap(userId, date, startTime, endTime, excludeEventId = null) {
    const schedule = await this.getStudentSchedule(userId);
    const conflicts = [];

    for (const item of schedule) {
      if (excludeEventId && String(item.eventId) === String(excludeEventId)) continue;

      if (this._isTimeOverlapping(date, startTime, endTime, item.date, item.startTime, item.endTime, date, item.endDate)) {
        const reason = item.type === 'REGISTRATION' ? 'Already participating in another event' :
                       item.type === 'MANAGED_EVENT' ? 'Already managing another event' :
                       item.type === 'OD_APPROVED' ? 'Student already has approved OD' :
                       'Schedule conflict';
        const code = item.type === 'REGISTRATION' ? 'STUDENT_ALREADY_REGISTERED' :
                     item.type === 'MANAGED_EVENT' ? 'MANAGER_ALREADY_ASSIGNED' :
                     item.type === 'OD_APPROVED' ? 'STUDENT_ON_APPROVED_OD' :
                     'SCHEDULE_OVERLAP_CONFLICT';
        const ruleId = item.type === 'REGISTRATION' ? 'RULE_REGISTRATION_OVERLAP' :
                       item.type === 'MANAGED_EVENT' ? 'RULE_MANAGER_OVERLAP' :
                       item.type === 'OD_APPROVED' ? 'RULE_OD_OVERLAP' :
                       'RULE_GENERAL_OVERLAP';

        conflicts.push({
          eventId: item.eventId,
          eventName: item.title,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          type: item.type,
          role: item.role,
          reason,
          code,
          ruleId
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }
}

module.exports = ScheduleService;
