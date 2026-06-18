const express = require('express');
const router = express.Router();
const { login, getProfile, changePassword } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Public Route
router.post('/login', login);

// Protected Routes
router.get('/profile', verifyToken, getProfile);
router.post('/change-password', verifyToken, changePassword);

module.exports = router;
