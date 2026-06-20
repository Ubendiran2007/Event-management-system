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
const {
  sendEventNotificationToFaculty,
  sendEventStatusNotification,
  sendApprovalRequestToRole,
  sendPosterRequestEmail,
  sendPosterReadyEmail,
} = require('../services/emailService');
const {
  handleEventStatusChange,
  handleIQACExtensionRequest,
  handleIQACExtensionDecision,
} = require('../services/emailHandler');

const router = express.Router();

// â”€â”€ Guard: firebase not ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Helper: Fetch faculty email by name â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Helper: Fetch official emails by role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Helper: Get required departments for an event â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getRequiredDepartments(eventData) {
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
  return requiredDepts;
}

// â”€â”€ POST /api/events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // ── Background Notifications (centralized handler) ─────────────────
    const payloadWithId = { id: docRef.id, ...payload };
    setImmediate(async () => {
      try {
        // Resolve faculty email if student-created event
        if (payload.status === 'PENDING_FACULTY') {
          let facultyEmail = payload.coordinator?.facultyEmail ||
                             payload.coordinator?.faculty_email ||
                             payload.facultyEmail || null;
          if (typeof facultyEmail === 'string') facultyEmail = facultyEmail.trim().toLowerCase();
          if (!facultyEmail && payload.coordinator?.facultyName) {
            facultyEmail = await getFacultyEmailByName(String(payload.coordinator.facultyName).trim());
          }
          payloadWithId.coordinator = { ...payloadWithId.coordinator, facultyEmail };
        }
        await handleEventStatusChange(payloadWithId, null, payload.status);
      } catch (err) {
        console.error('[events/create/bg] Error in email handler:', err.message);
      }
    });

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

// ── GET /api/events ────────────────────────────────────────────────────────
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

// ── GET /api/events/:id ─────────────────────────────────────────────────────
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

// ── PATCH /api/events/:id/status ───────────────────────────────────────────
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

    let finalStatus = status;
    const updatePayload = { status: finalStatus, updatedAt: new Date().toISOString() };
    if (approvedBy) updatePayload.approvedBy = approvedBy;

    if (finalStatus === 'REJECTED') {
      const reason = String(req.body.rejectionReason || '').trim();
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is mandatory.',
        });
      }

      let displayRole = req.body.rejectedByRole || 'Approver';
      if (displayRole === 'FACULTY') displayRole = 'Faculty';
      else if (displayRole === 'HOD') displayRole = 'HOD';
      else if (displayRole === 'IQAC_TEAM') displayRole = 'IQAC';

      updatePayload.rejectionReason = reason;
      updatePayload.rejectedByRole = displayRole;
      updatePayload.rejectedByName = req.body.rejectedByName || approvedBy || 'Unknown Approver';
      updatePayload.rejectedByDept = req.body.rejectedByDept || rawEventData.department || 'N/A';
      updatePayload.rejectedAt = new Date().toISOString();
    }

    // Record timestamped approval for each stage
    const prevStatus = eventSnap.data().status;
    if (finalStatus === 'PENDING_HOD' && prevStatus === 'PENDING_FACULTY') {
      updatePayload.facultyApprovedAt = new Date().toISOString();
      updatePayload.facultyApprovedBy = approvedBy || 'Faculty';
    }
    if (finalStatus === 'PENDING_DEPARTMENTS' && prevStatus === 'PENDING_HOD') {
      updatePayload.hodApprovedAt = new Date().toISOString();
      updatePayload.hodApprovedBy = approvedBy || 'HOD';

      // AUTO-ADVANCE: If no departments are required, skip PENDING_DEPARTMENTS and go to PENDING_IQAC
      const requiredDepts = getRequiredDepartments(rawEventData);
      if (requiredDepts.length === 0) {
        console.log(`[events/status] No departments required for event ${req.params.id}. Auto-advancing to PENDING_IQAC.`);
        finalStatus = 'PENDING_IQAC';
        updatePayload.status = finalStatus;
      }
    }
    if (finalStatus === 'POSTED' && prevStatus === 'PENDING_IQAC') {
      updatePayload.iqacApprovedAt = new Date().toISOString();
      updatePayload.iqacApprovedBy = approvedBy || 'IQAC';
    }

    await updateDoc(eventRef, updatePayload);
    const eventData = { id: req.params.id, ...eventSnap.data(), ...updatePayload };
    const notificationStatus = finalStatus; // Use the potentially advanced status for notifications

    // ── Background Notifications (centralized handler) ──────────────────────
    setImmediate(async () => {
      try {
        await handleEventStatusChange(eventData, prevStatus, notificationStatus);
      } catch (err) {
        console.error('[events/status/bg] Email handler error:', err.message);
      }
    });


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

