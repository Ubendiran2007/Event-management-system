const express = require('express');
const router = express.Router();
const { db, doc, getDoc, updateDoc, setDoc, collection, query, where, limit, getDocs } = require('../firebaseClientWrapper');
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

// Revoke Request
router.post('/:eventId/revoke-request', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const eventRef = doc(db, 'events', req.params.eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();
    if (!eventData.managers) return res.status(400).json({ success: false, message: 'No managers found' });

    const managerIndex = eventData.managers.findIndex(m => m.email === req.user.email);
    if (managerIndex === -1) return res.status(403).json({ success: false, message: 'Not a manager' });

    if (eventData.managers[managerIndex].status !== 'ACCEPTED') {
      return res.status(400).json({ success: false, message: 'Only accepted managers can request revocation' });
    }

    const managers = [...eventData.managers];
    managers[managerIndex].status = 'REVOKE_PENDING';
    managers[managerIndex].revokeReason = reason || '';

    await updateDoc(eventRef, { managers });

    // Send notification to organizer
    if (eventData.organizerId) {
      const notifId = `revoke_req_${eventData.id}_${Date.now()}`;
      await setDoc(doc(db, 'notifications', notifId), {
        recipientId: String(eventData.organizerId),
        type: 'MANAGER_REVOKE_REQUEST',
        category: 'EVENT',
        priority: 'HIGH',
        title: 'Manager Revocation Request',
        message: `${req.user.name} has requested to revoke their management of "${eventData.title}". Reason: ${reason || 'None provided'}`,
        eventId: eventData.id || null,
        eventTitle: eventData.title || '',
        deepLink: `/student/approvals`, // Will open event details
        status: 'DELIVERED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    logActivity({
      category: 'EVENT', action: 'MANAGER_REVOKE_REQUESTED', status: 'SUCCESS',
      actor: { userId: req.user.id, name: req.user.name, role: req.user.role },
      target: { entityType: 'EVENT', entityId: eventSnap.id }
    });

    res.json({ success: true, message: 'Revoke request sent' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve Revoke
router.post('/:eventId/approve-revoke', authenticateToken, async (req, res) => {
  try {
    const { managerEmail, reason } = req.body;
    const eventRef = doc(db, 'events', req.params.eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();
    // Only organizer or faculty can approve
    if (eventData.organizerId !== req.user.id && req.user.role !== 'FACULTY') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const managerIndex = eventData.managers.findIndex(m => m.email === managerEmail);
    if (managerIndex === -1) return res.status(404).json({ success: false, message: 'Manager not found' });

    const managers = [...eventData.managers];
    managers[managerIndex].status = 'REVOKED';
    managers[managerIndex].revokeApprovalReason = reason || '';

    // Check if we need to revert event status
    const activeManagers = managers.filter(m => m.status === 'ACCEPTED');
    let nextStatus = eventData.status;
    
    // If no active managers and event has already advanced past PENDING_MANAGERS
    if (activeManagers.length === 0 && !['DRAFT', 'PENDING_MANAGERS'].includes(eventData.status)) {
      nextStatus = 'PENDING_MANAGERS';
    }

    await updateDoc(eventRef, { managers, status: nextStatus, updatedAt: new Date().toISOString() });

    // Send notification to manager
    if (managers[managerIndex].userId) {
      const notifId = `revoke_appr_${eventData.id}_${Date.now()}`;
      await setDoc(doc(db, 'notifications', notifId), {
        recipientId: String(managers[managerIndex].userId),
        type: 'MANAGER_REVOKE_APPROVED',
        category: 'EVENT',
        priority: 'NORMAL',
        title: 'Revocation Approved',
        message: `Your request to revoke management for "${eventData.title}" was approved. Reason: ${reason || 'None provided'}`,
        eventId: eventData.id || null,
        eventTitle: eventData.title || '',
        status: 'DELIVERED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    logActivity({
      category: 'EVENT', action: 'MANAGER_REVOKE_APPROVED', status: 'SUCCESS',
      actor: { userId: req.user.id, name: req.user.name, role: req.user.role },
      target: { entityType: 'EVENT', entityId: eventSnap.id }
    });

    res.json({ success: true, message: 'Revocation approved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Remove Manager
router.post('/:eventId/remove-manager', authenticateToken, async (req, res) => {
  try {
    const { managerEmail, reason } = req.body;
    const eventRef = doc(db, 'events', req.params.eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();
    if (eventData.organizerId !== req.user.id && req.user.role !== 'FACULTY') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const managerIndex = eventData.managers.findIndex(m => m.email === managerEmail);
    if (managerIndex === -1) return res.status(404).json({ success: false, message: 'Manager not found' });

    const managers = [...eventData.managers];
    managers[managerIndex].status = 'REMOVED';
    managers[managerIndex].removalReason = reason || '';

    // Check if we need to revert event status
    const activeManagers = managers.filter(m => m.status === 'ACCEPTED');
    let nextStatus = eventData.status;
    
    // If no active managers and event has already advanced past PENDING_MANAGERS
    if (activeManagers.length === 0 && !['DRAFT', 'PENDING_MANAGERS'].includes(eventData.status)) {
      nextStatus = 'PENDING_MANAGERS';
    }

    await updateDoc(eventRef, { managers, status: nextStatus, updatedAt: new Date().toISOString() });

    // Send notification to manager
    if (managers[managerIndex].userId) {
      const notifId = `mgr_removed_${eventData.id}_${Date.now()}`;
      await setDoc(doc(db, 'notifications', notifId), {
        recipientId: String(managers[managerIndex].userId),
        type: 'MANAGER_REMOVED',
        category: 'EVENT',
        priority: 'HIGH',
        title: 'Removed as Manager',
        message: `You were removed as a manager for "${eventData.title}". Reason: ${reason || 'None provided'}`,
        eventId: eventData.id || null,
        eventTitle: eventData.title || '',
        status: 'DELIVERED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    logActivity({
      category: 'EVENT', action: 'MANAGER_REMOVED', status: 'SUCCESS',
      actor: { userId: req.user.id, name: req.user.name, role: req.user.role },
      target: { entityType: 'EVENT', entityId: eventSnap.id }
    });

    res.json({ success: true, message: 'Manager removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
