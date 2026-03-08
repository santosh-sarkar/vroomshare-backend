const express = require('express');
const router = express.Router();
const controller = require('../controllers/vehicle.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');

router.get('/', controller.list);
router.get('/owner', authenticateToken, authorizeRole('owner'), controller.ownerVehicles);
router.post('/', authenticateToken, authorizeRole('owner'), controller.create);
router.get('/:id', controller.get);
router.patch('/:id', authenticateToken, authorizeRole('owner'), controller.update);
router.delete('/:id', authenticateToken, authorizeRole('owner'), controller.remove);

module.exports = router;
