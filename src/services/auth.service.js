const bcrypt = require("bcryptjs");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");
const {
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
} = require("../config/cookies");
const { generateVerificationCode, getVerificationCodeExpiration } = require("../utils/verification");
const { storeSignupData, verifySignupCode, clearSignupData } = require("../utils/signupStore");
const { sendVerificationEmail } = require("./email.service");
const owner = require("../models/users/owner.model");
const renter = require("../models/users/renter.model");

const SALT_ROUNDS = 10;

async function hashPassword(password) {
  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    return hashedPassword;
  } catch (err) {
    throw new Error(`Password hashing failed: ${err.message}`);
  }
}

async function verifyPassword(password, hash) {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (err) {
    throw new Error(`Password verification failed: ${err.message}`);
  }
}

// Find user by email from both owner and renter collections
async function findUserByEmail(email) {
  let user = await owner.findOne({ email });
  if (!user) {
    user = await renter.findOne({ email });
  }
  return user;
}

// Get user model based on role
function getUserModel(role) {
  const models = {
    owner: owner,
    renter: renter,
  };
  return models[role];
}

// Generate and set tokens in cookies
function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("accessToken", accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
  res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
}

// Generate tokens for user
function generateUserTokens(userId, role) {
  const payload = { sub: userId, role };
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

// Send verification code to email (for signup)
async function sendVerificationCodeForSignup(email, name = "User") {
  try {
    const verificationCode = generateVerificationCode();
    const expiresAt = getVerificationCodeExpiration();

    // Store code temporarily in memory
    storeSignupData(email, {}, verificationCode, expiresAt);

    // Send verification email
    await sendVerificationEmail(email, verificationCode, name);

    return {
      success: true,
      message: "Verification code sent to email",
      expiresIn: "10 minutes",
    };
  } catch (err) {
    throw new Error(`Failed to send verification code: ${err.message}`);
  }
}

/**
 * Step 1: Initiate signup - Store user data and send verification code
 */
async function initiateSignup(email, password, role, userData) {
  try {
    // Check if email already exists
    let existingUser = await findUserByEmail(email);
    if (existingUser) {
      throw new Error("This Email is already registered.");
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = getVerificationCodeExpiration();

    // Hash password before storing
    const hashedPassword = await hashPassword(password);

    // Store signup data temporarily
    const dataToStore = {
      email,
      password: hashedPassword,
      role,
      ...userData,
    };
    storeSignupData(email, dataToStore, verificationCode, expiresAt);

    // Send verification email
    await sendVerificationEmail(email, verificationCode, userData.name || "User");

    return {
      success: true,
      message: "Verification code sent to your email. Please verify to complete registration.",
      email,
      expiresIn: "10 minutes",
    };
  } catch (err) {
    throw new Error(err.message);
  }
}

/**
 * Step 2: Complete signup - Verify code and create user
 */
async function completeSignup(email, code) {
  try {
    // Verify code and get signup data
    const signupData = verifySignupCode(email, code);

    // Get user model
    const UserModel = getUserModel(signupData.role);
    if (!UserModel) {
      throw new Error("Invalid role");
    }

    // Create user with verified data
    const user = await UserModel.create({
      ...signupData,
      isEmailVerified: true,
    });

    // Clear signup data
    clearSignupData(email);

    // Generate tokens
    const tokens = generateUserTokens(user._id, user.role);

    return {
      success: true,
      user,
      tokens,
    };
  } catch (err) {
    throw new Error(err.message);
  }
}

// Complete registration with verified code
async function registerWithVerification(role, email, code, password, userData) {
  try {
    // Verify the code
    verifyStoredCode(email, code);

    // Check if email already registered
    let existingUser = await findUserByEmail(email);
    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Get user model and create user
    const UserModel = getUserModel(role);
    if (!UserModel) {
      throw new Error("Invalid role");
    }

    const hashedPassword = await hashPassword(password);
    const user = await UserModel.create({
      ...userData,
      email,
      password: hashedPassword,
      isEmailVerified: true, // Mark as verified since code was accepted
    });

    // Clear the verification code from store
    clearVerificationCode(email);

    return {
      user,
      tokens: generateUserTokens(user._id, user.role),
    };
  } catch (err) {
    throw new Error(err.message);
  }
}

// Generate and send verification code (old function - still used for email change, etc)
async function generateAndSendVerificationCode(user) {
  try {
    const verificationCode = generateVerificationCode();
    const expiresAt = getVerificationCodeExpiration();

    // Update user with verification code
    user.emailVerificationCode = verificationCode;
    user.emailVerificationCodeExpires = expiresAt;
    await user.save();

    // Send verification email
    await sendVerificationEmail(user.email, verificationCode, user.name);

    return {
      success: true,
      message: "Verification code sent to email",
      expiresIn: "2 minutes",
    };
  } catch (err) {
    throw new Error(`Failed to generate verification code: ${err.message}`);
  }
}

// Verify email with code
async function verifyEmailCode(user, code) {
  try {
    // Check if code matches
    if (user.emailVerificationCode !== code) {
      throw new Error("Invalid verification code");
    }

    // Check if code has expired
    if (new Date() > user.emailVerificationCodeExpires) {
      throw new Error("Verification code has expired");
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationCodeExpires = null;
    await user.save();

    return { success: true, message: "Email verified successfully" };
  } catch (err) {
    throw new Error(err.message);
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  findUserByEmail,
  getUserModel,
  setAuthCookies,
  generateUserTokens,
  initiateSignup,
  completeSignup,
  sendVerificationCodeForSignup,
  registerWithVerification,
  generateAndSendVerificationCode,
  verifyEmailCode,
};
