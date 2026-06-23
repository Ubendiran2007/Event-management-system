/**
 * Centralized API utility for the Event Management Portal.
 *
 * Automatically attaches the Bearer session token to every request.
 * Use this instead of raw fetch() for all backend API calls so that:
 *   - The Authorization header is always present
 *   - The backend never has to trust req.body for role/department
 *   - 401 responses (expired/invalid token) are handled globally
 */

const API_BASE = 'http://localhost:5001';

function getToken() {
  return localStorage.getItem('sessionToken') || '';
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
    // Token expired or invalid — clear storage and redirect to login
    console.warn('[API] Unauthorized — clearing session and redirecting to login');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return;
  }
  return res.json();
}

export const api = {
  get: (path, query = {}) => {
    const params = new URLSearchParams(query).toString();
    const url = `${API_BASE}${path}${params ? '?' + params : ''}`;
    return fetch(url, { headers: buildHeaders() }).then(handleResponse);
  },

  post: (path, body) =>
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  patch: (path, body) =>
    fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  put: (path, body) =>
    fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  delete: (path) =>
    fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse),
};
