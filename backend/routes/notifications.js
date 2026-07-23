const express = require('express');
const router = express.Router();
const { dbAdmin } = require('../firebaseAdmin');
const { NOTIFICATION_STATUS } = require('../utils/notificationConstants');
const analyticsService = require('../notifications/analytics/notificationAnalyticsService');
// Assuming some auth middleware exists, e.g., const authMiddleware = require('../middleware/authMiddleware');
// If not available, we assume the frontend passes a user ID or token. For now, we will expect a query param or body for simplicity,
// but in reality, it should use the auth middleware.

/**
 * GET /api/notifications/summary
 * Returns a lightweight summary of notifications for the current user.
 */
router.get('/summary', async (req, res) => {
  try {
    // Note: In production, use req.user.uid from authMiddleware
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const notificationsRef = dbAdmin.collection('notifications');
    
    // We want the unread count (status == DELIVERED)
    const unreadSnapshot = await notificationsRef
      .where('recipientId', '==', userId)
      .where('status', '==', NOTIFICATION_STATUS.DELIVERED)
      .get();
    
    let unreadCount = 0;
    let highPriorityCount = 0;
    let criticalCount = 0;

    unreadSnapshot.forEach(doc => {
      unreadCount++;
      const data = doc.data();
      if (data.priority === 'HIGH') highPriorityCount++;
      if (data.priority === 'CRITICAL') criticalCount++;
    });

    // Get the latest notification for the dropdown preview
    const latestSnapshot = await notificationsRef
      .where('recipientId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
      
    let latestNotification = null;
    if (!latestSnapshot.empty) {
      latestNotification = latestSnapshot.docs[0].data();
    }

    res.status(200).json({
      success: true,
      data: {
        unreadCount,
        highPriority: highPriorityCount,
        critical: criticalCount,
        latestNotification
      }
    });

  } catch (error) {
    console.error('[Notification Route] Error fetching summary:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

/**
 * POST /api/notifications/bulk-action
 * Performs bulk actions like MARK_ALL_READ, ARCHIVE_ALL
 */
router.post('/bulk-action', async (req, res) => {
  try {
    const { userId, action } = req.body;
    if (!userId || !action) {
      return res.status(400).json({ success: false, message: 'userId and action are required' });
    }

    const notificationsRef = dbAdmin.collection('notifications');
    const batch = dbAdmin.batch();
    
    if (action === 'MARK_ALL_READ') {
      const unreadSnapshot = await notificationsRef
        .where('recipientId', '==', userId)
        .where('status', '==', NOTIFICATION_STATUS.DELIVERED)
        .get();
        
      unreadSnapshot.forEach(doc => {
        batch.update(doc.ref, { 
          status: NOTIFICATION_STATUS.VIEWED,
          viewedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      
      if (unreadSnapshot.size > 0) {
        analyticsService.trackMetric('ENGAGEMENT', 'viewed', unreadSnapshot.size);
      }
      
      return res.status(200).json({ success: true, message: 'Marked all as read' });
    }
    
    if (action === 'ARCHIVE_ALL') {
      const viewedSnapshot = await notificationsRef
        .where('recipientId', '==', userId)
        .where('status', '==', NOTIFICATION_STATUS.VIEWED)
        .get();
        
      viewedSnapshot.forEach(doc => {
        batch.update(doc.ref, { 
          status: NOTIFICATION_STATUS.ARCHIVED,
          archivedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      
      if (viewedSnapshot.size > 0) {
        analyticsService.trackMetric('ENGAGEMENT', 'archived', viewedSnapshot.size);
      }
      
      return res.status(200).json({ success: true, message: 'Archived all read notifications' });
    }

    return res.status(400).json({ success: false, message: 'Invalid action' });
  } catch (error) {
    console.error('[Notification Route] Error performing bulk action:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
