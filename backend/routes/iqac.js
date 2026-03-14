const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { collection, getDocs, doc, getDoc, updateDoc, query, where } = require('firebase/firestore');

const checkDb = (res) => {
  if (!db) {
    res.status(503).json({ success: false, message: 'Firebase is not configured' });
    return true;
  }
  return false;
};

// Helper — build attendance + feedback stats from odRequests for an event
async function buildAutoStats(eventId) {
  const q = query(collection(db, 'odRequests'), where('eventId', '==', eventId));
  const snapshot = await getDocs(q);
  const eventRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  const totalRegistered = eventRequests.length;
  const approved = eventRequests.filter(r => r.status === 'APPROVED').length;
  const rejected = eventRequests.filter(r => r.status === 'REJECTED').length;
  const pending  = eventRequests.filter(r => r.status === 'PENDING_ORGANIZER').length;

  const withFeedback = eventRequests.filter(r => r.feedback);
  const attendanceRows = eventRequests.map((r) => ({
    student: r.studentName || '',
    rollNo: r.rollNo || '',
    status: r.status || 'PENDING_ORGANIZER',
    requestedAt: r.createdAt || r.requestedAt || '',
    feedbackSubmittedAt: r.feedback?.submittedAt || '',
  }));

  const feedbackCount = withFeedback.length;
  const avgRating = feedbackCount
    ? +(withFeedback.reduce((sum, r) => sum + r.feedback.rating, 0) / feedbackCount).toFixed(2)
    : null;
  const feedbackComments = withFeedback.map(r => ({
    student: r.studentName,
    rollNo: r.rollNo,
    rating: r.feedback.rating,
    comment: r.feedback.comment,
    submittedAt: r.feedback.submittedAt,
  }));

  return {
    attendanceStats: {
      totalRegistered,
      approved,
      rejected,
      pending,
      attendanceRate: totalRegistered > 0 ? `${Math.round((approved / totalRegistered) * 100)}%` : '0%',
      rows: attendanceRows,
    },
    feedbackSummary: {
      totalResponses: feedbackCount,
      averageRating: avgRating,
      ratingOutOf: 5,
      comments: feedbackComments,
    },
  };
}