// â”€â”€ PATCH /api/events/:id/department-approval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Approve a specific department requirement
// Body: { department: 'venue' | 'audio' | 'icts' | 'transport' | 'accommodation' | 'media', approvedBy: string }
router.patch('/:id/department-approval', async (req, res) => {
  if (!checkDb(res)) return;

  const { department, approvedBy, status = 'APPROVED', reason } = req.body;

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

    if (status === 'REJECTED') {
      const reasonStr = String(reason || '').trim();
      if (!reasonStr) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is mandatory.',
        });
      }

      departmentApprovals[department] = {
        status: 'REJECTED',
        rejectedBy: approvedBy,
        rejectedAt: new Date().toISOString(),
        reason: reasonStr,
      };

      // Determine clean role and department names for display
      let displayRole = 'Department Officer';
      let displayDept = department.toUpperCase();

      if (department === 'venue') {
        displayRole = 'HR';
        displayDept = 'Venue';
      } else if (department === 'media') {
        displayRole = 'HR';
        displayDept = 'Media';
      } else if (department === 'audio') {
        displayRole = 'Audio';
        displayDept = 'Audio';
      } else if (department === 'icts') {
        displayRole = 'ICTS';
        displayDept = 'ICTS';
      } else if (department === 'transport') {
        displayRole = 'Transport';
        displayDept = 'Transport';
      } else if (department === 'boysAccommodation') {
        displayRole = 'Warden';
        displayDept = 'Boys Hostel';
      } else if (department === 'girlsAccommodation') {
        displayRole = 'Warden';
        displayDept = 'Girls Hostel';
      }

      const updatePayload = {
        departmentApprovals,
        status: 'REJECTED',
        rejectionReason: reasonStr,
        rejectedByRole: displayRole,
        rejectedByName: approvedBy,
        rejectedByDept: displayDept,
        rejectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await updateDoc(eventRef, updatePayload);

      setImmediate(async () => {
        if (eventData.organizerEmail) {
          try {
            await sendEventStatusNotification(eventData.organizerEmail, { id: req.params.id, ...eventData, ...updatePayload }, 'REJECTED');
          } catch (e) {
            console.error('[events/dept-approval/bg] Error sending rejection email:', e.message);
          }
        }
      });

      return res.json({
        success: true,
        message: `${department} rejected successfully`,
        event: { id: req.params.id, ...eventData, ...updatePayload },
      });
    }

    departmentApprovals[department] = {
      status: 'APPROVED',
      approvedBy,
      approvedAt: new Date().toISOString(),
    };

    const updatePayload = { departmentApprovals, updatedAt: new Date().toISOString() };

    const requiredDepts = getRequiredDepartments(eventData);
    const allApproved = requiredDepts.every(dept => departmentApprovals[dept]?.status === 'APPROVED');

    if (allApproved && eventData.status === 'PENDING_DEPARTMENTS') {
      updatePayload.status = 'PENDING_IQAC';
      await updateDoc(eventRef, updatePayload);

      setImmediate(async () => {
        try {
          await handleEventStatusChange({ id: req.params.id, lastApprovedDept: department, ...eventData, ...updatePayload }, 'PENDING_DEPARTMENTS', 'PENDING_IQAC');
        } catch (e) {
          console.error('[events/dept-approval/bg] Error starting IQAC notifications:', e.message);
        }
      });
    } else {
      await updateDoc(eventRef, updatePayload);
 
      setImmediate(async () => {
        try {
          // Pass a pseudo-status 'DEPARTMENT_APPROVED' so the handler emails the organizer about this intermediate step
          await handleEventStatusChange({ id: req.params.id, lastApprovedDept: department, ...eventData, ...updatePayload }, eventData.status, 'DEPARTMENT_APPROVED');
        } catch (e) {
          console.error('[events/dept-approval/bg] Error starting intermediate notifications:', e.message);
        }
      });
    }

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

