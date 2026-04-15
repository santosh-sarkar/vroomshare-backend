const express = require('express');
const router = express.Router();
const controller = require('../controllers/booking.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');

// Create booking (renter)
router.post('/', authenticateToken, authorizeRole('renter'), controller.create);

// Renter view bookings
router.get('/renter', authenticateToken, authorizeRole('renter'), controller.renterBookings);

// Owner view bookings
router.get('/owner', authenticateToken, authorizeRole('owner'), controller.ownerBookings);

// Booking details (owner, renter, admin)
router.get('/:id', authenticateToken, controller.get);

// Owner updates booking status
router.put('/:id/status', authenticateToken, authorizeRole('owner'), controller.update);

module.exports = router;
