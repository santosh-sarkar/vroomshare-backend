const express = require('express');
const router = express.Router();
const controller = require('../controllers/user.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');
const createImageUploader = require('../utils/imageUploader');

// Uploader for images (parses multipart/form-data fields too)
const userUpload = createImageUploader('users');
const uploadKYC = userUpload.fields([
  { name: "citizenshipFrontPhoto", maxCount: 1 },
  { name: "citizenshipBackPhoto", maxCount: 1 },
  { name: "licensePhoto", maxCount: 1 },
  { name: "selfiePhoto", maxCount: 1 },
]);

router.get('/profile/',authenticateToken, controller.getProfile);
router.put('/profile/', authenticateToken, uploadKYC, controller.updateProfile);
router.get('/favourites', authenticateToken, authorizeRole('renter'), controller.getFavorites);
router.post('/favourites/:vehicleId', authenticateToken, authorizeRole('renter'), controller.addFavorite);
router.delete('/favourites/:vehicleId', authenticateToken, authorizeRole('renter'), controller.removeFavorite);

module.exports = router;
