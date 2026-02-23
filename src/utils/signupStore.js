/**
 * In-memory store for temporary signup data
 * Format: { email: { userData, verificationCode, expiresAt } }
 */
const signupDataStore = new Map();

/**
 * Store signup data temporarily
 */
function storeSignupData(email, userData, verificationCode, expiresAt) {
  signupDataStore.set(email.toLowerCase(), {
    userData,
    verificationCode,
    expiresAt,
  });
}

/**
 * Get stored signup data
 */
function getStoredSignupData(email) {
  return signupDataStore.get(email.toLowerCase());
}

/**
 * Clear signup data
 */
function clearSignupData(email) {
  signupDataStore.delete(email.toLowerCase());
}

/**
 * Verify signup code and get data
 */
function verifySignupCode(email, code) {
  const data = getStoredSignupData(email);

  if (!data) {
    throw new Error("No signup session found for this email");
  }

  if (new Date() > data.expiresAt) {
    clearSignupData(email);
    throw new Error("Verification code has expired");
  }

  if (data.verificationCode !== code) {
    throw new Error("Invalid verification code");
  }

  return data.userData;
}

module.exports = {
  storeSignupData,
  getStoredSignupData,
  clearSignupData,
  verifySignupCode,
};
