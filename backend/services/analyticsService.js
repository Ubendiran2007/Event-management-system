const { db } = require('../firebaseClientWrapper');
const { collection, query, where, getDocs, getCountFromServer, and, or } = require('firebase-admin/firestore');
const { EventStatus } = require('../events/constants/eventTypes');


class AnalyticsService {
  /**
   * Fetch Operational Analytics (Real-time data for Dashboard)
   */
  static async getOperationalAnalytics() {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      const eventsRef = collection(db, 'events');
      
      // 1. Events Today
      const todayQuery = query(
        eventsRef,
        where('startDate', '>=', today.toISOString()),
        where('startDate', '<=', endOfToday.toISOString()),
        where('status', 'in', ['APPROVED', 'PUBLISHED', 'RUNNING', 'ENDED'])
      );
      const eventsTodaySnap = await getCountFromServer(todayQuery);
      const eventsToday = eventsTodaySnap.data().count;

      // 2. Pending Verifications
      const pendingQuery = query(
        eventsRef,
        where('status', 'in', [
          'PENDING_FACULTY_VERIFICATION',
          'PENDING_HOD_VERIFICATION',
          'PENDING_IQAC_VERIFICATION'
        ])
      );
      const pendingSnap = await getCountFromServer(pendingQuery);
      const pendingVerification = pendingSnap.data().count;

      // 3. Active Venue Reservations
      const reservationsRef = collection(db, 'venueReservations');
      const activeResQuery = query(
        reservationsRef,
        where('status', '==', 'RESERVED'),
        where('expiresAt', '>=', new Date().toISOString())
      );
      const activeResSnap = await getCountFromServer(activeResQuery);
      const activeReservations = activeResSnap.data().count;

      return {
        eventsToday,
        pendingVerification,
        activeReservations,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[AnalyticsService] Error fetching operational analytics:', error);
      throw error;
    }
  }

  /**
   * Fetch Reporting Analytics (Heavy aggregation, usually called periodically or on-demand by admins)
   * Note: In a production app with high load, this might be pre-calculated by a cron job
   * and stored in an 'analytics' collection. Here we perform a dynamic query.
   */
  static async getReportingAnalytics(month, year, department) {
    try {
      // Create a dynamic date range
      const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0).toISOString();
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

      const eventsRef = collection(db, 'events');
      let baseQuery = query(
        eventsRef,
        where('createdAt', '>=', startOfMonth),
        where('createdAt', '<=', endOfMonth)
      );

      // We actually need all data to aggregate it in memory, since Firestore doesn't support complex GROUP BY out of the box
      const snapshot = await getDocs(baseQuery);
      
      let totalEvents = 0;
      let completedEvents = 0;
      const deptStats = {};
      const organizerStats = {};
      const venueUtilization = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Filter by department if passed
        if (department && data.department !== department) return;

        totalEvents++;
        if (data.status === 'COMPLETED' || data.status === 'ARCHIVED') completedEvents++;

        // Department Stats
        const dept = data.department || 'GEN';
        if (!deptStats[dept]) deptStats[dept] = { total: 0, completed: 0, participants: 0 };
        deptStats[dept].total++;
        if (data.status === 'COMPLETED' || data.status === 'ARCHIVED') deptStats[dept].completed++;
        if (data.postEventData?.attendance?.count) deptStats[dept].participants += data.postEventData.attendance.count;

        // Organizer Stats
        const org = data.ownerId || 'Unknown';
        if (!organizerStats[org]) organizerStats[org] = { total: 0, completed: 0, ownerEmail: data.owner };
        organizerStats[org].total++;
        if (data.status === 'COMPLETED' || data.status === 'ARCHIVED') organizerStats[org].completed++;

        // Venue Utilization
        if (data.venueId) {
          if (!venueUtilization[data.venueId]) venueUtilization[data.venueId] = { count: 0, venueName: data.venueName };
          venueUtilization[data.venueId].count++;
        }
      });

      return {
        period: { month, year },
        totalEvents,
        completedEvents,
        completionRate: totalEvents ? ((completedEvents / totalEvents) * 100).toFixed(2) : 0,
        departmentStatistics: deptStats,
        organizerPerformance: organizerStats,
        venueUtilization,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('[AnalyticsService] Error fetching reporting analytics:', error);
      throw error;
    }
  }
}

module.exports = AnalyticsService;
