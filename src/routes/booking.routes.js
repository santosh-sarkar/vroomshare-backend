const express = require('express');
const router = express.Router();
const controller = require('../controllers/booking.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');
const createImageUploader = require('../utils/imageUploader');

const preStartUpload = createImageUploader('vroomshare/pre-start-photos');

// Create booking (renter)
router.post('/', authenticateToken, authorizeRole('renter'), controller.create);

// Renter view bookings
router.get('/renter', authenticateToken, authorizeRole('renter'), controller.renterBookings);

// Check if renter has active booking for a vehicle
router.get('/vehicle/:vehicleId/status', authenticateToken, authorizeRole('renter'), controller.checkVehicleBookingStatus);

// Owner view bookings
router.get('/owner', authenticateToken, authorizeRole('owner'), controller.ownerBookings);

// Booking details (owner, renter, admin)
router.get('/:id', authenticateToken, controller.get);

// Owner updates booking status
router.put('/:id/status', authenticateToken, authorizeRole('owner'), controller.update);

// Renter cancels a requested booking
router.put('/:id/cancel', authenticateToken, authorizeRole('renter'), controller.cancelByRenter);

// Renter starts the trip (uploads 3-5 pre-start photos, transitions initiate_ongoing → ongoing)
router.put('/:id/start', authenticateToken, authorizeRole('renter'), preStartUpload.array('photos', 5), controller.startTrip);

module.exports = router;
