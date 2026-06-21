/**
 * Formats a student roll number for display.
 * - Strips the `student_` prefix from Firebase document IDs
 * - Falls back gracefully if no value is provided
 * - Always returns uppercase
 *
 * @param {string} rollNo - Primary roll number field (e.g. "24CS257")
 * @param {string} [fallbackId] - Fallback identifier (e.g. Firebase doc ID "student_24cs257")
 * @returns {string}
 */
export const formatRollNo = (rollNo, fallbackId = '') => {
  const raw = rollNo || fallbackId || '';
  if (!raw) return '-';
  return String(raw)
    .trim()
    .replace(/^student_/i, '')
    .toUpperCase();
};
