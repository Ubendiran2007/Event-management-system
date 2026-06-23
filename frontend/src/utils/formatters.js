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
      case 'venue': return 'Not Specified';
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

