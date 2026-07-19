const bcrypt = require('bcryptjs');

/**
 * Builds the staff data object, performing password hashing.
 * @param {Object} payload 
 * @returns {Promise<{userId: string, userData: Object}>}
 */
const buildStaffData = async ({ name, email, role, department, password, assignedClasses, staffId }) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const userId = staffId ? `staff_${staffId}` : `staff_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  const userData = {
    name,
    email: email.toLowerCase(),
    role: role.toUpperCase(),
    department: department || null,
    assignedClasses: assignedClasses || [],
    password: hashedPassword,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return { userId, userData };
};

/**
 * Builds the student data object.
 * Note: The existing system stores student passwords as plain text, defaulting to rollNo.
 * @param {Object} payload 
 * @returns {{studentId: string, studentData: Object}}
 */
const buildStudentData = ({ name, rollNo, email, department, className, section, phone, odLimit, password, academicBatch }) => {
  const studentId = `student_${rollNo}`;
  
  let admissionYear = null;
  let graduationYear = null;
  if (academicBatch) {
    const parts = academicBatch.split('-');
    if (parts.length === 2) {
      admissionYear = parseInt(parts[0], 10) || null;
      graduationYear = parseInt(parts[1], 10) || null;
    }
  }
  
  const studentData = {
    name,
    rollNo,
    email,
    username: email,
    class: className,
    section: section || className,
    department: department || '',
    phone: phone || '',
    role: 'STUDENT_GENERAL',
    studentStatus: 'ACTIVE',
    password: password || rollNo,
    odUsed: 0,
    odLimit: odLimit !== undefined ? Number(odLimit) : 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    odResetTimestamp: new Date().toISOString(),
    ...(academicBatch && { academicBatch, admissionYear, graduationYear })
  };

  return { studentId, studentData };
};

module.exports = {
  buildStaffData,
  buildStudentData
};
