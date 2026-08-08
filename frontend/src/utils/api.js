/**
 * Centralized API utility for the Event Management Portal.
 *
 * Automatically attaches the Bearer session token to every request.
 * Use this instead of raw fetch() for all backend API calls so that:
 *   - The Authorization header is always present
 *   - The backend never has to trust req.body for role/department
 *   - 401 responses (expired/invalid token) are handled globally
 */

const API_BASE = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'http://localhost:5001');

/**
 * Returns the current auth token from localStorage.
 * Checks both 'sessionToken' (primary) and 'token' (legacy) keys so that any
 * login flow that writes to either key will still authenticate correctly.
 *
 * Import this into any module that needs a Bearer token instead of reading
 * localStorage directly, so the fallback logic lives in exactly one place.
 */
export function getAuthToken() {
  return localStorage.getItem('sessionToken') || localStorage.getItem('token') || '';
}

// Keep the internal alias for backward-compat within this module
function getToken() {
  return getAuthToken();
}


function buildHeaders(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function handleResponse(res) {
  if (res.status === 401) {
    console.warn('[API] Unauthorized — clearing session');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentUser');
    // Only redirect if NOT already on the login page — prevents reload loop
    if (!window.location.pathname.includes('/login') && window.location.pathname !== '/') {
      window.location.href = '/login';
    }
    return { success: false, message: 'Session expired. Please log in again.' };
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    let text = '';
    try {
      text = await res.text();
    } catch (_e) { /* ignore */ }
    const snippet = (text || '').slice(0, 200);
    const defaultMsg = `Backend responded with status ${res.status} instead of JSON. Please try again in a moment.`;
    console.warn('[API] Non-JSON response received:', res.status, contentType, snippet);
    if (res.status >= 500) return { success: false, message: `Server error (${res.status}). ${defaultMsg}` };
    if (res.status === 404) return { success: false, message: `Endpoint not found (404). ${defaultMsg}` };
    if (res.status >= 400) return { success: false, message: `Request failed (${res.status}). ${defaultMsg}` };
    return { success: false, message: defaultMsg };
  }

  try {
    return await res.json();
  } catch (parseErr) {
    console.warn('[API] JSON parse failed:', parseErr.message);
    return { success: false, message: 'Server response was not valid JSON. Please try again.' };
  }
}

export const api = {
  get: (path, query = {}) => {
    // Filter out undefined/null values to prevent "undefined" string in query params
    const cleanQuery = Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null)
    );
    const params = new URLSearchParams(cleanQuery).toString();
    const url = `${API_BASE}${path}${params ? '?' + params : ''}`;
    return fetch(url, { headers: buildHeaders() }).then(handleResponse);
  },

  post: (path, body) =>
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
    }).then(handleResponse),

  patch: (path, body) =>
    fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
    }).then(handleResponse),

  put: (path, body) =>
    fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
    }).then(handleResponse),

  delete: (path) =>
    fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: buildHeaders(),
      cache: 'no-store',
    }).then(handleResponse),
};

/**
 * Registration lifecycle domain helpers — one-to-one mapping to the new
 * backend endpoints in backend/routes/events.js. All calls go through the
 * central api.* wrapper above, so session tokens and 401 handling are automatic.
 */
export const acceptInvitation = (eventId) => api.post(`/api/invitations/${eventId}/accept`, {});
export const declineInvitation = (eventId) => api.post(`/api/invitations/${eventId}/decline`, {});
export const revokeManagerRequest = (eventId, reason) => api.post(`/api/invitations/${eventId}/revoke-request`, { reason });
export const approveRevokeRequest = (eventId, managerEmail, reason) => api.post(`/api/invitations/${eventId}/approve-revoke`, { managerEmail, reason });
export const removeManager = (eventId, managerEmail, reason) => api.post(`/api/invitations/${eventId}/remove-manager`, { managerEmail, reason });

