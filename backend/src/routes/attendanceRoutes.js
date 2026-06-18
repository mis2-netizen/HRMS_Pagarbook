const express = require('express');
const router = express.Router();
const {
  getTodayStatus,
  punchIn,
  punchOut,
  requestCorrection,
  getPendingCorrections,
  approveCorrection,
  getDailyAttendanceGrid,
  getMonthlyAttendanceGrid,
  manualMarkAttendance
} = require('../controllers/attendanceController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// Employee mobile app endpoints
router.get('/today', verifyToken, getTodayStatus);
router.post('/punch-in', verifyToken, punchIn);
router.post('/punch-out', verifyToken, punchOut);
router.post('/correction', verifyToken, requestCorrection);

// HR / Manager Dashboard endpoints
router.get('/corrections', verifyToken, authorizeRoles('super_admin', 'hr'), getPendingCorrections);
router.post('/corrections/:id/approve', verifyToken, authorizeRoles('super_admin', 'hr'), approveCorrection);
router.get('/daily', verifyToken, authorizeRoles('super_admin', 'hr', 'manager'), getDailyAttendanceGrid);
router.get('/monthly', verifyToken, authorizeRoles('super_admin', 'hr', 'manager'), getMonthlyAttendanceGrid);
router.post('/manual', verifyToken, authorizeRoles('super_admin', 'hr'), manualMarkAttendance);

module.exports = router;
