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
 * Securely hashes passwords using bcrypt.
 * @param {Object} payload 
 * @returns {Promise<{studentId: string, studentData: Object}>}
 */
const buildStudentData = async ({ name, rollNo, email, department, className, section, phone, odLimit, password, academicBatch }) => {
  const studentId = `student_${rollNo}`;
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password || rollNo, salt);
  
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
    class: className || section,
    section: section || className,
    department: department || '',
    phone: phone || '',
    role: 'STUDENT_GENERAL',
    studentStatus: 'ACTIVE',
    password: hashedPassword,
    odUsed: 0,
    odLimit: odLimit !== undefined ? Number(odLimit) : 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    odResetTimestamp: new Date().toISOString(),
    academicBatch,
    admissionYear,
    graduationYear
  };

  return { studentId, studentData };
};

module.exports = {
  buildStaffData,
  buildStudentData
};
