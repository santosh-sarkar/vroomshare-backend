const express = require('express');
const router = express.Router();
const controller = require('../controllers/user.controller');
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');
const createImageUploader = require('../utils/imageUploader');

// Lazily create uploaders so Cloudinary env vars are read at first request, not at module load
function getUserUpload() { return createImageUploader('users'); }

const uploadKYC = (req, res, next) => getUserUpload().fields([
  { name: "citizenshipFrontPhoto", maxCount: 1 },
  { name: "citizenshipBackPhoto", maxCount: 1 },
  { name: "licensePhoto", maxCount: 1 },
  { name: "selfieWithId", maxCount: 1 },
])(req, res, next);

const uploadPhoto = (req, res, next) => getUserUpload().single('image')(req, res, next);

router.get('/profile/',authenticateToken, controller.getProfile);
router.put('/profile/', authenticateToken, uploadKYC, controller.updateProfile);
router.put('/profile/photo', authenticateToken, uploadPhoto, controller.updateProfilePhoto);
router.get('/favourites', authenticateToken, authorizeRole('renter'), controller.getFavorites);
router.post('/favourites/:vehicleId', authenticateToken, authorizeRole('renter'), controller.addFavorite);
router.delete('/favourites/:vehicleId', authenticateToken, authorizeRole('renter'), controller.removeFavorite);

module.exports = router;
