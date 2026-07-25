/**
 * Custom Error Classes for Centralized Error Handling
 * Defines explicit error types mapping to specific HTTP status codes.
 */

class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Indicates an expected operational error, not a bug
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class PermissionError extends AppError {
  constructor(message = 'Forbidden: Insufficient permissions', details = null) {
    super(message, 403, 'PERMISSION_ERROR', details);
  }
}

class WorkflowError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'WORKFLOW_ERROR', details); // Represents invalid state transitions
  }
}

class ConflictError extends AppError {
  constructor(message, details = null) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

class ReservationError extends AppError {
  constructor(message, details = null) {
    super(message, 409, 'RESERVATION_ERROR', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'NOT_FOUND_ERROR', details);
  }
}

class InternalError extends AppError {
  constructor(message = 'Internal server error', details = null) {
    super(message, 500, 'INTERNAL_ERROR', details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  PermissionError,
  WorkflowError,
  ConflictError,
  ReservationError,
  NotFoundError,
  InternalError
};
