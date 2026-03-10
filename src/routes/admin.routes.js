const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');

router.get('/stats', authenticateToken, authorizeRole('admin'), controller.stats);

router.put('/verify-user/:id', authenticateToken, authorizeRole('admin'), controller.verifyUser);
router.put('/verify-vehicle/:id', authenticateToken, authorizeRole('admin'), controller.verifyVehicle);

// disputes: create (any authenticated user) and resolve (admin)
router.post('/disputes', authenticateToken, controller.createDispute);
router.put('/disputes/:id', authenticateToken, authorizeRole('admin'), controller.resolveDispute);

module.exports = router;
