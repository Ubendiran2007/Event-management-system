const express = require('express');
const {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} = require('firebase/firestore');
const { db } = require('../firebase');
const { sendEventNotificationToFaculty, sendEventStatusNotification, sendApprovalRequestToRole } = require('../services/emailService');

const router = express.Router();

// ── Guard: firebase not ready ─────────────────────────────────────────────
function checkDb(res) {
  if (!db) {
    res.status(503).json({
      success: false,
      message: 'Firebase is not configured. Add backend/serviceAccountKey.json and restart.',
    });
    return false;
  }
  return true;
}

// ── Helper: Fetch faculty email by name ──────────────────────────────────
// Searches "coordinators" collection for matching faculty name
async function getFacultyEmailByName(facultyName) {
  if (!facultyName || !db) {
    return null;
  }

  try {
    // Try to find the faculty in the "coordinators" collection
    const coordinatorsSnapshot = await getDocs(
      query(
        collection(db, 'coordinators'),
        where('name', '==', facultyName)
      )
    );

    if (!coordinatorsSnapshot.empty) {
      const coordinatorData = coordinatorsSnapshot.docs[0].data();
      return coordinatorData.email || null;
    }

    // Fallback: Check "users" collection with faculty role
    const usersSnapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('name', '==', facultyName),
        where('role', '==', 'FACULTY')
      )
    );

    if (!usersSnapshot.empty) {
      return usersSnapshot.docs[0].data().email || null;
    }

    return null;
  } catch (error) {
    console.warn('[events] Error fetching faculty email:', error.message);
    return null;
  }
}

// ── Helper: Fetch official emails by role ─────────────────────────────────
async function getOfficialEmailsByRole(role) {
  if (!role || !db) return [];
  try {
    const usersSnapshot = await getDocs(
      query(collection(db, 'users'), where('role', '==', role))
    );
    return usersSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
  } catch (error) {
    console.warn(`[events] Error fetching ${role} emails:`, error.message);
    return [];
  }
}

// ── POST /api/events ──────────────────────────────────────────────────────
// Create a new event (saves to Firestore "events" collection)
router.post('/', async (req, res) => {
  if (!checkDb(res)) return;

  const eventData = req.body;

  if (!eventData || !eventData.title) {
    return res.status(400).json({ success: false, message: 'Event title is required' });
  }

  try {
    const payload = {
      ...eventData,
      status: eventData.status || 'PENDING_FACULTY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'events'), payload);

    // Send email notification to faculty
    // Prefer direct email from payload; fallback to Firestore lookup by faculty name.
    try {
      let facultyEmail =
        eventData.coordinator?.facultyEmail ||
        eventData.coordinator?.faculty_email ||
        eventData.facultyEmail ||
        null;

      if (typeof facultyEmail === 'string') {
        facultyEmail = facultyEmail.trim().toLowerCase();
      }

      if (!facultyEmail && eventData.coordinator?.facultyName) {
        facultyEmail = await getFacultyEmailByName(String(eventData.coordinator.facultyName).trim());
      }

      if (facultyEmail) {
        const emailResult = await sendEventNotificationToFaculty(payload, facultyEmail);
        if (!emailResult.success) {
          console.warn('[events/create] Email notification failed:', emailResult.error);
        } else {
          console.log(`[events/create] Email sent to faculty: ${facultyEmail}`);
        }
      } else {
        console.warn('[events/create] No faculty email found in payload or Firestore');
      }
    } catch (emailError) {
      console.error('[events/create] Error sending email:', emailError);
      // Don't fail the event creation if email fails
    }

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: { id: docRef.id, ...payload },
    });
  } catch (error) {
    console.error('[events/create] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create event', error: error.message });
  }
});

// ── GET /api/events ──────────────────────────────────────────────────────
// Get all events. Optional query params:
//   ?status=PENDING_FACULTY   → filter by status
//   ?organizerId=<id>         → filter by organiser
router.get('/', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { status, organizerId } = req.query;
    const constraints = [];

    if (status) constraints.push(where('status', '==', status));
    if (organizerId) constraints.push(where('organizerId', '==', organizerId));

    const snapshot =
      constraints.length > 0
        ? await getDocs(query(collection(db, 'events'), ...constraints))
        : await getDocs(collection(db, 'events'));

    const events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    return res.json({ success: true, count: events.length, events });
  } catch (error) {
    console.error('[events/list] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch events', error: error.message });
  }
});

