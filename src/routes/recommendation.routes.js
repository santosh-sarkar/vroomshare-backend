const express = require('express');
const router = express.Router();
const controller = require('../controllers/recommendation.controller');

router.get('/', controller.recommend);

module.exports = router;
