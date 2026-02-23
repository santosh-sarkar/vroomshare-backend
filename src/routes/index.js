const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/vehicles', require('./vehicle.routes'));
router.use('/bookings', require('./booking.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/recommendations', require('./recommendation.routes'));

module.exports = router;
