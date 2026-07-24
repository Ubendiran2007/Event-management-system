/**
 * Async Handler Wrapper
 * 
 * Wraps asynchronous Express route handlers and passes any thrown errors
 * directly to the next() function, eliminating the need for repetitive try/catch blocks.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
