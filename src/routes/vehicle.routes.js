const express = require('express');
const router = express.Router();
const controller = require('../controllers/vehicle.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');
const createImageUploader = require('../utils/imageUploader');

function getVehicleUpload() { return createImageUploader('vehicles'); }

router.get('/', controller.list);
router.get('/owner', authenticateToken, authorizeRole('owner'), controller.ownerVehicles);
// Use multer middleware to parse multipart/form-data (file + fields)
router.post('/', authenticateToken, authorizeRole('owner'), (req, res, next) => getVehicleUpload().fields([
    { name: 'vehicleImages', maxCount: 5 },
    { name: 'documentImages', maxCount: 5 }
  ])(req, res, next), controller.create);
router.get('/:id', controller.get);
router.patch('/:id', authenticateToken, authorizeRole('owner'), controller.update);
router.delete('/:id', authenticateToken, authorizeRole('owner'), controller.remove);

module.exports = router;
