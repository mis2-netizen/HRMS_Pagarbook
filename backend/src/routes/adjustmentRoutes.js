const express = require('express');
const router = express.Router();
const {
  createAdjustment,
  getAdjustments,
  getMyAdjustments,
  deleteAdjustment
} = require('../controllers/adjustmentController');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// Employee app endpoint
router.get('/my', verifyToken, getMyAdjustments);

// HR / Admin endpoints
router.post('/', verifyToken, authorizeRoles('super_admin', 'hr'), createAdjustment);
router.get('/', verifyToken, authorizeRoles('super_admin', 'hr', 'manager'), getAdjustments);
router.delete('/:id', verifyToken, authorizeRoles('super_admin', 'hr'), deleteAdjustment);

module.exports = router;
