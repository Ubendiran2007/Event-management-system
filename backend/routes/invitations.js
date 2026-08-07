const express = require('express');
const router = express.Router();
const { db, doc, getDoc, updateDoc, collection, query, where, limit, getDocs } = require('../firebaseClientWrapper');
const { authenticateToken } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const crypto = require('crypto');
const { sendManagerAcceptedEmail, sendManagerDeclinedEmail } = require('../services/emailService');
const { executeBackgroundNotification, handleEventStatusChange } = require('../services/emailHandler');
const eventPublisher = require('../events/publishers/eventPublisher');

// Helper to fetch faculty email
async function getFacultyEmailByName(facultyName) {
  if (!facultyName || !db) return null;
  try {
    const coordsSnap = await getDocs(query(collection(db, 'coordinators'), where('name', '==', facultyName), limit(1)));
    if (!coordsSnap.empty) return coordsSnap.docs[0].data().email || null;
    const usersSnap = await getDocs(query(collection(db, 'users'), where('name', '==', facultyName), where('role', '==', 'FACULTY'), limit(1)));
    if (!usersSnap.empty) return usersSnap.docs[0].data().email || null;
  } catch (err) {
    console.error('Error finding faculty email:', err);
  }
  return null;
}

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

    let nextStatus = null;
    if (eventData.status === 'PENDING_MANAGERS') {
      nextStatus = eventData.creatorType === 'FACULTY' ? 'PENDING_HOD' : 'PENDING_FACULTY';
      await updateDoc(eventRef, { managers, status: nextStatus, updatedAt: new Date().toISOString() });
    } else {
      await updateDoc(eventRef, { managers });
    }

    if (eventData.organizerEmail) {
      executeBackgroundNotification('invitations/accept', async () => {
        await sendManagerAcceptedEmail(eventData.organizerEmail, { id: eventSnap.id, ...eventData }, req.user.name || req.user.email);
        
        // If we advanced the state, notify the next approvers!
        if (nextStatus) {
          const payloadWithId = { id: eventSnap.id, ...eventData, managers, status: nextStatus };
          let targetApproverId = null;
          
          if (nextStatus === 'PENDING_FACULTY') {
            let facultyEmail = payloadWithId.coordinator?.facultyEmail || payloadWithId.coordinator?.faculty_email || payloadWithId.facultyEmail || null;
            if (typeof facultyEmail === 'string') facultyEmail = facultyEmail.trim().toLowerCase();
            if (!facultyEmail && payloadWithId.coordinator?.facultyName) {
              facultyEmail = await getFacultyEmailByName(String(payloadWithId.coordinator.facultyName).trim());
            }
            targetApproverId = facultyEmail;
            payloadWithId.coordinator = { ...payloadWithId.coordinator, facultyEmail };
          }
          
          eventPublisher.publishEventCreated({
            eventId: payloadWithId.id,
            organizerId: payloadWithId.organizerId || 'unknown',
            eventTitle: payloadWithId.title || payloadWithId.eventName,
            eventType: payloadWithId.eventType,
            department: payloadWithId.department,
            targetApprovers: targetApproverId ? [targetApproverId] : [],
            correlationId: crypto.randomUUID()
          });

          await handleEventStatusChange(payloadWithId, 'PENDING_MANAGERS', nextStatus);
        }
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