// ── GET /api/events/:id ──────────────────────────────────────────────────
// Get a single event by ID
router.get('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const docSnap = await getDoc(doc(db, 'events', req.params.id));

    if (!docSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    return res.json({ success: true, event: { id: docSnap.id, ...docSnap.data() } });
  } catch (error) {
    console.error('[events/get] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch event', error: error.message });
  }
});

// ── PATCH /api/events/:id/status ─────────────────────────────────────────
// Advance or reject an event through the approval chain
// Body: { status: 'PENDING_HOD' | 'PENDING_PRINCIPAL' | 'POSTED' | 'REJECTED' }
router.patch('/:id/status', async (req, res) => {
  if (!checkDb(res)) return;

  const { status, approvedBy } = req.body;

  const allowedStatuses = [
    'PENDING_FACULTY',
    'PENDING_HOD',
    'PENDING_PRINCIPAL',
    'APPROVED',
    'POSTED',
    'REJECTED',
    'COMPLETED',
  ];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`,
    });
  }

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const updatePayload = { status, updatedAt: new Date().toISOString() };
    if (approvedBy) updatePayload.approvedBy = approvedBy;

    await updateDoc(eventRef, updatePayload);

    const eventData = { id: req.params.id, ...eventSnap.data(), ...updatePayload };

    // Send status notification to event organizer if applicable
    if (eventData.organizerEmail && ['PENDING_HOD', 'PENDING_PRINCIPAL', 'POSTED', 'REJECTED'].includes(status)) {
      try {
        const emailResult = await sendEventStatusNotification(eventData.organizerEmail, eventData, status);
        if (!emailResult.success) {
          console.warn('[events/status] Email notification failed for organizer:', emailResult.error);
        }
      } catch (emailError) {
        console.error('[events/status] Error sending email to organizer:', emailError);
      }
    }

    // Send action required notification to the next approver (HOD/PRINCIPAL)
    if (['PENDING_HOD', 'PENDING_PRINCIPAL'].includes(status)) {
      const nextRole = status === 'PENDING_HOD' ? 'HOD' : 'PRINCIPAL';
      try {
        const officialEmails = await getOfficialEmailsByRole(nextRole);
        if (officialEmails.length > 0) {
          // Send to the first official found (or wrap in Promise.all for all)
          const requests = officialEmails.map(email => 
            sendApprovalRequestToRole(eventData, email, nextRole)
          );
          await Promise.allSettled(requests);
        } else {
          console.warn(`[events/status] No users found with role ${nextRole} to send approval request`);
        }
      } catch (officialError) {
        console.error(`[events/status] Error notifying ${nextRole}:`, officialError);
      }
    }

    // Trigger poster request to Media if event becomes POSTED and needs a poster
    if (status === 'POSTED' && eventData.posterWorkflow?.requested) {
      try {
        const mediaEmails = await getOfficialEmailsByRole('MEDIA');
        if (mediaEmails.length > 0) {
          const requests = mediaEmails.map(email =>
            sendPosterRequestEmail(eventData, email)
          );
          await Promise.allSettled(requests);
        } else {
          console.warn('[events/status] No MEDIA users found for poster request email');
        }
      } catch (mediaError) {
        console.error('[events/status] Error notifying MEDIA:', mediaError);
      }
    }

    return res.json({
      success: true,
      message: `Event status updated to ${status}`,
      event: eventData,
    });
  } catch (error) {
    console.error('[events/status] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update event status', error: error.message });
  }
});

// ── PUT /api/events/:id ──────────────────────────────────────────────────
// Full update of an event document
router.put('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const updatePayload = { ...req.body, updatedAt: new Date().toISOString() };
    await updateDoc(eventRef, updatePayload);

    return res.json({
      success: true,
      message: 'Event updated successfully',
      event: { id: req.params.id, ...eventSnap.data(), ...updatePayload },
    });
  } catch (error) {
    console.error('[events/update] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update event', error: error.message });
  }
});

// ── DELETE /api/events/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    await deleteDoc(eventRef);

    return res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('[events/delete] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete event', error: error.message });
  }
});

// ── PATCH /api/events/:id/poster ─────────────────────────────────────────
// Update just the poster data of an event
router.patch('/:id/poster', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const { posterDataUrl, posterFileName, posterMimeType, updatedBy } = req.body;
    
    if (!posterDataUrl) {
      return res.status(400).json({ success: false, message: 'Poster data URL is required' });
    }

    const updatePayload = {
      posterDataUrl,
      posterFileName,
      posterMimeType,
      updatedAt: new Date().toISOString()
    };

    if (updatedBy) updatePayload.posterUpdatedBy = updatedBy;

    await updateDoc(eventRef, updatePayload);

    return res.json({
      success: true,
      message: 'Poster uploaded successfully'
    });
  } catch (error) {
    console.error('[events/poster] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload poster', error: error.message });
  }
});

// ── PATCH /api/events/:id/poster-workflow ───────────────────────────────
// Update just the poster workflow sub-object of an event
router.patch('/:id/poster-workflow', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const currentWorkflow = eventData.posterWorkflow || {};
    
    const updates = req.body;
    const { updatedBy, ...workflowFields } = updates;

    const newWorkflow = {
      ...currentWorkflow,
      ...workflowFields,
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: updatedBy || 'Unknown User'
    };

    await updateDoc(eventRef, {
      posterWorkflow: newWorkflow,
      updatedAt: new Date().toISOString()
    });

    const refreshedData = { id: req.params.id, ...eventData, posterWorkflow: newWorkflow };

    // Trigger emails for specific steps in the workflow
    if (updates.status === 'SENT_TO_ORGANIZER' && eventData.organizerEmail) {
      try {
        await sendPosterReadyEmail(refreshedData, eventData.organizerEmail);
      } catch (workflowErr) {
        console.error('[events/poster-workflow] Error sending email to organizer:', workflowErr);
      }
    }

    return res.json({
      success: true,
      message: 'Poster workflow updated',
      posterWorkflow: newWorkflow
    });
  } catch (error) {
    console.error('[events/poster-workflow] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update poster workflow', error: error.message });
  }
});

// ── POST /api/events/test-email ──────────────────────────────────────────
// Test endpoint to verify email configuration
router.post('/test-email', async (req, res) => {
  const { emailAddress } = req.body;

  if (!emailAddress) {
    return res.status(400).json({
      success: false,
      message: 'Email address is required',
    });
  }

  try {
    const testEventData = {
      title: 'Test Event',
      description: 'This is a test email to verify SMTP configuration.',
      eventType: 'Test',
      date: new Date().toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '12:00',
      venue: 'Test Venue',
      organizerName: 'Test Organizer',
      organizingDepartment: 'CSE',
    };

    const emailResult = await sendEventNotificationToFaculty(testEventData, emailAddress);

    if (emailResult.success) {
      return res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: emailResult.messageId,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: emailResult.error,
      });
    }
  } catch (error) {
    console.error('[events/test-email] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message,
    });
  }
});

// ── GET /api/events/coordinators/list ────────────────────────────────────
// Get all faculty coordinators
router.get('/coordinators/list', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const snapshot = await getDocs(collection(db, 'coordinators'));
    const coordinators = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    return res.json({
      success: true,
      count: coordinators.length,
      coordinators,
    });
  } catch (error) {
    console.error('[events/coordinators/list] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch coordinators',
      error: error.message,
    });
  }
});

// ── POST /api/events/coordinators/add ────────────────────────────────────
// Add a new faculty coordinator
// Body: { name: string, email: string, department?: string }
router.post('/coordinators/add', async (req, res) => {
  if (!checkDb(res)) return;

  const { name, email, department } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Faculty name and email are required',
    });
  }

  try {
    const coordinatorData = {
      name,
      email,
      department: department || 'CSE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'coordinators'), coordinatorData);

    return res.status(201).json({
      success: true,
      message: 'Coordinator added successfully',
      coordinator: { id: docRef.id, ...coordinatorData },
    });
  } catch (error) {
    console.error('[events/coordinators/add] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add coordinator',
      error: error.message,
    });
  }
});

// ── DELETE /api/events/coordinators/:id ──────────────────────────────────
// Delete a faculty coordinator
router.delete('/coordinators/:id', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const coordinatorRef = doc(db, 'coordinators', req.params.id);
    const coordinatorSnap = await getDoc(coordinatorRef);

    if (!coordinatorSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: 'Coordinator not found',
      });
    }

    await deleteDoc(coordinatorRef);

    return res.json({
      success: true,
      message: 'Coordinator deleted successfully',
    });
  } catch (error) {
    console.error('[events/coordinators/delete] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete coordinator',
      error: error.message,
    });
  }
});

module.exports = router;
