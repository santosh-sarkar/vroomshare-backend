const express = require('express');
const router = express.Router();
const controller = require('../controllers/vehicle.controller');

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.get);

module.exports = router;