// â”€â”€ PUT /api/events/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ PUT /api/events/:id/resubmit-edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      rejectedByRole: null,
      rejectedByName: null,
      rejectedByDept: null,
      rejectedAt: null,

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

    // After resubmitting, notify the faculty in the background
    setImmediate(async () => {
      try {
        const payloadWithId = { id: req.params.id, ...updatePayload };
        let facultyEmail = updatePayload.coordinator?.facultyEmail || updatePayload.coordinator?.faculty_email || updatePayload.facultyEmail || null;
        if (typeof facultyEmail === 'string') facultyEmail = facultyEmail.trim().toLowerCase();

        if (!facultyEmail && updatePayload.coordinator?.facultyName) {
          facultyEmail = await getFacultyEmailByName(String(updatePayload.coordinator.facultyName).trim());
        }

        if (facultyEmail) {
          await sendEventNotificationToFaculty(payloadWithId, facultyEmail);
        }
      } catch (emailError) {
        console.error('[events/resubmit-edit/bg] Error sending email:', emailError.message);
      }
    });

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

// â”€â”€ POST /api/events/:id/register â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// A student registers for an event â€” adds them to the registeredStudents array
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

    if (eventData.status !== 'POSTED') {
      return res.status(400).json({ success: false, message: 'Cannot register for an event that is not approved and posted.' });
    }

    const startDateStr = eventData.requisition?.step1?.eventStartDate || eventData.date;
    const startTimeStr = eventData.requisition?.step1?.eventStartTime || eventData.startTime || '00:00';
    
    if (startDateStr) {
      try {
        const sDP = startDateStr.split('-');
        const sTP = startTimeStr.split(':');
        const startTimestamp = new Date(parseInt(sDP[0]), parseInt(sDP[1]) - 1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1])).getTime();
        
        if (Date.now() >= startTimestamp) {
          return res.status(400).json({ success: false, message: 'Registration is closed. This event is already ongoing or completed.' });
        }
      } catch (err) {
        const today = new Date().toISOString().split('T')[0];
        if (startDateStr < today) {
          return res.status(400).json({ success: false, message: 'Registration is closed. This event is already ongoing or completed.' });
        }
      }
    }

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

// â”€â”€ POST /api/events/:id/withdraw â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// A student withdraws their registration â€” removes them from registeredStudents
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

