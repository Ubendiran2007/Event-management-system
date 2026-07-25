/**
 * Centralized API Response Formatter
 * Ensures all endpoints follow the same JSON structure.
 */

const successResponse = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
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
