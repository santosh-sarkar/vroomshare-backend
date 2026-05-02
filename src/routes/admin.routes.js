const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');
const createImageUploader = require('../utils/imageUploader');

const disputeEvidenceUpload = createImageUploader('vroomshare/disputes');

router.get('/stats', authenticateToken, authorizeRole('admin'), controller.stats);

router.get('/pending-users', authenticateToken, authorizeRole('admin'), controller.getPendingUsers);
router.get('/pending-users/:id', authenticateToken, authorizeRole('admin'), controller.getPendingUserById);
router.get('/pending-vehicles', authenticateToken, authorizeRole('admin'), controller.getPendingVehicles);
router.put('/verify-user/:id', authenticateToken, authorizeRole('admin'), controller.verifyUser);
router.put('/reject-user/:id', authenticateToken, authorizeRole('admin'), controller.rejectUser);
router.put('/verify-vehicle/:id', authenticateToken, authorizeRole('admin'), controller.verifyVehicle);
router.put('/reject-vehicle/:id', authenticateToken, authorizeRole('admin'), controller.rejectVehicle);

// disputes: create (any authenticated user) and resolve (admin)
router.post('/disputes', authenticateToken, disputeEvidenceUpload.array('evidence', 5), controller.createDispute);
router.get('/disputes/stats', authenticateToken, authorizeRole('admin'), controller.getDisputeStats);
router.get('/disputes', authenticateToken, authorizeRole('admin'), controller.getDisputes);
router.get('/disputes/by-booking/:bookingId', authenticateToken, controller.getDisputeByBooking);
router.get('/disputes/:id', authenticateToken, authorizeRole('admin'), controller.getDisputeById);
router.put('/disputes/:id', authenticateToken, authorizeRole('admin'), controller.resolveDispute);

module.exports = router;
