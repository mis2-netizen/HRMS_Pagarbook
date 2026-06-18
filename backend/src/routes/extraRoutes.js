const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  getAuditLogs,
  getNotifications,
  markNotificationRead,
  getReportsData
} = require('../controllers/extraController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// Settings
router.get('/settings', verifyToken, getSettings);
router.put('/settings', verifyToken, authorizeRoles('super_admin', 'hr'), updateSettings);

// Audit Logs
router.get('/audit-logs', verifyToken, authorizeRoles('super_admin', 'hr'), getAuditLogs);

// Notifications
router.get('/notifications', verifyToken, getNotifications);
router.put('/notifications/:id/read', verifyToken, markNotificationRead);

// Reports / Dashboard metrics
router.get('/reports', verifyToken, authorizeRoles('super_admin', 'hr', 'manager'), getReportsData);

module.exports = router;
