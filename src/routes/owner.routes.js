const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/owner.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');

// Owner dashboard endpoints
router.get('/earnings', authenticateToken, authorizeRole('owner'), ownerController.earnings);
router.get('/bookings', authenticateToken, authorizeRole('owner'), ownerController.bookings);

module.exports = router;
