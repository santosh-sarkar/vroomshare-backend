const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');
const paymentController = require('../controllers/payment.controller');

// payment endpoints
router.post("/pay/:bookingId", authenticateToken, authorizeRole('renter'), paymentController.payNow);
router.post("/verify", paymentController.verifyPayment);
router.post("/mark-failure", paymentController.markPaymentFailure);

module.exports = router;