/**
 * Centralized API Response Formatter
 * Ensures all endpoints follow the same JSON structure.
 */

const successResponse = (res, data = {}, message = 'Success', statusCode = 200, meta = null) => {
  const body = { success: true, message, data };
  if (meta) Object.assign(body, meta);
  return res.status(statusCode).json(body);
};

const errorResponse = (res, message = 'Internal Server Error', errorCode = 'SERVER_ERROR', statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    errorCode,
    message
  });
};

module.exports = {
  successResponse,
  errorResponse
};
