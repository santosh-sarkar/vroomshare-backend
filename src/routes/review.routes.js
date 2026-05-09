const express = require('express');
const router = express.Router();
const controller = require('../controllers/review.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');

// Add review (renter only, after completed booking)
router.post('/', authenticateToken, authorizeRole('renter'), controller.create);

// Update review (renter only, own review)
router.put('/:reviewId', authenticateToken, authorizeRole('renter'), controller.update);

// Get reviews for a vehicle (public)
router.get('/:vehicleId', controller.getByVehicle);

module.exports = router;
