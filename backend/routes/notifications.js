const express = require('express');
const crypto = require('crypto');
const { requireAuth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Enforce authentication for all routes in this router
router.use(requireAuth);

const { dbAdmin } = require('../firebaseAdmin');
const { collection, doc, getDoc, query, where, orderBy, limit, startAfter, getDocs, runTransaction, arrayUnion, db } = require('../firebaseClientWrapper');
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

// ==================== GROUP / REGISTRATION FINALIZATION NOTIFICATION ADMIN ====================
// These endpoints operate on the `eventNotifications` collection produced by
// GroupNotificationDispatcher.dispatchFinalizeNotifications (per-event batch jobs).

// GET /api/notifications/group
// List event-level group notifications (admin/auditor/iqac/hod + organizer of the event).
// Query params: eventId, status (PENDING|PROCESSING|PARTIAL|COMPLETED|FAILED), limit, pageToken.
router.get('/group', requireRole(['STUDENT_ORGANIZER', 'FACULTY', 'HOD', 'IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  try {
    const limitNum = Math.max(1, Math.min(100, parseInt(req.query.limit) || 25));
    const { eventId, status } = req.query;
    const actingRole = req.user.role;
    const constraints = [];

    // Scope for non-admin/non-IQAC roles
    if (!['SYSTEM_ADMIN', 'IQAC_TEAM'].includes(actingRole)) {
      constraints.push(where('actor.uid', '==', String(req.user.id)));
    }
    if (eventId) constraints.push(where('eventId', '==', String(eventId)));
    if (status) constraints.push(where('status', '==', String(status)));
    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(limitNum));

    const snap = await getDocs(query(collection(db, 'eventNotifications'), ...constraints));
    const items = [];
    snap.forEach(d => {
      const data = d.data();
      items.push({
        id: d.id,
        eventId: data.eventId,
        status: data.status,
        progress: data.progress || null,
        summary: data.summary || null,
        createdAt: data.createdAt,
        finalizedAt: data.finalizedAt,
        actor: data.actor || null,
        mode: data.deliveryMode || null,
        errors: (data.errors || []).slice(0, 25)
      });
    });
    return res.json({ success: true, items, total: items.length });
  } catch (error) {
    console.error('[notifications/group] GET error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/notifications/group/:notificationId
// Full detail including per-batch status and recipient list.
router.get('/group/:notificationId', requireRole(['STUDENT_ORGANIZER', 'FACULTY', 'HOD', 'IQAC_TEAM', 'SYSTEM_ADMIN']), async (req, res) => {
  try {
    const { notificationId } = req.params;
    const ref = doc(db, 'eventNotifications', notificationId);
    const snap = await getDoc(ref);
    if (!snap.exists) return res.status(404).json({ success: false, message: 'Notification not found' });
    const data = snap.data();

    // Scope check: non-admins can only view their own notifications
    if (!['SYSTEM_ADMIN', 'IQAC_TEAM'].includes(req.user.role)) {
      if (String(data.actor?.uid || '') !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }

    const batches = (data.batches || []).map(b => ({
      batchId: b.batchId,
      groupType: b.groupType,
      totalRecipients: b.totalRecipients,
      status: b.status,
      attemptCount: b.attemptCount || 0,
      lastAttemptedAt: b.lastAttemptedAt || null,
      completedAt: b.completedAt || null,
      error: b.error || null,
      recipientCount: (b.recipients || []).length
    }));

    return res.json({
      success: true,
      id: snap.id,
      ...data,
      batches
    });
  } catch (error) {
    console.error('[notifications/group/:id] GET error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/notifications/group/:notificationId/resume
// Resume a PARTIAL or PROCESSING notification: retries only FAILED|RETRYING batches.
// Safe idempotency: completed batches inside the same notificationId are skipped.
router.post('/group/:notificationId/resume', requireRole(['SYSTEM_ADMIN', 'IQAC_TEAM']), async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notifRef = doc(db, 'eventNotifications', notificationId);
    const nowIso = new Date().toISOString();

    const result = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(notifRef);
      if (!snap.exists) throw new Error('NOT_FOUND:Notification not found');
      const data = snap.data();
      if (!['PROCESSING', 'PARTIAL', 'FAILED'].includes(data.status || '')) {
        throw new Error(`BAD_REQUEST:Cannot resume a notification with status '${data.status}'. Only PROCESSING, PARTIAL, or FAILED can be retried.`);
      }
      const batches = Array.isArray(data.batches) ? data.batches : [];
      const retryableBatches = batches.filter(b => ['FAILED', 'RETRYING'].includes(b.status) && (b.attemptCount || 0) < 10);
      if (retryableBatches.length === 0) {
        throw new Error(`NO_OP:No retryable batches. All batches completed or exceeded max retries.`);
      }
      const resetBatches = batches.map(b => {
        const isRetryable = retryableBatches.find(r => r.batchId === b.batchId);
        if (isRetryable) {
          return { ...b, status: 'PENDING', error: null, nextRetryAfter: null };
        }
        return b;
      });
      const updatedProgress = {
        ...(data.progress || {}),
        state: 'RESUMED',
        resumedAt: nowIso,
        resumedBy: { uid: req.user.id, name: req.user.name || req.user.email, role: req.user.role, department: req.user.department }
      };
      const updatedStatus = retryableBatches.length === batches.length
        ? 'PENDING'
        : (data.status === 'FAILED' ? 'FAILED' : 'PARTIAL'); // Will be progressed to PROCESSING by worker

      transaction.update(notifRef, {
        status: updatedStatus,
        batches: resetBatches,
        progress: updatedProgress,
        resumeRequestedAt: nowIso,
        resumeRequestedBy: { uid: req.user.id, name: req.user.name || req.user.email, role: req.user.role },
        updatedAt: nowIso,
        timeline: arrayUnion({
          at: nowIso,
          event: 'ADMIN_RESUME',
          detail: `${retryableBatches.length} batch(es) reset to PENDING for retry.`,
          by: { uid: req.user.id, name: req.user.name || req.user.email, role: req.user.role }
        })
      });
      return { retryableCount: retryableBatches.length };
    });

    // Kick the scheduler immediately so retry doesn't wait 5 minutes
    try {
      const NotificationScheduler = require('../services/NotificationScheduler');
      if (NotificationScheduler && typeof NotificationScheduler.resumeInterruptedNotifications === 'function') {
        // Fire-and-forget; scheduler will pick up the PENDING batches next tick, but also try to
        // run them inline asynchronously to improve latency.
        setImmediate(() => NotificationScheduler.resumeInterruptedNotifications().catch(() => {}));
      }
    } catch (_) { /* ignore */ }

    try {
      const { logAudit } = require('../utils/logger');
      await logAudit({
        category: 'NOTIFICATION',
        action: 'GROUP_NOTIFICATION_RESUME',
        status: 'SUCCESS',
        severity: 'HIGH',
        correlationId: notificationId,
        requestId: crypto.randomUUID(),
        actor: { userId: req.user.id, name: req.user.name || req.user.email, role: req.user.role, department: req.user.department },
        target: { entityType: 'EVENT_NOTIFICATION', entityId: notificationId },
        details: { retryableBatches: result.retryableCount },
        ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null
      });
    } catch (_) { /* swallow audit double-fault */ }

    return res.json({
      success: true,
      message: `Resumed ${result.retryableCount} batch(es). Retry queue processing.`,
      retryableCount: result.retryableCount
    });
  } catch (error) {
    if (error.message.includes('NO_OP')) return res.status(200).json({ success: true, message: error.message.split(':')[1] });
    if (error.message.includes('NOT_FOUND')) return res.status(404).json({ success: false, message: error.message.split(':')[1] });
    if (error.message.includes('BAD_REQUEST')) return res.status(400).json({ success: false, message: error.message.split(':')[1] });
    console.error('[notifications/group/:id/resume] POST error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
