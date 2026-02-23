const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');



function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

// Generate access token (short-lived)
function generateAccessToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: '15m' });
}

// Generate refresh token (long-lived)
function generateRefreshToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: '7d' });
}

// Verify and decode token
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (err) {
    throw new Error('Invalid or expired refresh token');
  }
}

module.exports = {  verifyToken, generateAccessToken, generateRefreshToken, verifyRefreshToken };
