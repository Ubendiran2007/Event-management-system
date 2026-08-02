/**
 * Frontend mirror of backend/utils/eventHelpers.
 * Used to compute registration lifecycle status in UI (Explore badges, dashboard info)
 * without making a round-trip to the server. MUST stay in sync with the source of truth.
 */

export const REGISTRATION_STATUSES = Object.freeze({
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  FINALIZED: 'FINALIZED',
  FULL: 'FULL',
  NOT_OPEN_YET: 'NOT_OPEN_YET'
});

export const INDIVIDUAL_REGISTRATION_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WAITLISTED: 'WAITLISTED',
  WITHDRAWN: 'WITHDRAWN'
});

export const EXTENSION_POLICY = Object.freeze({
  MAX_EXTENSIONS: Number(import.meta.env.VITE_REG_MAX_EXTENSIONS ?? 2),
  MAX_EXTENSION_DAYS: Number(import.meta.env.VITE_REG_MAX_EXTENSION_DAYS ?? 7)
});

/**
 * Returns a unified "registration" metadata object from a raw event document,
 * falling back to legacy flat fields for backward compatibility.
 */
export function getRegistrationMeta(eventData) {
  const reg = eventData?.registration || {};
  const legacyDeadline = eventData?.registrationDeadline || null;
  const hasExplicit = reg.enabled !== undefined || reg.status !== undefined || reg.currentDeadline !== undefined;
  const stats = eventData?.stats || {};
  const counts = eventData?.registrationCounts || {};
  const currentRegisteredCount =
    Number(stats.registeredCount) ||
    Number(counts.APPROVED) ||
    Number(reg.approvedCount) ||
    0;
  const maxParticipants = reg.maxParticipants ?? eventData?.capacity ?? null;
  const isFull = maxParticipants != null && currentRegisteredCount >= Number(maxParticipants);

  if (hasExplicit) {
    const currentDeadline = reg.currentDeadline || legacyDeadline || null;
    const originalDeadline = reg.originalDeadline || currentDeadline;
    return {
      enabled: reg.enabled !== false,
      status: reg.status || REGISTRATION_STATUSES.OPEN,
      opensAt: reg.opensAt || null,
      currentDeadline,
      originalDeadline,
      extensions: Array.isArray(reg.extensions) ? reg.extensions : [],
      extensionCount: reg.extensionCount || 0,
      maxParticipants,
      currentRegisteredCount,
      isFull,
      reopened: !!reg.reopened,
      closedBy: reg.closedBy || null,
      autoClosedAt: reg.autoClosedAt || null,
      finalizedAt: reg.finalizedAt || null,
      finalizedBy: reg.finalizedBy || null,
      notificationSent: !!reg.notificationSent,
      notificationSentAt: reg.notificationSentAt || null
    };
  }

  // Legacy fallback — derive from old flat fields + compute open/closed via deadline
  const capacity = maxParticipants;
  const deadline = legacyDeadline || (eventData?.startDate ? `${eventData.startDate}T${eventData.startTime || '23:59'}` : null);
  const registrationOpen = eventData?.registrationOpen ?? true;
  const now = Date.now();
  const dlTs = deadline ? new Date(deadline).getTime() : Infinity;
  let status;
  if (!registrationOpen) status = REGISTRATION_STATUSES.CLOSED;
  else if (dlTs <= now) status = REGISTRATION_STATUSES.CLOSED;
  else status = REGISTRATION_STATUSES.OPEN;

  return {
    enabled: registrationOpen,
    status,
    opensAt: null,
    currentDeadline: deadline,
    originalDeadline: deadline,
    extensions: [],
    extensionCount: 0,
    maxParticipants: capacity,
    currentRegisteredCount,
    isFull,
    reopened: false,
    closedBy: null,
    autoClosedAt: null,
    finalizedAt: null,
    finalizedBy: null,
    notificationSent: false,
    notificationSentAt: null
  };
}

/**
 * Compute a human-facing enum for the registration window state of an event.
 * Priority: FINALIZED → CLOSED → NOT_OPEN_YET → FULL → OPEN
 * FULL is a UI-only overlay (backend still allows registering until CLOSED)
 * so students understand they'll land on the waitlist even if the button
 * technically remains clickable.
 */
export function computeRegistrationStatus(eventData) {
  const meta = getRegistrationMeta(eventData);
  if (meta.status === REGISTRATION_STATUSES.FINALIZED) return REGISTRATION_STATUSES.FINALIZED;
  if (meta.status === REGISTRATION_STATUSES.CLOSED) return REGISTRATION_STATUSES.CLOSED;

  const nowTs = Date.now();
  if (meta.opensAt) {
    const opensTs = new Date(meta.opensAt).getTime();
    if (opensTs > nowTs) return REGISTRATION_STATUSES.NOT_OPEN_YET;
  }
  if (meta.currentDeadline) {
    const dlTs = new Date(meta.currentDeadline).getTime();
    if (dlTs <= nowTs) return REGISTRATION_STATUSES.CLOSED;
  }
  if (meta.isFull) return REGISTRATION_STATUSES.FULL;
  return REGISTRATION_STATUSES.OPEN;
}

/**
 * Returns whether an organizer is allowed to extend the registration deadline
 * based on the current extension count (admins can always extend).
 */
export function isExtensionAllowed(eventData, actingRole) {
  const meta = getRegistrationMeta(eventData);
  if (meta.status === REGISTRATION_STATUSES.FINALIZED) {
    return { allowed: false, reason: 'Registration has already been finalized.' };
  }
  const count = meta.extensionCount || 0;
  if (['SYSTEM_ADMIN', 'IQAC_TEAM'].includes(actingRole)) {
    return { allowed: true, limitOverride: true };
  }
  if (count >= EXTENSION_POLICY.MAX_EXTENSIONS) {
    return {
      allowed: false,
      reason: `Maximum ${EXTENSION_POLICY.MAX_EXTENSIONS} extensions reached. Contact IQAC for an override.`
    };
  }
  return { allowed: true };
}

/**
 * Checks if given role is allowed to extend (role gating + organizer ownership).
 */
export function isRoleAllowedToExtend(role, eventData, actingUserId) {
  if (['SYSTEM_ADMIN', 'IQAC_TEAM'].includes(role)) return true;
  if (role === 'FACULTY' || role === 'HOD') return true;
  if (role === 'STUDENT_ORGANIZER') {
    const organizerId = String(eventData?.organizerId ?? eventData?.createdBy ?? '');
    return String(actingUserId ?? '') === organizerId;
  }
  return false;
}

/**
 * Format a datetime-local input value into a "YYYY-MM-DDTHH:mm" string
 * using local TZ so users see the wall time they picked.
 */
export function toInputLocal(isoOrDate) {
  if (!isoOrDate) return '';
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Convert "YYYY-MM-DDTHH:mm" input to ISO 8601 UTC string for the API.
 */
export function fromInputLocal(localValue) {
  if (!localValue) return null;
  return new Date(localValue).toISOString();
}

/**
 * Countdown-style human label for the deadline.
 */
export function formatDeadlineLabel(isoOrNull) {
  if (!isoOrNull) return 'No deadline';
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return 'Invalid date';
  const diff = d.getTime() - Date.now();
  const absMin = Math.floor(Math.abs(diff) / 60000);
  const suffix = diff < 0 ? ' ago' : ' remaining';
  if (absMin < 60) return `${absMin} min${suffix}`;
  const hr = Math.floor(absMin / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? '' : 's'}${suffix}`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? '' : 's'}${suffix}`;
}
