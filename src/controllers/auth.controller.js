const {
  verifyPassword,
  findUserByEmail,
  getUserModel,
  hashPassword,
  setAuthCookies,
  generateUserTokens,
  initiateSignup,
  completeSignup,
} = require("../services/auth.service");
const { COOKIE_OPTIONS } = require("../config/cookies");
const { generateVerificationCode, getVerificationCodeExpiration } = require("../utils/verification");
const { storeVerificationCode, verifyStoredCode, clearVerificationCode } = require("../utils/verificationStore");
const { sendPasswordResetEmail } = require("../services/email.service");

// Step 1: Initiate signup - User fills details and clicks "Sign Up"
async function signup(req, res, next) {
  try {
    const { email, password, role, name } = req.body;

    if (!email || !password || !role || !name) {
      return res.status(400).json({
        message: "Email, password, role, and name are required",
      });
    }

    // Initiate signup process
    const result = await initiateSignup(email, password, role, { name });

    res.status(200).json({
      ok: true,
      message: result.message,
      email,
      expiresIn: result.expiresIn,
    });
  } catch (err) {
    if (err.message.includes("already")) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}

//  Step 2: Verify code and complete signup
async function verifyAndRegister(req, res, next) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        message: "Email and verification code are required",
      });
    }

    // Complete signup
    const { user, tokens } = await completeSignup(email, code);

    // Set auth cookies
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    res.status(201).json({
      ok: true,
      msg: "Registration successful",
      user: user,
    });
  } catch (err) {
    if (
      err.message.includes("expired") ||
      err.message.includes("Invalid") ||
      err.message.includes("No signup")
    ) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}


//  Login user
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Remove password and __v
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.__v;

    // Generate and set tokens
    const { accessToken, refreshToken } = generateUserTokens(
      user._id,
      user.role,
    );
    setAuthCookies(res, accessToken, refreshToken);

    res.status(200).json({
      ok: true,
      msg: "login successful",
      user: userObj,
    });
  } catch (err) {
    next(err);
  }
}


  // Logout user
async function logout(req, res, next) {
  try {
    res.clearCookie("accessToken", COOKIE_OPTIONS);
    res.clearCookie("refreshToken", COOKIE_OPTIONS);

    res.json({ ok: true, message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
}

// Change password (2 modes: 1. Send OTP, 2. Verify OTP + Update password)
async function changePassword(req, res, next) {
  try {
    const { sub, role } = req.user || {};
    if (!sub) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const UserModel = getUserModel(role);
    const user = await UserModel.findById(sub).select("email name").lean();
    if (!user) return res.status(404).json({ ok: false, message: "User not found" });

    const { code, newPassword } = req.body || {};

    // Mode 2: verify OTP + update password
    if (code && newPassword) {
      if (newPassword.trim().length < 6) {
        return res.status(400).json({ ok: false, message: "New password must be at least 6 characters." });
      }
      verifyStoredCode(user.email, code.trim());
      clearVerificationCode(user.email);
      const hashed = await hashPassword(newPassword.trim());
      await UserModel.findByIdAndUpdate(sub, { password: hashed });
      return res.json({ ok: true, message: "Password updated successfully." });
    }

    // Mode 1: send OTP
    const otp = generateVerificationCode();
    const expiresAt = getVerificationCodeExpiration();
    storeVerificationCode(user.email, otp, expiresAt);
    await sendPasswordResetEmail(user.email, otp, user.name || "User");
    return res.json({ ok: true, message: "Verification code sent to your email." });
  } catch (err) {
    if (
      err.message?.includes("expired") ||
      err.message?.includes("Invalid") ||
      err.message?.includes("No verification")
    ) {
      return res.status(400).json({ ok: false, message: err.message });
    }
    next(err);
  }
}

// resetPassword would be similar to changePassword but without requiring authentication.
 async function resetPassword(req, res, next) {
  try {
    // mode 1: send OTP to email
    const { email , code, newPassword } = req.body;
    if (email) {
      const user = await findUserByEmail(email);
      if (user) {
        const otp = generateVerificationCode();
        const expiresAt = getVerificationCodeExpiration();
        storeVerificationCode(user.email, otp, expiresAt);
        await sendPasswordResetEmail(user.email, otp, user.name || "User");
      }
      return res.json({ ok: true, message: "Verification code sent to your email." });
    }

    // mode 2: verify OTP and reset password
    
    if (code && newPassword) {
      if (newPassword.trim().length < 6) {
        return res.status(400).json({ ok: false, message: "New password must be at least 6 characters." });
      }
      verifyStoredCode(email, code.trim());
      clearVerificationCode(email);
      const hashed = await hashPassword(newPassword.trim());
      await UserModel.findOneAndUpdate({ email }, { password: hashed });
      return res.json({ ok: true, message: "Password updated successfully." });
    }
  }catch (err) {
    if (
      err.message?.includes("expired") ||
      err.message?.includes("Invalid") ||
      err.message?.includes("No verification")
    ) {
      return res.status(400).json({ ok: false, message: err.message });
    }
    next(err);
  }
}
module.exports = { signup, verifyAndRegister, login, logout, changePassword, resetPassword };
