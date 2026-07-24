const express = require('express');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Enforce authentication for all routes in this router
router.use(requireAuth);

const { dbAdmin } = require('../firebaseAdmin');
const { collection, query, where, orderBy, limit, startAfter, getDocs, db } = require('../firebaseClientWrapper');
const { NOTIFICATION_STATUS } = require('../utils/notificationConstants');
const analyticsService = require('../notifications/analytics/notificationAnalyticsService');

const getUserId = (req) => {
  const userId = req.query.userId || req.body.userId;
  if (!userId) throw new Error('userId is required');
  return userId;
};

// GET /api/notifications
// Supports query params: limit, status, category, priority
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const limitNum = parseInt(req.query.limit) || 20;
    const { status, category, priority, startAfter: startAfterParam } = req.query;

    const constraints = [where('recipientId', '==', userId)];
    if (status) constraints.push(where('status', '==', status));
    if (category) constraints.push(where('category', '==', category));
    if (priority) constraints.push(where('priority', '==', priority));

    constraints.push(orderBy('createdAt', 'desc'));

    if (startAfterParam) {
      const startAfterDoc = await dbAdmin.collection('notifications').doc(startAfterParam).get();
      if (startAfterDoc.exists) {
        constraints.push(startAfter(startAfterDoc));
      }
    }

    constraints.push(limit(limitNum));
    const snapshot = await getDocs(query(collection(db, 'notifications'), ...constraints));

    const notifications = [];
    snapshot.forEach(doc => notifications.push({ id: doc.id, ...doc.data() }));

    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error('[Notification Route] GET / error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/notifications/unread
// Gets the unread count and latest notification preview
router.get('/unread', async (req, res) => {
  try {
    const userId = getUserId(req);
    const notificationsRef = dbAdmin.collection('notifications');

    const unreadSnapshot = await getDocs(query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('status', '==', NOTIFICATION_STATUS.DELIVERED)
    ));

    const latestSnapshot = await getDocs(query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(10)
    ));
      
    const latest = [];
    latestSnapshot.forEach(doc => latest.push({ id: doc.id, ...doc.data() }));

    res.status(200).json({
      success: true,
      unreadCount: unreadSnapshot.size,
      latest
    });
  } catch (error) {
    console.error('[Notification Route] GET /unread error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
  try {
    const userId = getUserId(req);
    const notificationsRef = dbAdmin.collection('notifications');
    const batch = dbAdmin.batch();

    const unreadSnapshot = await getDocs(query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('status', '==', NOTIFICATION_STATUS.DELIVERED)
    ));

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

    res.status(200).json({ success: true, message: 'All marked as read' });
  } catch (error) {
    console.error('[Notification Route] PATCH /read-all error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = dbAdmin.collection('notifications').doc(id);
    await docRef.update({
      status: NOTIFICATION_STATUS.VIEWED,
      viewedAt: new Date().toISOString()
    });
    analyticsService.trackMetric('ENGAGEMENT', 'viewed', 1);
    res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (error) {
    console.error('[Notification Route] PATCH /:id/read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/notifications/:id/archive
router.patch('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = dbAdmin.collection('notifications').doc(id);
    await docRef.update({
      status: NOTIFICATION_STATUS.ARCHIVED,
      archivedAt: new Date().toISOString()
    });
    analyticsService.trackMetric('ENGAGEMENT', 'archived', 1);
    res.status(200).json({ success: true, message: 'Archived' });
  } catch (error) {
    console.error('[Notification Route] PATCH /:id/archive error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await dbAdmin.collection('notifications').doc(id).delete();
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('[Notification Route] DELETE /:id error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== ADMIN TOOLS ====================

// POST /api/notifications/test
// Triggers a test notification (bypassing the EventBus for immediate delivery testing)
router.post('/test', async (req, res) => {
  try {
    const { userId, title, message } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    // We can directly use the DeliveryManager here, but to keep it decoupled from the route,
    // we'll just insert a raw notification and let the frontend see it.
    // In a real scenario, this would hit the DeliveryManager.dispatch.
    const notif = {
      recipientId: userId,
      title: title || 'Test Notification',
      message: message || 'This is a test notification from Admin Tools.',
      category: 'SYSTEM',
      priority: 'HIGH',
      status: NOTIFICATION_STATUS.DELIVERED,
      createdAt: new Date().toISOString()
    };
    await dbAdmin.collection('notifications').add(notif);
    res.status(200).json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    console.error('[Admin Tools] POST /test error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/notifications/broadcast
router.post('/broadcast', async (req, res) => {
  try {
    const { title, message, priority, type } = req.body;
    // For a real broadcast, this would query all users or specific roles and dispatch.
    // Since we're demonstrating the tool, we'll just mock success.
    console.log(`[Admin Tools] Broadcasting: ${title} (${type}) with priority ${priority}`);
    res.status(200).json({ success: true, message: `Broadcast sent to queue.` });
  } catch (error) {
    console.error('[Admin Tools] POST /broadcast error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/notifications/queue-status
router.get('/queue-status', async (req, res) => {
  try {
    // Mocking queue status for Admin Dashboard
    res.status(200).json({
      success: true,
      data: {
        active: Math.floor(Math.random() * 5),
        waiting: Math.floor(Math.random() * 20),
        delayed: 0,
        failed: Math.floor(Math.random() * 2)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/notifications/dlq
router.get('/dlq', async (req, res) => {
  try {
    // Mocking DLQ
    res.status(200).json({
      success: true,
      data: [
        {
          id: 'dlq-1',
          recipientId: 'student_123',
          error: 'SES Rate Limit Exceeded',
          failedAt: new Date().toISOString()
        }
      ]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
