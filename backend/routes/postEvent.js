const express = require('express');
const router = express.Router();
const PostEventService = require('../services/postEventService');
const { authenticateToken } = require('../middleware/auth');
const { logAudit } = require('../utils/logger');

// Update Section Draft/Submit/Verified
router.patch('/:eventId/sections/:section', authenticateToken, async (req, res) => {
  try {
    const { eventId, section } = req.params;
    const { data, state } = req.body;
    
    // Validate state
    if (!['DRAFT', 'SUBMITTED', 'VERIFIED'].includes(state)) {
      return res.status(400).json({ success: false, message: 'Invalid state. Must be DRAFT, SUBMITTED, or VERIFIED.' });
    }

    const result = await PostEventService.updateSection(eventId, section, data, state, req.user);
    res.json(result);
  } catch (error) {
    if (error.message.includes('FORBIDDEN')) return res.status(403).json({ success: false, message: error.message });
    if (error.message.includes('NOT_FOUND')) return res.status(404).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit entire Post Event Workspace
router.post('/:eventId/submit', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await PostEventService.submitPostEventWorkspace(eventId, req.user);
    res.json(result);
  } catch (error) {
    if (error.message.includes('BAD_REQUEST')) return res.status(400).json({ success: false, message: error.message });
    if (error.message.includes('NOT_FOUND')) return res.status(404).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