// â”€â”€ DELETE /api/events/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ PATCH /api/events/:id/poster â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Update just the poster data of an event
router.patch('/:id/poster', async (req, res) => {
  if (!checkDb(res)) return;

  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);

    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const eventData = eventSnap.data();
    const { posterDataUrl, posterFileName, posterMimeType, updatedBy } = req.body;

    if (!posterDataUrl) {
      return res.status(400).json({ success: false, message: 'Poster data URL is required' });
    }

    const now = new Date().toISOString();
    const updatePayload = {
      posterDataUrl,
      posterFileName,
      posterMimeType,
      updatedAt: now,
      posterUploadedAt: now,
      posterStatus: 'UPLOADED'
    };

    if (updatedBy) {
      updatePayload.posterUpdatedBy = updatedBy;
      updatePayload.posterUploadedBy = updatedBy;
    }

    const currentWorkflow = eventData.posterWorkflow || {};
    let isMediaUpload = false;
    
    // If a poster was requested from media team, update the workflow to reflect completion
    if (currentWorkflow.requested) {
      isMediaUpload = true;
      updatePayload.posterWorkflow = {
        ...currentWorkflow,
        status: 'UPLOADED',
        finalUploadedAt: now,
        finalUploadedBy: updatedBy || 'Media Team'
      };
    }

    await updateDoc(eventRef, updatePayload);

    // Send notification if this was a requested media poster upload
    if (isMediaUpload && eventData.organizerEmail) {
      const refreshedData = { id: req.params.id, ...eventData, ...updatePayload };
      try {
        await sendPosterReadyEmail(refreshedData, eventData.organizerEmail);
      } catch (emailErr) {
        console.error('[events/poster] Error sending email to organizer:', emailErr);
      }
    }

    return res.json({
      success: true,
      message: 'Poster uploaded successfully'
    });
  } catch (error) {
    console.error('[events/poster] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload poster', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/poster-workflow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ POST /api/events/test-email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ GET /api/events/coordinators/list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ POST /api/events/coordinators/add â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ DELETE /api/events/coordinators/:id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ PATCH /api/events/:id/request-iqac-extension â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Organizer requests an extension for IQAC submission with a reason
router.patch('/:id/request-iqac-extension', async (req, res) => {
  if (!checkDb(res)) return;
  const { reason, requestedBy } = req.body;
  if (!reason || !requestedBy) {
    return res.status(400).json({ success: false, message: 'Reason and requestedBy are required' });
  }
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();

    const iqacExtensionRequest = {
      reason,
      requestedBy,
      requestedAt: new Date().toISOString(),
      status: 'PENDING'
    };
    const updatePayload = { iqacExtensionRequest, updatedAt: new Date().toISOString() };
    await updateDoc(eventRef, updatePayload);

    setImmediate(async () => {
      try {
        const hodEmails = await getOfficialEmailsByRole('HOD');
        if (hodEmails.length > 0) {
          Promise.allSettled(hodEmails.map(email =>
            sendIQACExtensionRequestEmail(email, { id: req.params.id, ...eventData }, reason)
          )).catch(e => console.error('[events/request-iqac-extension/bg] Error:', e.message));
        }
      } catch (err) {
        console.error('[events/request-iqac-extension/bg] background err:', err.message);
      }
    });

    return res.json({ success: true, message: 'IQAC extension requested successfully', event: { id: req.params.id, ...eventData, ...updatePayload } });
  } catch (error) {
    console.error('[events/request-iqac-extension] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to request extension', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/approve-iqac-extension â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HOD approves an IQAC extension request with a specific end date
router.patch('/:id/approve-iqac-extension', async (req, res) => {
  if (!checkDb(res)) return;
  const { endDate, approvedBy } = req.body;
  if (!endDate || !approvedBy) {
    return res.status(400).json({ success: false, message: 'End date and approvedBy (HOD name) are required' });
  }
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();
    const updatePayload = {
      iqacWindowExtended: true,
      iqacWindowExtendedAt: new Date().toISOString(),
      iqacWindowExtendedBy: approvedBy,
      iqacExtensionEndDate: endDate,
      'iqacExtensionRequest.status': 'APPROVED',
      updatedAt: new Date().toISOString()
    };
    await updateDoc(eventRef, updatePayload);

    setImmediate(async () => {
      try {
        if (eventData.organizerEmail) {
          await sendIQACExtensionStatusEmail(eventData.organizerEmail, { id: req.params.id, ...eventData }, true);
        }
      } catch (err) {
        console.error('[events/approve-iqac-extension/bg] background err:', err.message);
      }
    });

    return res.json({ success: true, message: 'IQAC extension approved successfully', event: { id: req.params.id, ...eventData, ...updatePayload } });
  } catch (error) {
    console.error('[events/approve-iqac-extension] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to approve extension', error: error.message });
  }
});

// PATCH /api/events/:id/reject-iqac-extension
router.patch('/:id/reject-iqac-extension', async (req, res) => {
  if (!checkDb(res)) return;
  const { rejectedBy } = req.body;
  if (!rejectedBy) {
    return res.status(400).json({ success: false, message: 'rejectedBy (HOD name) is required' });
  }
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    const eventData = eventSnap.data();
    const updatePayload = {
      'iqacExtensionRequest.status': 'REJECTED',
      'iqacExtensionRequest.rejectedBy': rejectedBy,
      'iqacExtensionRequest.rejectedAt': new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await updateDoc(eventRef, updatePayload);

    setImmediate(async () => {
      try {
        if (eventData.organizerEmail) {
          await sendIQACExtensionStatusEmail(eventData.organizerEmail, { id: req.params.id, ...eventData }, false);
        }
      } catch (err) {
        console.error('[events/reject-iqac-extension/bg] background err:', err.message);
      }
    });

    return res.json({ success: true, message: 'IQAC extension rejected successfully' });
  } catch (error) {
    console.error('[events/reject-iqac-extension] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject extension', error: error.message });
  }
});

// â”€â”€ PATCH /api/events/:id/extend-iqac-window â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// (Existing) Legacy/Faculty-only quick extension (grants 2 extra days from now)
router.patch('/:id/extend-iqac-window', async (req, res) => {
  if (!checkDb(res)) return;
  const { extendedBy } = req.body;
  if (!extendedBy) return res.status(400).json({ success: false, message: 'extendedBy is required' });
  try {
    const eventRef = doc(db, 'events', req.params.id);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return res.status(404).json({ success: false, message: 'Event not found' });

    // Legacy logic: 2 days from now
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const updatePayload = {
      iqacWindowExtended: true,
      iqacWindowExtendedBy: extendedBy,
      iqacWindowExtendedAt: new Date().toISOString(),
      iqacExtensionEndDate: twoDaysFromNow.toISOString().split('T')[0],
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(eventRef, updatePayload);
    return res.json({ success: true, message: 'IQAC window extended successfully', event: { id: req.params.id, ...eventSnap.data(), ...updatePayload } });
  } catch (error) {
    console.error('[events/extend-iqac-window] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to extend window', error: error.message });
  }
});

module.exports = router;

