const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

// Two-step registration process
router.post('/signup', controller.signup);
router.post('/verify-and-register', controller.verifyAndRegister);

// Login and logout
router.post('/login', controller.login);
router.post('/logout', controller.logout);

// Change password (authenticated, OTP-based)
router.post('/change-password', authenticateToken, controller.changePassword);

module.exports = router;
