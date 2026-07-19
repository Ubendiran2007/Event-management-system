const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { logActivity, logAudit } = require('../utils/logger');

// ==========================================
// POST /api/analytics/log-export
// ==========================================
router.post('/log-export', requireAuth, async (req, res) => {
  try {
    const { exportType, reportName, status = 'SUCCESS', details = {} } = req.body;
    
    // Ensure all required fields are provided
    if (!exportType || !reportName) {
      return res.status(400).json({ success: false, message: 'exportType and reportName are required' });
    }
    
    // Validate export format
    if (!['PDF', 'Excel', 'CSV'].includes(exportType)) {
      return res.status(400).json({ success: false, message: 'Invalid export type. Must be PDF, Excel, or CSV.' });
    }

    const actor = {
      userId: req.user.id || req.user.email,
      name: req.user.name || req.user.email,
      role: req.user.role,
      department: req.user.department || 'N/A'
    };

    const payload = {
      category: 'REPORT_EXPORT',
      action: `EXPORT_${exportType.toUpperCase()}`,
      status,
      actor,
      target: reportName,
      details: {
        exportType,
        reportName,
        ...details
      }
    };

    // Log to both Activity and Security logs as requested
    logActivity(payload);
    logAudit(payload);

    return res.json({ success: true, message: 'Export logged successfully.' });
  } catch (error) {
    console.error('Failed to log export:', error);
    return res.status(500).json({ success: false, message: 'Failed to log export' });
  }
});

module.exports = router;
