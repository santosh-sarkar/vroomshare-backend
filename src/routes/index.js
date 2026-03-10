const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/vehicles', require('./vehicle.routes'));
router.use('/bookings', require('./booking.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/recommendations', require('./recommendation.routes'));
router.use('/reviews', require('./review.routes'));
router.use('/owner', require('./owner.routes'));

module.exports = router;
