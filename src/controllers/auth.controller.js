const {
  verifyPassword,
  findUserByEmail,
  setAuthCookies,
  generateUserTokens,
  initiateSignup,
  completeSignup,
} = require("../services/auth.service");
const { COOKIE_OPTIONS } = require("../config/cookies");

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

/**
 * Step 2: Verify code and complete signup
 */
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

/**
 * Login user
 */
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

/**
 * Logout user
 */
async function logout(req, res, next) {
  try {
    res.clearCookie("accessToken", COOKIE_OPTIONS);
    res.clearCookie("refreshToken", COOKIE_OPTIONS);

    res.json({ ok: true, message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, verifyAndRegister, login, logout };