export const registrationApi = {
  list: (eventId, options = {}) =>
    api.get(`/api/events/${eventId}/registrations`, {
      status: options.status || '',
      limit: options.limit || 100,
      offset: options.offset || 0
    }),

  history: (eventId) => api.get(`/api/events/${eventId}/registration/history`),

  extendDeadline: (eventId, { newDeadline, reason }) =>
    api.patch(`/api/events/${eventId}/registration/deadline`, { newDeadline, reason }),

  bulkApprove: (eventId, ids = []) =>
    api.post(`/api/events/${eventId}/registration/bulk-approve`, { ids }),

  bulkReject: (eventId, ids = [], reason = '') =>
    api.post(`/api/events/${eventId}/registration/bulk-reject`, { ids, reason }),

  finalize: (eventId, confirm = true) =>
    api.post(`/api/events/${eventId}/registration/finalize`, { confirm }),

  finalizeWithOptions: (eventId, options) =>
    api.post(`/api/events/${eventId}/registration/finalize`, options || { confirm: true }),

  setStatus: (eventId, userId, status) =>
    api.patch(`/api/events/${eventId}/registrations/${userId}/status`, { status })
};

/**
 * Venue Reservation Lifecycle domain helpers — one-to-one mapping to the new
 * backend endpoints in backend/routes/venues.js. All calls go through the
 * central api.* wrapper above, so session tokens and 401 handling are automatic.
 */
export const venueApi = {
  // If date/startTime/endTime or startDate/endDate/startTime/endTime provided, uses the fast batch availability endpoint
  listActive: (params = {}) => {
    const hasDate = (params.date || params.startDate) && params.startTime && params.endTime;
    if (hasDate) {
      return api.get('/api/venues/available', params);
    }
    return api.get('/api/venues', params);
  },

  listAll: (params = {}) => api.get('/api/venues/all', params),

  getHoldDurationOptions: () => api.get('/api/venues/hold-duration-options'),

  /**
   * Stage 1: Create a temporary HELD venue reservation.
   * Body fields: date, startTime, endTime, eventDraftId?, coordinatorName?
   */
  holdVenue: (venueId, payload = {}) =>
    api.post(`/api/venues/${venueId}/hold`, payload),

  /**
   * Release a HELD reservation explicitly (organizer cancels drafting).
   */
  releaseHold: (venueId, reservationId) =>
    api.post(`/api/venues/${venueId}/release`, { reservationId }),

  /**
   * Extend a currently active HELD reservation.
   * addMinutes: one of [10, 15, 30, 45, 60]
   */
  extendHold: (venueId, reservationId, addMinutes) =>
    api.post(`/api/venues/${venueId}/extend-hold`, { reservationId, addMinutes }),

  /**
   * Admin-only: Force convert a HELD reservation → BOOKED (bypasses event creation).
   */
  bookVenue: (venueId, reservationId, eventId = null) =>
    api.post(`/api/venues/${venueId}/book`, { reservationId, eventId }),

  /**
   * Get availability of a specific venue slot for given date/startTime/endTime.
   * Returns { available, status: 'AVAILABLE'|'HELD'|'BOOKED'|'UNAVAILABLE', earliestAvailable?, conflictingReservation? }
   */
  getSlotStatus: (venueId, { date, startTime, endTime, skipReservationId, skipEventId }) =>
    api.get(`/api/venues/${venueId}/status`, { date, startTime, endTime, skipReservationId: skipReservationId || '', skipEventId: skipEventId || '' }),

  /**
   * List active HELD reservations (scoped by role).
   */
  listHolds: (params = {}) => api.get('/api/venues/holds', params),

  /**
   * List BOOKED reservations (scoped by role).
   */
  listBookings: (params = {}) => api.get('/api/venues/bookings', params),

  /**
   * Get venue calendar (events + holds + maintenance) for a date range.
   */
  getCalendar: (venueId, startDate, endDate) =>
    api.get(`/api/venues/${venueId}/calendar`, { startDate, endDate }),

  /**
   * Legacy reserve alias — still returns hold info (maps to holdVenue internally in backend).
   */
  reserveVenue: (payload = {}) =>
    api.post('/api/venues/reserve', payload),

  /**
   * Validate a hold right before event submission.
   */
  validateHold: (payload = {}) =>
    api.post('/api/venues/validate-hold', payload),

  /**
   * Admin overrides: force_release | force_expire | force_reassign (newVenueId).
   */
  adminOverride: (reservationId, action, payload = {}) =>
    api.post(`/api/venues/reservations/${reservationId}/admin/${action}`, payload)
};