// POST /api/iqac/:eventId — submit IQAC form and mark event COMPLETED
// Body: {
//   eventOutcome: string,
//   registrationDetails: { studentsCount, facultyCount, externalCount, periodStart, periodEnd, mode },
//   resourcePersons: [{ name, designation, organization, expertise, bio, email, phone, linkedin, photo }],
//   gallery: [{ dataUrl, fileName, title, caption, location, coordinates }],
//   guestFeedbackList: [{ name, designation, organization, photo, rating, feedback, highlights, date }],
//   documents: { [docName]: { fileName, fileType, fileSize, dataUrl, uploadedAt } },
//   finalReport: { fileName, fileType, fileSize, dataUrl, uploadedAt } | null
// }
router.post('/:eventId', async (req, res) => {
  if (checkDb(res)) return;
  const { eventId } = req.params;
  const {
    eventOutcome,
    registrationDetails,
    resourcePersons,
    gallery,
    guestFeedbackList,
    checklist,
    documents,
    finalReport,
  } = req.body;

  try {
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const event = eventSnap.data();

    // Build auto-generated statistics
    const { attendanceStats, feedbackSummary } = await buildAutoStats(eventId);

    // Build event summary from stored event fields
    const step1 = event?.requisition?.step1 || {};
    const organizerDetails = step1.organizerDetails || {};
    const participants = step1.participants || {};
    const guestDetails = step1.guestDetails || {};

    const guestName = guestDetails.guestNames || '';
    const guestDesignation = guestDetails.guestDesignation || '';
    const guestOrganization = guestDetails.guestOrganization || '';
    const resourcePerson = [guestName, guestDesignation, guestOrganization]
      .filter(Boolean)
      .join(' - ');

    const internalAudienceCount = Number(participants.internalCount || 0);
    const externalAudienceCount = Number(participants.externalCount || 0);
    const targetAudience = [
      internalAudienceCount > 0 ? `Internal: ${internalAudienceCount}` : '',
      externalAudienceCount > 0 ? `External: ${externalAudienceCount}` : '',
    ].filter(Boolean).join(' | ');

    const normalizedResourcePerson = typeof event.resourcePerson === 'object' && event.resourcePerson !== null
      ? event.resourcePerson.name || ''
      : event.resourcePerson || '';

    const normalizedTargetAudience = typeof event.targetAudience === 'object' && event.targetAudience !== null
      ? [
          event.targetAudience.participants,
          event.targetAudience.expectedCount ? `(${event.targetAudience.expectedCount})` : '',
        ].filter(Boolean).join(' ')
      : event.targetAudience || '';

    const eventSummary = {
      title: event.title || '',
      organizer: event.organizerName || organizerDetails.facultyName || '',
      department: event.department || organizerDetails.department || 'Computer Science and Engineering',
      date: event.date || step1.startDate || '',
      venue: event.venue || step1.venue || '',
      eventType: event.eventType || step1.eventType || '',
      category: event.category || '',
      description: event.description || step1.eventObjective || '',
      eventMode: event.eventMode || step1.eventMode || '',
      startTime: event.startTime || step1.eventStartTime || '',
      endTime: event.endTime || step1.eventEndTime || '',
      resourcePerson: normalizedResourcePerson || resourcePerson || '',
      targetAudience: normalizedTargetAudience || targetAudience || '',
      expectedCount: event.expectedParticipants || participants.expectedCount || 0,
    };

    // Process registration details
    const studentsCount  = Number(registrationDetails?.studentsCount)  || 0;
    const facultyCount   = Number(registrationDetails?.facultyCount)   || 0;
    const externalCount  = Number(registrationDetails?.externalCount)  || 0;
    const incomingStudentAttendanceList = Array.isArray(registrationDetails?.studentAttendanceList)
      ? registrationDetails.studentAttendanceList
      : [];
    const studentAttendanceList = incomingStudentAttendanceList.map((item, idx) => ({
      id: item?.id || item?.requestId || item?.rollNo || `att_${idx + 1}`,
      requestId: item?.requestId || item?.id || '',
      student: item?.student || item?.studentName || '',
      rollNo: item?.rollNo || '',
      attendanceStatus: String(item?.attendanceStatus || item?.status || 'ATTENDED').toUpperCase() === 'NOT_ATTENDED'
        ? 'NOT_ATTENDED'
        : 'ATTENDED',
    }));
    const studentsRegistered = studentAttendanceList.length > 0 ? studentAttendanceList.length : studentsCount;
    const studentsAttended = studentAttendanceList.length > 0
      ? studentAttendanceList.filter((row) => row.attendanceStatus === 'ATTENDED').length
      : (Number(registrationDetails?.studentsAttended) || 0);
    const facultyAttended = Number(registrationDetails?.facultyAttended) || 0;
    const externalAttended = Number(registrationDetails?.externalAttended) || 0;
    const totalRegistered = studentsRegistered + facultyCount + externalCount;
    const totalAttended = studentsAttended + facultyAttended + externalAttended;
    const noShowCount = Math.max(totalRegistered - totalAttended, 0);
    const registration   = {
      categories: { students: studentsRegistered, faculty: facultyCount, external: externalCount },
      total:      totalRegistered,
      attendance: {
        categories: {
          students: studentsAttended,
          faculty: facultyAttended,
          external: externalAttended,
        },
        total: totalAttended,
        noShowCount,
        noShowRate: totalRegistered > 0 ? `${Math.round((noShowCount / totalRegistered) * 100)}%` : '0%',
        attendanceRate: totalRegistered > 0 ? `${Math.round((totalAttended / totalRegistered) * 100)}%` : '0%',
        studentAttendanceList,
      },
      period:     { start: registrationDetails?.periodStart || '', end: registrationDetails?.periodEnd || '' },
      mode:       registrationDetails?.mode || '',
    };

    // Process gallery — give each image a stable id and timestamp
    const processedGallery = (gallery || []).map((item, idx) => ({
      id:          `gallery_${idx + 1}`,
      url:         item.dataUrl   || '',
      fileName:    item.fileName  || '',
      title:       item.title     || '',
      caption:     item.caption   || '',
      location:    item.location  || '',
      coordinates: item.coordinates || '',
      timestamp:   new Date().toISOString(),
    }));

    // Process guest feedback — split highlights string into array
    const processedGuestFeedback = (guestFeedbackList || []).map((gf, idx) => ({
      id:           `guest_${idx + 1}`,
      name:         gf.name         || '',
      designation:  gf.designation  || '',
      organization: gf.organization || '',
      photo:        gf.photo        || null,
      rating:       gf.rating       || 5,
      feedback:     gf.feedback     || '',
      highlights:   gf.highlights
        ? gf.highlights.split(',').map(h => h.trim()).filter(Boolean)
        : [],
      date:         gf.date || '',
    }));

    // Process resource persons — normalise photo shape for reliable rendering
    const processedResourcePersons = (resourcePersons || []).map((rp, idx) => {
      const rawPhoto = rp?.photo;
      const photoDataUrl =
        typeof rawPhoto === 'string'
          ? rawPhoto
          : rawPhoto?.dataUrl || rawPhoto?.url || null;

      return {
        id: rp?.id || `rp_${idx + 1}`,
        name: rp?.name || '',
        designation: rp?.designation || '',
        organization: rp?.organization || '',
        expertise: rp?.expertise || '',
        bio: rp?.bio || '',
        email: rp?.email || '',
        phone: rp?.phone || '',
        linkedin: rp?.linkedin || '',
        photo: photoDataUrl
          ? {
              fileName: rawPhoto?.fileName || '',
              dataUrl: photoDataUrl,
            }
          : null,
      };
    });

    await updateDoc(eventRef, {
      status: 'COMPLETED',
      iqacSubmittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      iqacData: {
        eventSummary,
        attendanceStats,
        feedbackSummary,
        registration,
        resourcePersons:  processedResourcePersons,
        gallery:          processedGallery,
        guestFeedback:    processedGuestFeedback,
        eventOutcome:     eventOutcome  || '',
        documents:        documents     || {},
        checklist:        Array.isArray(checklist) ? checklist : [],
        finalReport:      finalReport   || null,
      },
    });

    res.json({
      success: true,
      message: 'IQAC submission saved. Event marked as COMPLETED.',
      eventId,
      autoStats: { attendanceStats, feedbackSummary },
    });
  } catch (err) {
    console.error('Error saving IQAC submission:', err);
    const msg = String(err?.message || '');
    if (msg.includes('exceeds the maximum allowed size')) {
      return res.status(413).json({
        success: false,
        message: 'IQAC data is too large for Firestore document limit (1 MB). Reduce image/file sizes and try again.',
      });
    }

    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/iqac/:eventId — fetch IQAC data + live auto-stats for an event
router.get('/:eventId', async (req, res) => {
  if (checkDb(res)) return;
  const { eventId } = req.params;

  try {
    const eventRef = doc(db, 'events', eventId);
    const [eventSnap, { attendanceStats, feedbackSummary }] = await Promise.all([
      getDoc(eventRef),
      buildAutoStats(eventId),
    ]);
    if (!eventSnap.exists()) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const data = eventSnap.data();

    // Always return fresh auto-stats so the organizer sees latest figures

    res.json({
      success: true,
      eventId,
      title:  data.title,
      status: data.status,
      date:   data.date,
      venue:  data.venue,
      organizerName: data.organizerName,
      description:   data.description,
      attendanceStats,
      feedbackSummary,
      iqacData:       data.iqacData        || null,
      iqacSubmittedAt: data.iqacSubmittedAt || null,
    });
  } catch (err) {
    console.error('Error fetching IQAC data:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

