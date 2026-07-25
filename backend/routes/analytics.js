const express = require('express');
const router = express.Router();

// Enforce authentication for all routes in this router
const { requireAuth } = require('../middleware/auth');
router.use(requireAuth);

const { logActivity, logAudit } = require('../utils/logger');
const AnalyticsService = require('../services/analyticsService');
const { UserRole } = require('../events/constants/eventTypes');

// ==========================================
// POST /api/analytics/log-export
// ==========================================
router.post('/log-export', async (req, res) => {
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



// ==========================================
// GET /api/analytics/operational
// ==========================================
router.get('/operational', async (req, res) => {
  try {
    const data = await AnalyticsService.getOperationalAnalytics();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// GET /api/analytics/reporting
// ==========================================
router.get('/reporting', async (req, res) => {
  try {
    if (req.user.role !== UserRole.IQAC && req.user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access required.' });
    }

    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const department = req.query.department || null;

    const data = await AnalyticsService.getReportingAnalytics(month, year, department);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
