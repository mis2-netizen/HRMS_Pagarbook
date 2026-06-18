const express = require('express');
const router = express.Router();
const { getEmployees, getMetadata, getEmployeeById, createEmployee, updateEmployee, deleteEmployee } = require('../controllers/employeeController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// Protected routes (Only hr, super_admin, and manager can list employees)
router.get('/', verifyToken, authorizeRoles('super_admin', 'hr', 'manager'), getEmployees);

// Dropdown metadata
router.get('/metadata', verifyToken, authorizeRoles('super_admin', 'hr'), getMetadata);

// Get specific employee details (employees can view their own profile, managers can view their direct reports, HR/Admin can view all)
router.get('/:id', verifyToken, (req, res, next) => {
  const { id } = req.params;
  const { role, employeeId } = req.user;

  // Let employee access their own file
  if (role === 'employee' && employeeId !== id) {
    return res.status(430).json({ message: 'Access denied. You can only view your own profile.' });
  }
  next();
}, getEmployeeById);

// Create, Update, Delete (Only super_admin and hr can modify employees)
router.post('/', verifyToken, authorizeRoles('super_admin', 'hr'), createEmployee);
router.put('/:id', verifyToken, authorizeRoles('super_admin', 'hr'), updateEmployee);
router.delete('/:id', verifyToken, authorizeRoles('super_admin', 'hr'), deleteEmployee);

module.exports = router;
