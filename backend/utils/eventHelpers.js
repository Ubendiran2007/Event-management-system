function computeRegistrationStatus(eventData) {
  const registration = eventData.registration || {};

  if (registration.status === 'FINALIZED') return 'FINALIZED';
  if (registration.status === 'CLOSED') return 'CLOSED';

  const stats = eventData.stats || {};
  const currentRegisteredCount = stats.registeredCount || 0;

  if (eventData.capacity && currentRegisteredCount >= eventData.capacity) {
    return 'FULL';
  }

  const startDateStr = eventData.requisition?.step1?.eventStartDate || eventData.date;
  const startTimeStr = eventData.requisition?.step1?.eventStartTime || eventData.startTime || '00:00';
  let effectiveDeadlineTimestamp = null;
  let eventStartTimestamp = null;

  try {
    if (startDateStr) {
      const sDP = startDateStr.split('-');
      const sTP = startTimeStr.split(':');
      eventStartTimestamp = new Date(parseInt(sDP[0]), parseInt(sDP[1]) - 1, parseInt(sDP[2]), parseInt(sTP[0]), parseInt(sTP[1])).getTime();
    }
  } catch (err) {}

  if (registration.currentDeadline) {
    effectiveDeadlineTimestamp = new Date(registration.currentDeadline).getTime();
  } else if (eventData.registrationDeadline) {
    effectiveDeadlineTimestamp = new Date(eventData.registrationDeadline).getTime();
  } else if (eventStartTimestamp) {
    effectiveDeadlineTimestamp = eventStartTimestamp;
  }

  if (registration.status === 'OPEN') return 'OPEN';
  if (registration.status === 'CLOSED') return 'CLOSED';

  if (effectiveDeadlineTimestamp && Date.now() >= effectiveDeadlineTimestamp) {
    return 'CLOSED';
  } else if (!effectiveDeadlineTimestamp && startDateStr) {
    const today = new Date().toISOString().split('T')[0];
    if (startDateStr < today) {
      return 'CLOSED';
    }
  }

  if (eventData.registrationOpen === false) return 'CLOSED';

  return 'OPEN';
}

function getRegistrationMeta(eventData) {
  const registration = eventData.registration || {};
  return {
    enabled: registration.enabled ?? (eventData.registrationEnabled ?? true),
    opensAt: registration.opensAt || null,
    originalDeadline: registration.originalDeadline || eventData.registrationDeadline || null,
    currentDeadline: registration.currentDeadline || eventData.registrationDeadline || null,
    extensionCount: registration.extensionCount || 0,
    extensions: registration.extensions || [],
    status: registration.status || computeRegistrationStatus(eventData),
    finalizedAt: registration.finalizedAt || null,
    finalizedBy: registration.finalizedBy || null,
    notificationSent: registration.notificationSent || false,
    notificationSentAt: registration.notificationSentAt || null,
    maxParticipants: registration.maxParticipants || eventData.capacity || null,
    waitlistEnabled: registration.waitlistEnabled || false,
  };
}

const REGISTRATION_STATUSES = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  FINALIZED: 'FINALIZED',
};

const INDIVIDUAL_REGISTRATION_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WAITLISTED: 'WAITLISTED',
  WITHDRAWN: 'WITHDRAWN',
};

const EXTENSION_POLICY = {
  MAX_EXTENSIONS: parseInt(process.env.REG_MAX_EXTENSIONS || '2', 10),
  MAX_EXTENSION_DAYS: parseInt(process.env.REG_MAX_EXTENSION_DAYS || '7', 10),
};

function isExtensionAllowed(eventData, actingRole) {
  const meta = getRegistrationMeta(eventData);
  if (!meta.enabled) return { allowed: false, reason: 'Registration is not enabled for this event.' };
  if (meta.status === 'FINALIZED') return { allowed: false, reason: 'Registration has already been finalized.' };
  if (meta.notificationSent) return { allowed: false, reason: 'Notification emails have already been sent.' };
  if (meta.extensionCount >= EXTENSION_POLICY.MAX_EXTENSIONS && !['IQAC_TEAM', 'SYSTEM_ADMIN'].includes(actingRole)) {
    return { allowed: false, reason: `Maximum ${EXTENSION_POLICY.MAX_EXTENSIONS} extensions reached. Admin override required.` };
  }
  return { allowed: true };
}

function isRoleAllowedToExtend(role, eventData, actingUserId) {
  const organizerId = eventData.organizerId || eventData.createdBy;
  if (['SYSTEM_ADMIN', 'IQAC_TEAM', 'HOD'].includes(role)) return true;
  if (['FACULTY', 'STUDENT_ORGANIZER'].includes(role) && String(organizerId) === String(actingUserId)) return true;
  return false;
}

module.exports = {
  computeRegistrationStatus,
  getRegistrationMeta,
  REGISTRATION_STATUSES,
  INDIVIDUAL_REGISTRATION_STATUSES,
  EXTENSION_POLICY,
  isExtensionAllowed,
  isRoleAllowedToExtend,
};

