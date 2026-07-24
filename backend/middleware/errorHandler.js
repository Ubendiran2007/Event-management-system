/**
 * Centralized Error Handler Middleware
 * 
 * Standardizes API error responses and strips stack traces in production.
 */
function errorHandler(err, req, res, next) {
  // If the headers have already been sent, delegate to the default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = err.status || err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  const errorResponse = {
    success: false,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred.',
  };

  // Only leak stack traces in development
  if (isDevelopment && statusCode >= 500) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler;
