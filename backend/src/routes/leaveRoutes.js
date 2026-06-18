const express = require('express');
const router = express.Router();
const {
  getEmployeeLeaveBalances,
  getMyLeaves,
  applyLeave,
  getLeaveRequests,
  approveRejectLeave
} = require('../controllers/leaveController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// Employee app endpoints
router.get('/balances', verifyToken, getEmployeeLeaveBalances);
router.get('/my', verifyToken, getMyLeaves);
router.post('/apply', verifyToken, applyLeave);

// HR / Admin portal endpoints
router.get('/requests', verifyToken, authorizeRoles('super_admin', 'hr', 'manager'), getLeaveRequests);
router.post('/requests/:id/approve', verifyToken, authorizeRoles('super_admin', 'hr'), approveRejectLeave);

module.exports = router;
