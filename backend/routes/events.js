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
    const { parseEventStartDateTime } = require('../services/eventAutoRejectionService');
    const startDateTime = parseEventStartDateTime(eventData);
    if (startDateTime) {
      const nowMs = new Date().getTime();
      const startMs = startDateTime.getTime();
      const rejectAtMs = startMs - parseInt(process.env.AUTO_REJECT_BEFORE_START_MINUTES || '5', 10) * 60 * 1000;
      if (nowMs >= rejectAtMs) {
        return res.status(400).json({ success: false, message: 'Cannot create an event that starts in less than 5 minutes or is already in the past.' });
      }
    }

    const payload = {
      ...eventData,
      status: eventData.status || 'PENDING_FACULTY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, 'events'), payload);

    // Send email notification based on initial status (Student vs Faculty creation)
    try {
      if (payload.status === 'PENDING_HOD') {
        const officialEmails = await getOfficialEmailsByRole('HOD');
        if (officialEmails.length > 0) {
          const requests = officialEmails.map(email => 
            sendApprovalRequestToRole(payload, email, 'HOD')
          );
          await Promise.allSettled(requests);
          console.log(`[events/create] Email sent to HODs (Faculty created event)`);
        } else {
          console.warn('[events/create] No HOD emails found for notification');
        }
      } else {
        // Default (Student created) - send to Faculty
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
      }
    } catch (emailError) {
      console.error('[events/create] Error sending initial email:', emailError);
      // Don't fail the event creation if email fails
    }

    // Send email notification to Media team if poster is requested
    if (payload.posterWorkflow?.requested) {
      try {
        const mediaEmails = await getOfficialEmailsByRole('MEDIA');
        if (mediaEmails.length > 0) {
          const requests = mediaEmails.map(email =>
            sendPosterRequestEmail(payload, email)
          );
          await Promise.allSettled(requests);
          console.log(`[events/create] Email sent to Media team for event ${docRef.id}`);
        } else {
          console.warn('[events/create] No MEDIA users found for poster request email');
        }
      } catch (mediaError) {
        console.error('[events/create] Error notifying MEDIA:', mediaError);
      }
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
    'PENDING_DEPARTMENTS',
    'PENDING_IQAC',
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

    const rawEventData = eventSnap.data();

    if (status !== 'REJECTED') {
      const { parseEventStartDateTime } = require('../services/eventAutoRejectionService');
      const startDateTime = parseEventStartDateTime(rawEventData);
      if (startDateTime) {
        const nowMs = new Date().getTime();
        const startMs = startDateTime.getTime();
        const rejectAtMs = startMs - parseInt(process.env.AUTO_REJECT_BEFORE_START_MINUTES || '5', 10) * 60 * 1000;
        if (nowMs >= rejectAtMs) {
          const autoRejectionPayload = {
            status: 'REJECTED',
            updatedAt: new Date().toISOString(),
            autoRejectedAt: new Date().toISOString(),
            autoRejectedBy: 'SYSTEM',
            rejectionReason: `Automatically rejected: action attempted within 5 minutes of event start time.`,
          };
          await updateDoc(eventRef, autoRejectionPayload);
          
          if (rawEventData.organizerEmail) {
            const { sendEventStatusNotification } = require('../services/emailService');
            // Try sending notification but don't fail if it doesn't work
            sendEventStatusNotification(
              rawEventData.organizerEmail,
              { id: eventSnap.id, ...rawEventData, ...autoRejectionPayload },
              'REJECTED'
            ).catch(err => console.error('[events/status] auto-reject email error:', err.message));
          }
          
          return res.status(400).json({
            success: false,
            message: 'Event has been auto-rejected because it is within 5 minutes of the start time.',
            event: { id: req.params.id, ...rawEventData, ...autoRejectionPayload }
          });
        }
      }
    }

    const updatePayload = { status, updatedAt: new Date().toISOString() };
    if (approvedBy) updatePayload.approvedBy = approvedBy;

    // Record timestamped approval for each stage
    const prevStatus = eventSnap.data().status;
    if (status === 'PENDING_HOD' && prevStatus === 'PENDING_FACULTY') {
      updatePayload.facultyApprovedAt = new Date().toISOString();
      updatePayload.facultyApprovedBy = approvedBy || 'Faculty';
    }
    if (status === 'PENDING_DEPARTMENTS' && prevStatus === 'PENDING_HOD') {
      updatePayload.hodApprovedAt = new Date().toISOString();
      updatePayload.hodApprovedBy = approvedBy || 'HOD';
    }
    if (status === 'POSTED' && prevStatus === 'PENDING_IQAC') {
      updatePayload.iqacApprovedAt = new Date().toISOString();
      updatePayload.iqacApprovedBy = approvedBy || 'IQAC';
    }

    await updateDoc(eventRef, updatePayload);

    const eventData = { id: req.params.id, ...eventSnap.data(), ...updatePayload };

    // Send status notification to event organizer if applicable
    if (eventData.organizerEmail && ['PENDING_HOD', 'PENDING_DEPARTMENTS', 'PENDING_IQAC', 'POSTED', 'REJECTED'].includes(status)) {
      try {
        const emailResult = await sendEventStatusNotification(eventData.organizerEmail, eventData, status);
        if (!emailResult.success) {
          console.warn('[events/status] Email notification failed for organizer:', emailResult.error);
        }
      } catch (emailError) {
        console.error('[events/status] Error sending email to organizer:', emailError);
      }
    }

    // Send action required notification to the next approver (HOD/IQAC or teams)
    if (['PENDING_HOD', 'PENDING_DEPARTMENTS', 'PENDING_IQAC'].includes(status)) {
      let nextRoles = [];
      if (status === 'PENDING_HOD') nextRoles = ['HOD'];
      else if (status === 'PENDING_IQAC') nextRoles = ['IQAC_TEAM'];
      else if (status === 'PENDING_DEPARTMENTS') {
        const reqs = eventData.requisition?.step1?.requirements || {};
        const isRequired = (k) => reqs[k] ?? eventData[k] ?? false;
        
        nextRoles = ['HR_TEAM', 'AUDIO_TEAM', 'SYSTEM_ADMIN', 'TRANSPORT_TEAM'];
        
        if (isRequired('accommodationDiningRequired') || isRequired('accommodationRequired')) {
          const accom = eventData.requisition?.annexureV_accommodation || {};
          const males = Number(accom.maleGuests || 0);
          const females = Number(accom.femaleGuests || 0);
          
          if (males > 0) nextRoles.push('BOYS_WARDEN');
          if (females > 0) nextRoles.push('GIRLS_WARDEN');
          // Fallback if no guest counts but accommodation requested (e.g. only dining)
          if (males === 0 && females === 0) nextRoles.push('BOYS_WARDEN');
        }
      }
      
      try {
        for (const nextRole of nextRoles) {
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
        }
      } catch (officialError) {
        console.error(`[events/status] Error notifying approvers:`, officialError);
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

// ── PATCH /api/events/:id/department-approval ────────────────────────────
// Approve a specific department requirement
// Body: { department: 'venue' | 'audio' | 'icts' | 'transport' | 'accommodation' | 'media', approvedBy: string }
router.patch('/:id/department-approval', async (req, res) => {
  if (!checkDb(res)) return;

  const { department, approvedBy } = req.body;

  if (!department || !approvedBy) {
    return res.status(400).json({ success: false, message: 'Department and approvedBy are required' });
  }

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const departmentApprovals = eventData.departmentApprovals || {};

    departmentApprovals[department] = {
      status: 'APPROVED',
      approvedBy,
      approvedAt: new Date().toISOString(),
    };

    const updatePayload = { departmentApprovals, updatedAt: new Date().toISOString() };

    // Check if all required departments are approved
    const reqs = eventData.requisition?.step1?.requirements || {};
    // Backward compatibility if requirements are at root level
    const isRequired = (key) => reqs[key] ?? eventData[key] ?? false;

    const requiredDepts = [];
    if (isRequired('venueRequired')) requiredDepts.push('venue');
    if (isRequired('audioRequired')) requiredDepts.push('audio');
    if (isRequired('ictsRequired')) requiredDepts.push('icts');
    if (isRequired('transportRequired')) requiredDepts.push('transport');
    if (isRequired('mediaRequired')) requiredDepts.push('media');

    if (isRequired('accommodationDiningRequired') || isRequired('accommodationRequired')) {
      const accom = eventData.requisition?.annexureV_accommodation || {};
      const males = Number(accom.maleGuests || 0);
      const females = Number(accom.femaleGuests || 0);
      
      if (males > 0) requiredDepts.push('boysAccommodation');
      if (females > 0) requiredDepts.push('girlsAccommodation');
      if (males === 0 && females === 0) requiredDepts.push('boysAccommodation'); // fallback
    }

    const allApproved = requiredDepts.every(dept => departmentApprovals[dept]?.status === 'APPROVED');

    if (allApproved && eventData.status === 'PENDING_DEPARTMENTS') {
      updatePayload.status = 'PENDING_IQAC';
      
      // Auto-notify IQAC here in parallel to avoid blocking the response
      try {
        const iqacEmails = await getOfficialEmailsByRole('IQAC_TEAM');
        Promise.all(iqacEmails.map(email => 
          sendApprovalRequestToRole(eventData, email, 'IQAC_TEAM')
            .catch(e => console.error(`Error notifying IQAC member ${email}:`, e))
        ));
        // Note: We don't await the Promise.all here because we want to return the response to the user immediately.
      } catch (e) {
        console.error('Error starting IQAC notifications:', e);
      }
    }

    await updateDoc(eventRef, updatePayload);

    return res.json({
      success: true,
      message: `${department} approved successfully`,
      event: { id: req.params.id, ...eventData, ...updatePayload },
    });
  } catch (error) {
    console.error('[events/department-approval] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update department approval', error: error.message });
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

// ── PUT /api/events/:id/resubmit-edit ───────────────────────────────
// Resubmit a rejected event
router.put('/:id/resubmit-edit', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const isFacultyOrganizer = eventData.creatorType === 'FACULTY';
    const hasMediaPoster = Boolean(eventData.posterDataUrl || eventData.posterUrl);

    // Reset all approvals upon resubmission
    const newDeptApprovals = {};

    const updatePayload = {
      ...req.body,
      status: isFacultyOrganizer ? 'PENDING_HOD' : 'PENDING_FACULTY',
      isResubmitted: true,
      updatedAt: new Date().toISOString(),
      
      // Clear all stage approvals
      approvedBy: null,
      rejectionReason: null,
      
      facultyApprovedAt: null,
      facultyApprovedBy: null,
      hodApprovedAt: null,
      hodApprovedBy: null,
      iqacApprovedAt: null,
      iqacApprovedBy: null,
      
      // Reset department approvals (except media if poster exists)
      departmentApprovals: newDeptApprovals
    };
    await updateDoc(eventRef, updatePayload);

    // After resubmitting, we can notify the faculty again
    try {
      const payloadWithId = { id: req.params.id, ...updatePayload };
      let facultyEmail =
        updatePayload.coordinator?.facultyEmail ||
        updatePayload.coordinator?.faculty_email ||
        updatePayload.facultyEmail ||
        null;

      if (typeof facultyEmail === 'string') {
        facultyEmail = facultyEmail.trim().toLowerCase();
      }

      if (!facultyEmail && updatePayload.coordinator?.facultyName) {
        facultyEmail = await getFacultyEmailByName(String(updatePayload.coordinator.facultyName).trim());
      }

      if (facultyEmail) {
        await sendEventNotificationToFaculty(payloadWithId, facultyEmail);
      }
    } catch (emailError) {
      console.error('[events/resubmit-edit] Error sending email:', emailError);
    }

    return res.json({
      success: true,
      message: 'Event resubmitted successfully',
      event: { id: req.params.id, ...eventSnap.data(), ...updatePayload },
    });
  } catch (error) {
    console.error('[events/resubmit-edit] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to resubmit event', error: error.message });
  }
});

// ── POST /api/events/:id/register ────────────────────────────────────────────
// A student registers for an event — adds them to the registeredStudents array
router.post('/:id/register', async (req, res) => {
  if (!checkDb(res)) return;  // checkDb returns false when db is ready

  try {
    const { userId, userName, userEmail, userDepartment, userYear, rollNo, userClass } = req.body;

    if (!userId || !userName) {
      return res.status(400).json({ success: false, message: 'userId and userName are required' });
    }

    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const registeredStudents = eventData.registeredStudents || [];

    // Prevent duplicate registration
    if (registeredStudents.some(s => s.userId === userId)) {
      return res.status(409).json({ success: false, message: 'Already registered for this event' });
    }

    const newEntry = {
      userId,
      userName,
      userEmail: userEmail || '',
      userDepartment: userDepartment || '',
      userYear: userYear || '',
      rollNo: rollNo || '',
      userClass: userClass || '',
      registeredAt: new Date().toISOString(),
    };

    const updatedList = [...registeredStudents, newEntry];
    await updateDoc(eventRef, {
      registeredStudents: updatedList,
      updatedAt: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, message: 'Registered successfully', entry: newEntry });
  } catch (error) {
    console.error('[events/register] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to register', error: error.message });
  }
});

// ── POST /api/events/:id/withdraw ────────────────────────────────────────────
// A student withdraws their registration — removes them from registeredStudents
router.post('/:id/withdraw', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const registeredStudents = eventData.registeredStudents || [];
    const updatedList = registeredStudents.filter(s => s.userId !== userId);

    await updateDoc(eventRef, {
      registeredStudents: updatedList,
      updatedAt: new Date().toISOString(),
    });

    return res.json({ success: true, message: 'Withdrawn successfully' });
  } catch (error) {
    console.error('[events/withdraw] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to withdraw', error: error.message });
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
    if ((updates.status === 'SENT_TO_ORGANIZER' || updates.status === 'COMPLETED') && eventData.organizerEmail) {
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
