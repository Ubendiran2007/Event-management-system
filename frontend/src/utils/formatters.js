/**
 * Formats a student roll number for display.
 * - Strips the `student_` prefix from Firebase document IDs
 * - Always returns uppercase
 */
export const formatRollNo = (rollNo, fallbackId = '') => {
  const raw = rollNo || fallbackId || '';
  if (!raw) return '';
  return String(raw)
    .trim()
    .replace(/^student_/i, '')
    .toUpperCase();
};

/**
 * Standardizes Student Identity: Name Only (for tables with Roll No column)
 * Returns: "Ubendiran L"
 */
export const formatStudentNameOnly = (name) => {
  return fallbackValue(name, 'name') === 'Not Provided' ? 'Unknown Student' : String(name).trim();
};

/**
 * Standardizes Student Identity: Name + Roll Number
 * Returns: "Ubendiran L (24CS257)"
 */
export const formatStudentNameWithRoll = (name, rollNo, fallbackId = '') => {
  const safeName = fallbackValue(name, 'name') === 'Not Provided' ? 'Unknown Student' : String(name).trim();
  const formattedRoll = formatRollNo(rollNo, fallbackId);
  if (!formattedRoll) return safeName;
  return `${safeName} (${formattedRoll})`;
};

/**
 * Standardizes Event Reference ID display.
 * Never displays Firebase IDs.
 */
export const formatEventRef = (event) => {
  if (!event) return fallbackValue('', 'eventRef');
  
  // Return generated referenceId if it exists
  if (event.referenceId) return event.referenceId;

  // Fallback for legacy events without referenceId (avoid exposing Firebase ID)
  // Generates a mock format based on start date or "LEGACY"
  const dateStr = event.requisition?.step1?.eventStartDate || event.date || '';
  const dateObj = new Date(dateStr || Date.now());
  const year = dateObj.getFullYear();
  const dept = String(event.department || event.requisition?.step1?.organizerDetails?.department || 'GEN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  
  return `IQAC/${year}/${dept}/LGCY`;
};

/**
 * Empty Value Fallback handler.
 * Replaces null, undefined, "*", "-", "" with meaningful text.
 */
export const fallbackValue = (value, type = 'general') => {
  if (value === null || value === undefined || value === '' || String(value).trim() === '' || String(value).trim() === '-' || String(value).trim() === '*') {
    switch (type) {
      case 'email': return 'Not Provided';
      case 'phone': return 'Not Available';
      case 'department': return 'Not Assigned';
      case 'venue': return 'Venue not alloted';
      case 'poster': return 'Not Uploaded Yet';
      case 'feedback': return 'Not Submitted Yet';
      case 'approver': return 'Pending Assignment';
      case 'resourcePerson': return 'Not Assigned';
      case 'eventRef': return 'Pending Reference';
      case 'name': return 'Not Provided';
      default: return 'Not Available';
    }
  }
  return value;
};

/**
 * Canonical venue formatter.
 * Replaces all empty, null, N/A, "To be allocated" values with "No Venue Assigned".
 * Use this in ALL components, PDFs, emails, and reports.
 */
const INVALID_VENUES = new Set(['n/a', 'na', 'null', 'undefined', 'tba', 'to be allocated', 'not specified', 'not available', 'nil', '—', '-', '']);
export const formatVenue = (...venueArgs) => {
  for (const v of venueArgs) {
    if (v === null || v === undefined) continue;
    const trimmed = String(v).trim();
    if (trimmed === '' || INVALID_VENUES.has(trimmed.toLowerCase())) continue;
    return trimmed;
  }
  return 'Venue not alloted';
};

/**
 * Determines attendance mode based on event duration.
 * MULTI_DAY: numberOfDays > 1
 * SINGLE_SESSION: duration <= 4.5 hours (one session, P or A only)
 * FULL_DAY: duration > 4.5 hours (two sessions: Session 1 + Session 2)
 */
export const getAttendanceMode = (event) => {
  const n = event?.requisition?.step1?.numberOfDays || 1;
  if (n > 1) return 'MULTI_DAY';

  const startTime = event?.startTime || event?.requisition?.step1?.eventStartTime;
  const endTime = event?.endTime || event?.requisition?.step1?.eventEndTime;

  if (startTime && endTime) {
    const [sh, sm] = String(startTime).split(':').map(Number);
    const [eh, em] = String(endTime).split(':').map(Number);
    
    let durationMinutes = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    // Handle cross-midnight
    if (durationMinutes < 0) durationMinutes += 24 * 60;
    
    if (durationMinutes <= 270) { // <= 4.5 hours → single session
      return 'SINGLE_SESSION';
    }
    return 'FULL_DAY';
  }
  
  return 'FULL_DAY'; // Default fallback
};

/**
 * Checks if an event's registration is locked based on Event Start Time or Registration Closing Time.
 */
export const isRegistrationLocked = (event) => {
  if (!event) return true;

  const now = Date.now();
  const startDateStr = event?.requisition?.step1?.eventStartDate || event?.date;
  const startTimeStr = event?.requisition?.step1?.eventStartTime || event?.startTime || '00:00';
  
  if (!startDateStr) return false;

  // Compute Event Start Time
  const sDP = startDateStr.split('-');
  const sTP = startTimeStr.split(':');
  const startObj = new Date(parseInt(sDP[0]), parseInt(sDP[1])-1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1]));
  const eventStart = startObj.getTime();

  // Registration Closing Time (if specified)
  let registrationCloseTime = Infinity;
  if (event?.registrationClosingDate && event?.registrationClosingTime) {
      const rcDP = event.registrationClosingDate.split('-');
      const rcTP = event.registrationClosingTime.split(':');
      const rcObj = new Date(parseInt(rcDP[0]), parseInt(rcDP[1])-1, parseInt(rcDP[2]), parseInt(rcTP[0]), parseInt(rcTP[1]));
      registrationCloseTime = rcObj.getTime();
  } else if (event?.registrationClosesAt) {
      registrationCloseTime = new Date(event.registrationClosesAt).getTime();
  }
  
  
  return now >= eventStart || now >= registrationCloseTime;
};

/**
 * Calculates current event status based on dates.
 */
export const getEventStatus = (event) => {
  if (event?.status === 'CANCELLED') return 'cancelled';
  const now = Date.now();
  const startDateStr = event?.requisition?.step1?.eventStartDate || event?.date;
  const startTimeStr = event?.requisition?.step1?.eventStartTime || event?.startTime || '00:00';
  const endDateStr = event?.requisition?.step1?.eventEndDate || event?.date;
  const endTimeStr = event?.requisition?.step1?.eventEndTime || event?.endTime || '23:59';

  if (!startDateStr || !endDateStr) return 'upcoming';

  const sDP = String(startDateStr).split('-');
  const sTP = String(startTimeStr).split(':');
  const start = new Date(parseInt(sDP[0]), parseInt(sDP[1])-1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1])).getTime();

  const eDP = String(endDateStr).split('-');
  const eTP = String(endTimeStr).split(':');
  const end = new Date(parseInt(eDP[0]), parseInt(eDP[1])-1, parseInt(eDP[2]), parseInt(eTP[0]), parseInt(eTP[1])).getTime();

  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'ongoing';
  return 'completed';
};
