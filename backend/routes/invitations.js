const express = require('express');
const router = express.Router();
const { db, doc, getDoc, updateDoc } = require('../firebaseClientWrapper');
const { authenticateToken } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const crypto = require('crypto');
const { sendManagerAcceptedEmail, sendManagerDeclinedEmail } = require('../services/emailService');
const { executeBackgroundNotification } = require('../services/emailHandler');

// Accept Invitation
router.post('/:eventId/accept', authenticateToken, async (req, res) => {
  try {
    const eventRef = doc(db, 'events', req.params.eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    if (!eventData.managers) {
      return res.status(400).json({ success: false, message: 'No managers found for this event' });
    }

    const managerIndex = eventData.managers.findIndex(m => m.email === req.user.email);
    if (managerIndex === -1) {
      return res.status(403).json({ success: false, message: 'You are not invited to manage this event' });
    }

    if (eventData.managers[managerIndex].status === 'ACCEPTED') {
      return res.json({ success: true, message: 'Invitation already accepted' });
    }

    const managers = [...eventData.managers];
    managers[managerIndex].status = 'ACCEPTED';

    await updateDoc(eventRef, { managers });

    if (eventData.organizerEmail) {
      executeBackgroundNotification('invitations/accept', async () => {
        await sendManagerAcceptedEmail(eventData.organizerEmail, { id: eventSnap.id, ...eventData }, req.user.name || req.user.email);
      });
    }

    logActivity({
      category: 'EVENT',
      action: 'MANAGER_ACCEPTED',
      status: 'SUCCESS',
      actor: { userId: req.user.id, name: req.user.name, role: req.user.role },
      target: { entityType: 'EVENT', entityId: eventSnap.id },
      details: { managerEmail: req.user.email }
    });

    res.json({ success: true, message: 'Invitation accepted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Decline Invitation
router.post('/:eventId/decline', authenticateToken, async (req, res) => {
  try {
    const eventRef = doc(db, 'events', req.params.eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    if (!eventData.managers) {
      return res.status(400).json({ success: false, message: 'No managers found for this event' });
    }

    const managerIndex = eventData.managers.findIndex(m => m.email === req.user.email);
    if (managerIndex === -1) {
      return res.status(403).json({ success: false, message: 'You are not invited to manage this event' });
    }

    if (eventData.managers[managerIndex].status === 'DECLINED') {
      return res.json({ success: true, message: 'Invitation already declined' });
    }

    const managers = [...eventData.managers];
    managers[managerIndex].status = 'DECLINED';

    await updateDoc(eventRef, { managers });

    if (eventData.organizerEmail) {
      executeBackgroundNotification('invitations/decline', async () => {
        await sendManagerDeclinedEmail(eventData.organizerEmail, { id: eventSnap.id, ...eventData }, req.user.name || req.user.email);
      });
    }

    logActivity({
      category: 'EVENT',
      action: 'MANAGER_DECLINED',
      status: 'SUCCESS',
      actor: { userId: req.user.id, name: req.user.name, role: req.user.role },
      target: { entityType: 'EVENT', entityId: eventSnap.id },
      details: { managerEmail: req.user.email }
    });

    res.json({ success: true, message: 'Invitation declined' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
