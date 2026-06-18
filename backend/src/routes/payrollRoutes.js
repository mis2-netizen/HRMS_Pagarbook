const express = require('express');
const router = express.Router();
const {
  previewPayroll,
  runPayroll,
  lockPayroll,
  unlockPayroll,
  getPayrollRecords,
  updatePaymentStatus,
  downloadSalarySlip
} = require('../controllers/payrollController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');
const { getQuery } = require('../config/db');

// HR Operations
router.get('/preview', verifyToken, authorizeRoles('super_admin', 'hr'), previewPayroll);
router.post('/run', verifyToken, authorizeRoles('super_admin', 'hr'), runPayroll);
router.post('/lock', verifyToken, authorizeRoles('super_admin', 'hr'), lockPayroll);
router.post('/unlock', verifyToken, authorizeRoles('super_admin'), unlockPayroll); // Super Admin only

// View records
router.get('/records', verifyToken, authorizeRoles('super_admin', 'hr', 'manager'), getPayrollRecords);
router.put('/:id/payment', verifyToken, authorizeRoles('super_admin', 'hr'), updatePaymentStatus);

// Slip Download (accessible by employee for their own slip, or by HR/Admin for all slips)
router.get('/:id/slip', verifyToken, async (req, res, next) => {
  const { id } = req.params;
  const { role, employeeId, companyId } = req.user;

  if (role === 'employee') {
    // Verify that this payroll record belongs to the current logged in employee
    try {
      const record = await getQuery('SELECT employeeId FROM payroll WHERE payrollId = ? AND companyId = ?', [id, companyId]);
      if (!record || record.employeeId !== employeeId) {
        return res.status(430).json({ message: 'Access denied. You can only download your own payslip.' });
      }
    } catch (err) {
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
  next();
}, downloadSalarySlip);

module.exports = router;
