const { dbAdmin } = require('../firebaseAdmin');
const ManagerAvailabilityService = require('./ManagerAvailabilityService');
const { getAllSectionDocs } = require('../utils/studentHelper');
const { getAllStaffDocs } = require('../utils/staffHelper');

/**
 * ManagerRecommendationService
 * Business rules and AI-ready recommendations for finding alternative student managers.
 * Decoupled from deterministic availability checks to allow future AI/ML enhancements.
 */
class ManagerRecommendationService {
  /**
   * Suggests available alternative managers sorted by: least workload -> department match -> availability.
   * @param {string} eventId - Current event ID (if editing)
   * @param {string} date - Event date (YYYY-MM-DD)
   * @param {string} startTime - Event start time (HH:mm)
   * @param {string} endTime - Event end time (HH:mm)
   * @param {string} department - Target department for preference (e.g., 'CSE')
   * @param {number} limit - Number of recommendations to return (default: 5)
   * @param {Array<string>} excludedIds - Array of user IDs to exclude (already selected)
   * @returns {Promise<Array>} Array of suggested manager objects ({ userId, name, email, department, workload })
   */
  static async suggestManagers(eventId, date, startTime, endTime, department = '', limit = 5, excludedIds = []) {
    try {
      const excludedSet = new Set(excludedIds.map(id => String(id)));

      // 1. Fetch active events to calculate manager workload (assignment counts)
      const eventsSnap = await dbAdmin.collection('events').get();
      const workloadMap = new Map(); // userId -> count
      const activeStatuses = ['POSTED', 'APPROVED', 'PENDING_MANAGERS', 'PENDING_FACULTY', 'PENDING_HOD', 'PENDING_IQAC', 'PENDING_PRINCIPAL', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED'];

      for (const doc of eventsSnap.docs) {
        const ev = doc.data();
        if (!activeStatuses.includes(ev.status)) continue;
        const mgrs = Array.isArray(ev.managers) ? ev.managers : [];
        for (const m of mgrs) {
          if (m && m.status !== 'DECLINED') {
            const mId = String(m.userId || m.id);
            workloadMap.set(mId, (workloadMap.get(mId) || 0) + 1);
          }
        }
      }

      // 2. Fetch potential student candidates
      const candidates = [];
      const sectionDocs = await getAllSectionDocs();

      for (const sec of sectionDocs) {
        const students = sec.data?.students || [];
        for (const s of students) {
          const sId = String(s.id || s.userId || s.uid || '');
          if (!sId || excludedSet.has(sId)) continue;
          
          const sDept = s.department || sec.dept || '';
          if (department && sDept.toLowerCase() !== department.toLowerCase()) continue;
          
          candidates.push({
            userId: sId,
            name: s.name || s.userName || 'Student',
            email: s.email || '',
            department: sDept,
            role: s.role || 'STUDENT_GENERAL',
            workload: workloadMap.get(sId) || 0
          });
        }
      }

      // 3. Fetch potential staff/faculty candidates
      const staffDocs = await getAllStaffDocs();
      for (const st of staffDocs) {
        const staffs = st.data?.staffs || [];
        for (const s of staffs) {
          const sId = String(s.id || s.userId || s.uid || '');
          if (!sId || excludedSet.has(sId)) continue;

          const sDept = s.department || st.category || '';
          if (department && sDept.toLowerCase() !== department.toLowerCase()) continue;

          candidates.push({
            userId: sId,
            name: s.name || 'Staff Member',
            email: s.email || '',
            department: sDept,
            role: s.role || 'FACULTY',
            workload: workloadMap.get(sId) || 0
          });
        }
      }

      // 3. Sort candidates:
      // Primary: Least workload (assignments count ASC)
      // Secondary: Same department (match == 0, non-match == 1)
      // Tertiary: Alphabetical by name
      candidates.sort((a, b) => {
        if (a.workload !== b.workload) {
          return a.workload - b.workload;
        }
        const aDeptMatch = (department && a.department && a.department.toLowerCase() === department.toLowerCase()) ? 0 : 1;
        const bDeptMatch = (department && b.department && b.department.toLowerCase() === department.toLowerCase()) ? 0 : 1;
        if (aDeptMatch !== bDeptMatch) {
          return aDeptMatch - bDeptMatch;
        }
        return a.name.localeCompare(b.name);
      });

      // 4. Select top candidate slice and filter by deterministic availability
      const topCandidates = candidates.slice(0, Math.max(30, limit * 3));
      const { availableManagers } = await ManagerAvailabilityService.checkAvailability(
        eventId,
        date,
        startTime,
        endTime,
        topCandidates.map(c => c.userId)
      );

      const availableSet = new Set(availableManagers.map(id => String(id)));

      const suggestions = [];
      for (const c of topCandidates) {
        if (availableSet.has(String(c.userId))) {
          suggestions.push(c);
          if (suggestions.length >= limit) break;
        }
      }

      return suggestions;
    } catch (err) {
      console.error('[ManagerRecommendationService] Error generating manager recommendations:', err);
      return [];
    }
  }
}

module.exports = ManagerRecommendationService;
