/**
 * Generate a random 6-digit verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Get verification code expiration time (10 minutes from now)
 */
function getVerificationCodeExpiration() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

module.exports = { generateVerificationCode, getVerificationCodeExpiration };
