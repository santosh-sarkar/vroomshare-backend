const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');

// Two-step registration process
router.post('/signup', controller.signup);
router.post('/verify-and-register', controller.verifyAndRegister);

// Login and logout
router.post('/login', controller.login);
router.post('/logout', controller.logout);

module.exports = router;
