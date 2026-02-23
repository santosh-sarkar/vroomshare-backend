const express = require('express');
const router = express.Router();
const controller = require('../controllers/booking.controller');

router.post('/', controller.create);
router.get('/:id', controller.get);

module.exports = router;
