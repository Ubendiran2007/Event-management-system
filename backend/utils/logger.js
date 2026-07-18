const { admin, dbAdmin } = require('../firebaseAdmin');

const SENSITIVE_KEYS = ['password', 'token', 'session', 'otp', 'credential', 'secret', 'auth'];

// Helper to redact sensitive info
const redactPayload = (payload) => {
  if (!payload) return payload;
  if (typeof payload !== 'object') return payload;

  const redacted = Array.isArray(payload) ? [] : {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactPayload(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
};

// Base async logging function
const dispatchLog = async (collectionName, logEntry) => {
  try {
    const entry = {
      ...logEntry,
      environment: process.env.NODE_ENV || 'development',
      details: redactPayload(logEntry.details),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Fire and forget (asynchronous)
    dbAdmin.collection(collectionName).add(entry).catch((err) => {
      console.error(`[Logger] Failed to write to ${collectionName}:`, err);
    });
  } catch (error) {
    // Log failure locally but swallow it to not disrupt the main business workflow
    console.error(`[LOGGER ERROR] Failed to write to ${collectionName}:`, error.message);
  }
};

/**
 * Audit Logs (Auth, Security, High-level System access)
 */
const logAudit = (params) => {
  const { category, action, status, severity, source, correlationId, requestId, actor, target, details, ipAddress, userAgent, retry } = params;
  
  const logEntry = {
    category: category || 'SECURITY',
    action,
    status: status || 'SUCCESS',
    severity: severity || (status === 'FAILED' ? 'ERROR' : status === 'WARNING' ? 'WARNING' : 'INFO'),
    source: source || 'system',
    correlationId: correlationId || null,
    requestId: requestId || null,
    actor: actor || { userId: 'SYSTEM', name: 'System', role: 'SYSTEM' },
    target: target || null,
    details: details || {},
    retry: retry || null,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null
  };

  // Do not await to ensure it's non-blocking
  dispatchLog('auditLogs', logEntry);
};

/**
 * Activity Logs (User actions, Event creation, Approvals)
 */
const logActivity = (params) => {
  const { category, action, status, severity, source, correlationId, requestId, actor, target, details, retry } = params;

  const logEntry = {
    category: category || 'EVENT',
    action,
    status: status || 'SUCCESS',
    severity: severity || (status === 'FAILED' ? 'ERROR' : status === 'WARNING' ? 'WARNING' : 'INFO'),
    source: source || 'events',
    correlationId: correlationId || null,
    requestId: requestId || null,
    actor: actor || { userId: 'SYSTEM', name: 'System', role: 'SYSTEM' },
    target: target || null,
    details: details || {},
    retry: retry || null
  };

  dispatchLog('activityLogs', logEntry);
};

/**
 * Email Logs (Email delivery tracking)
 */
const logEmail = (params) => {
  const { action, status, severity, source, correlationId, requestId, target, details, retry } = params;

  const logEntry = {
    category: 'EMAIL',
    action,
    status: status || 'SUCCESS',
    severity: severity || (status === 'FAILED' ? 'ERROR' : status === 'WARNING' ? 'WARNING' : 'INFO'),
    source: source || 'emailService',
    correlationId: correlationId || null,
    requestId: requestId || null,
    actor: { userId: 'SYSTEM', name: 'Email Service', role: 'SYSTEM' },
    target: target || null,
    details: details || {},
    retry: retry || null
  };

  dispatchLog('emailLogs', logEntry);
};

module.exports = {
  logAudit,
  logActivity,
  logEmail,
  redactPayload
};
