const express = require('express');
const router = express.Router();
const controller = require('../controllers/vehicle.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');
const createImageUploader = require('../utils/imageUploader');

// Uploader for vehicle images (parses multipart/form-data fields too)
const vehicleUpload = createImageUploader('vehicles');

router.get('/', controller.list);
router.get('/owner', authenticateToken, authorizeRole('owner'), controller.ownerVehicles);
// Use multer middleware to parse multipart/form-data (file + fields)
router.post('/', authenticateToken, authorizeRole('owner'), vehicleUpload.fields([
    { name: 'vehicleImages', maxCount: 5 },
    { name: 'documentImages', maxCount: 5 }
  ]), controller.create);
router.get('/:id', controller.get);
router.patch('/:id', authenticateToken, authorizeRole('owner'), controller.update);
router.delete('/:id', authenticateToken, authorizeRole('owner'), controller.remove);

module.exports = router;
