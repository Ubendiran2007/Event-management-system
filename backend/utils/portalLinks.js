/**
 * Centralized Portal Redirection Link Generator
 * Generates secure, authentication-aware URLs for email notification buttons and fallbacks.
 * Ensures users are redirected to login if unauthenticated, preserving their destination path.
 */

const getBaseUrl = () => {
  const url = process.env.FRONTEND_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, ''); // Strip trailing slashes
};

/**
 * Wraps a deep link path in an authentication redirect wrapper if required.
 * Example: /student/events/123/od-letter -> /login?redirect=/student/events/123/od-letter
 */
const withAuthRedirect = (path, requiresAuth = true) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!requiresAuth) {
    return `${getBaseUrl()}${cleanPath}`;
  }
  const encodedPath = encodeURIComponent(cleanPath);
  return `${getBaseUrl()}/login?redirect=${encodedPath}`;
};

const portalLinks = {
  // Public or direct event viewing
  event: (eventId) => `${getBaseUrl()}/events/${eventId}`,
  getEventLink: (eventId) => `${getBaseUrl()}/events/${eventId}`,
  
  // Protected approval workflows requiring login
  approval: (eventId) => withAuthRedirect(`/hod/events/${eventId}/approval`),
  getApprovalLink: (eventId, role) => withAuthRedirect(`/${role || 'hod'}/events/${eventId}/approval`),
  postponement: (requestId) => withAuthRedirect(`/approvals/postponement/${requestId}`),
  cancellation: (requestId) => withAuthRedirect(`/approvals/cancellation/${requestId}`),
  iqacSubmission: (eventId) => withAuthRedirect(`/iqac/submission/${eventId}`),
  getIQACLink: (eventId) => withAuthRedirect(`/iqac/submission/${eventId}`),
  extension: (requestId) => withAuthRedirect(`/iqac/extensions/${requestId}`),
  
  // Student registration and OD workflows requiring login
  odLetter: (eventId) => withAuthRedirect(`/student/events/${eventId}/od-letter`),
  registration: (eventId) => withAuthRedirect(`/student/events/${eventId}`),
  
  // Manager invitation workflow requiring login
  managerInvitation: (invitationId) => withAuthRedirect(`/manager/invitations/${invitationId}`),
  
  // Security workflows (public or standalone tokens)
  passwordReset: (token) => `${getBaseUrl()}/reset-password?token=${encodeURIComponent(token || '')}`,
  support: () => `${getBaseUrl()}/support/account`
};

module.exports = portalLinks;
