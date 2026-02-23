/**
 * In-memory store for verification codes
 * Format: { email: { code, expiresAt } }
 */
const verificationStore = new Map();

/**
 * Store verification code temporarily
 */
function storeVerificationCode(email, code, expiresAt) {
  verificationStore.set(email.toLowerCase(), { code, expiresAt });
}

/**
 * Get stored verification code
 */
function getStoredVerificationCode(email) {
  return verificationStore.get(email.toLowerCase());
}

/**
 * Clear verification code
 */
function clearVerificationCode(email) {
  verificationStore.delete(email.toLowerCase());
}

/**
 * Verify the code is correct and not expired
 */
function verifyStoredCode(email, code) {
  const stored = getStoredVerificationCode(email);
  
  if (!stored) {
    throw new Error("No verification code found for this email");
  }
  
  if (new Date() > stored.expiresAt) {
    clearVerificationCode(email);
    throw new Error("Verification code has expired");
  }
  
  if (stored.code !== code) {
    throw new Error("Invalid verification code");
  }
  
  return true;
}

module.exports = {
  storeVerificationCode,
  getStoredVerificationCode,
  clearVerificationCode,
  verifyStoredCode,
};
