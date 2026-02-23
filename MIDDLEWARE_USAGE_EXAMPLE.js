/**
 * EXAMPLE: How to use the new Auth Middleware
 * 
 * The authenticateToken middleware automatically:
 * 1. Checks if access token is valid -> allow request
 * 2. If access token expired -> checks refresh token
 * 3. If refresh token valid -> generates new access token and continues
 * 4. If both expired -> sends "Session expired" message
 * 
 * NO MORE SEPARATE REFRESH ROUTE NEEDED!
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middlewares/auth.middleware');
const userController = require('../controllers/user.controller');

// Public routes (no auth needed)
// router.get('/public', userController.getInfo);

// Protected routes (auth middleware handles token refresh automatically)
router.get('/profile', authenticateToken, userController.getProfile);
router.put('/profile', authenticateToken, userController.updateProfile);

// Protected routes with role check
router.get('/admin/users', 
  authenticateToken, 
  authorizeRole('Owner'), 
  userController.getAllUsers
);

// How it works in request flow:
// 1. Client makes request with accessToken cookie
// 2. Middleware checks token:
//    - If valid: req.user is set, request continues
//    - If expired: checks refreshToken
//    - If refreshToken valid: generates new accessToken, sets it in cookie
//    - If both expired: returns 401 "Session expired"
// 3. Route handler processes request with fresh token

module.exports = router;
