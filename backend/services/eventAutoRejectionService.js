const {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
} = require('firebase/firestore');
const { db } = require('../firebase');
const { sendEventStatusNotification } = require('./emailService');

// Auto-reject applies to any event that is still pending approval
// once the configured start date/time is reached.
const PENDING_STATUSES = [
  'PENDING_FACULTY',
  'PENDING_HOD',
  'PENDING_DEPARTMENTS',
  'PENDING_IQAC',
  'APPROVED'
];
const AUTO_REJECT_BEFORE_START_MINUTES = parseInt(
  process.env.AUTO_REJECT_BEFORE_START_MINUTES || '5',
  10
);

function parseDateParts(dateValue) {
  if (!dateValue) return null;
  const raw = String(dateValue).trim();

  // yyyy-mm-dd
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return {
      year: Number(m[1]),
      monthIndex: Number(m[2]) - 1,
      day: Number(m[3]),
    };
  }

  // dd-mm-yyyy or dd/mm/yyyy
  m = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) {
    return {
      year: Number(m[3]),
      monthIndex: Number(m[2]) - 1,
      day: Number(m[1]),
    };
  }

  return null;
}

function parseTimeParts(timeValue) {
  if (!timeValue) return null;
  const raw = String(timeValue).trim();

  // 24h: HH:mm or HH:mm:ss
  let m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    const second = Number(m[3] || '0');
    if (hour > 23 || minute > 59 || second > 59) return null;
    return { hour, minute, second };
  }

  // 12h: HH:mm AM/PM
  m = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (m) {
    let hour = Number(m[1]);
    const minute = Number(m[2]);
    const ampm = m[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (ampm === 'AM') {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }
    return { hour, minute, second: 0 };
  }

  return null;
}

function parseEventStartDateTime(eventData = {}) {
  const dateValue =
    eventData.date ||
    eventData?.requisition?.step1?.eventStartDate ||
    null;

  const timeValue =
    eventData.startTime ||
    eventData?.requisition?.step1?.eventStartTime ||
    null;

  if (!dateValue || !timeValue) return null;

  const dateParts = parseDateParts(dateValue);
  const timeParts = parseTimeParts(timeValue);
  if (!dateParts || !timeParts) return null;

  // Use local server time so comparisons match campus-entered timings.
  const parsed = new Date(
    dateParts.year,
    dateParts.monthIndex,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
    0
  );

  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function floorToMinute(dateValue) {
  const normalized = new Date(dateValue);
  normalized.setSeconds(0, 0);
  return normalized;
}

async function runEventAutoRejectionOnce() {
  if (!db) {
    return { scanned: 0, rejected: 0, skippedInvalidDate: 0 };
  }

  const pendingSnapshot = await getDocs(
    query(collection(db, 'events'), where('status', 'in', PENDING_STATUSES))
  );

  let rejectedCount = 0;
  let invalidDateCount = 0;

  for (const eventDoc of pendingSnapshot.docs) {
    const eventData = eventDoc.data();
    const startDateTime = parseEventStartDateTime(eventData);

    if (!startDateTime) {
      invalidDateCount += 1;
      continue;
    }

    const nowMs = floorToMinute(new Date()).getTime();
    const startMs = floorToMinute(startDateTime).getTime();
    const rejectAtMs = startMs - AUTO_REJECT_BEFORE_START_MINUTES * 60 * 1000;

    if (nowMs < rejectAtMs) {
      continue;
    }

    const autoRejectionPayload = {
      status: 'REJECTED',
      updatedAt: new Date().toISOString(),
      autoRejectedAt: new Date().toISOString(),
      autoRejectedBy: 'SYSTEM',
      rejectionReason: `Automatically rejected: approval was not completed ${AUTO_REJECT_BEFORE_START_MINUTES} minute(s) before event start time.`,
    };

    await updateDoc(doc(db, 'events', eventDoc.id), autoRejectionPayload);

    rejectedCount += 1;

    if (eventData.organizerEmail) {
      await sendEventStatusNotification(
        eventData.organizerEmail,
        { id: eventDoc.id, ...eventData, ...autoRejectionPayload },
        'REJECTED'
      );
    }
  }

  return {
    scanned: pendingSnapshot.size,
    rejected: rejectedCount,
    skippedInvalidDate: invalidDateCount,
  };
}

function startEventAutoRejectionJob(intervalMs = 60 * 1000) {
  const runSafely = async () => {
    try {
      const result = await runEventAutoRejectionOnce();
      if (result.rejected > 0) {
        console.log(
          `[auto-reject] Rejected ${result.rejected}/${result.scanned} pending events (invalid-date: ${result.skippedInvalidDate})`
        );
      }
    } catch (error) {
      console.error('[auto-reject] Failed to run auto-rejection job:', error.message);
    }
  };

  // Run once shortly after startup, then on interval.
  setTimeout(runSafely, 5000);
  return setInterval(runSafely, intervalMs);
}

module.exports = {
  startEventAutoRejectionJob,
  runEventAutoRejectionOnce,
  parseEventStartDateTime,
};
