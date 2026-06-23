/**
 * Authentication & Authorization Middleware
 *
 * This system uses signed session tokens (HMAC-SHA256) instead of Firebase Auth
 * because the backend uses the Firebase CLIENT SDK (not Admin SDK), which cannot
 * verify Firebase ID tokens server-side without a service account key.
 *
 * Session token is issued on /api/login and must be sent in the
 * Authorization header: "Bearer <token>"
 *
 * Role and department are embedded in the signed token — they are NEVER
 * read from req.body, preventing spoofing attacks.
 */

const crypto = require('crypto');

// ─── Token Config ──────────────────────────────────────────────────────────────
const TOKEN_SECRET = process.env.SESSION_SECRET || 'sece-eventportal-secret-change-in-prod';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// ─── Token Utilities ──────────────────────────────────────────────────────────

function sign(payload) {
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('hex');
  return Buffer.from(data).toString('base64') + '.' + sig;
}

function verify(token) {
  try {
    const [b64, sig] = token.split('.');
    if (!b64 || !sig) return null;
    const data = Buffer.from(b64, 'base64').toString('utf-8');
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) return null;
    const payload = JSON.parse(data);
    if (Date.now() > payload.exp) return null; // expired
    return payload;
  } catch {
    return null;
  }
}

function issueToken(user) {
  return sign({
    id: user.id,
    role: String(user.role || '').toUpperCase(),
    department: user.department || null,
    assignedClasses: user.assignedClasses || [],
    name: user.name || '',
    email: user.email || '',
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
  });
}

// ─── Middleware: requireAuth ──────────────────────────────────────────────────
// Attaches req.user = { id, role, department, name, email } from the verified token.
// Does NOT trust any role/department fields from req.body or req.query.

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: No session token provided.' });
  }

  const payload = verify(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired token.' });
  }

  req.user = {
    id: payload.id,
    role: payload.role,
    department: payload.department,
    assignedClasses: payload.assignedClasses || [],
    name: payload.name,
    email: payload.email,
  };

  next();
}

// ─── Middleware: requireRole ──────────────────────────────────────────────────
// Factory that returns middleware restricting access to specific roles.
// Usage: router.patch('/status', requireAuth, requireRole(['FACULTY', 'HOD']), handler)

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: This action requires one of these roles: ${allowedRoles.join(', ')}.`,
      });
    }
    next();
  };
}

// ─── Middleware: requireDeptMatch ─────────────────────────────────────────────
// Ensures a department-scoped role can only act on events in THEIR department.
// Pass the field from Firestore doc that holds the event department.
// Usage inside a route after fetching the event doc.

function assertDeptMatch(req, eventDept) {
  const userDept = req.user?.department;
  const rolesToCheck = ['FACULTY', 'HOD'];
  if (!rolesToCheck.includes(req.user?.role)) return true; // non-dept roles skip check
  if (!userDept || !eventDept) return false;
  return userDept.toUpperCase() === eventDept.toUpperCase();
}

module.exports = { issueToken, requireAuth, requireRole, assertDeptMatch };
