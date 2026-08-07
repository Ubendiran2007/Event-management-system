const { body, validationResult } = require('express-validator');

// Reusable validation checker
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
};

// Validation rules for Event Creation
const validateEvent = [
  body('title').trim().notEmpty().withMessage('Event title is required.'),
  body('department').trim().notEmpty().withMessage('Department is required.'),
  // Allow DRAFT to be passed from client; all other status values are server-controlled
  body('status')
    .optional()
    .custom((val) => {
      if (val !== undefined && val !== 'DRAFT') {
        throw new Error('Status cannot be set manually.');
      }
      return true;
    }),
  handleValidationErrors
];

// Validation rules for OD Requests
const validateODRequest = [
  body('eventId').trim().notEmpty().withMessage('Event ID is required.'),
  body('title').trim().notEmpty().withMessage('Event title is required.'),
  body('date').trim().notEmpty().withMessage('Date is required.'),
  // Ensure studentId is not injected, it must come from req.user
  body('studentId').not().exists().withMessage('studentId cannot be submitted in the body; it is inferred from your session.'),
  body('status').not().exists().withMessage('Status cannot be set manually.'),
  handleValidationErrors
];

module.exports = {
  validateEvent,
  validateODRequest,
  handleValidationErrors
};
