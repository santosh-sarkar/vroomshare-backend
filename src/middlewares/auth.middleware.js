const { verifyToken, generateAccessToken, verifyRefreshToken } = require("../utils/jwt");
const { ACCESS_TOKEN_COOKIE_OPTIONS } = require("../config/cookies");

/**
 * Auth Middleware - Verifies access token and auto-refreshes if expired
 * If both tokens are invalid/expired, user must login again
 */
async function authenticateToken(req, res, next) {
  try {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    // No tokens found
    if (!accessToken && !refreshToken) {
      return res.status(401).json({ message: "Please login first" });
    }

    try {
      // Try to verify access token
      const decoded = verifyToken(accessToken);
      req.user = decoded;
      return next();
    } catch (err) {
      // Access token is invalid or expired
      if (!refreshToken) {
        return res.status(401).json({ message: "Session expired, please login again" });
      }

      try {
        // Try to use refresh token
        const decoded = verifyRefreshToken(refreshToken);
        
        // Generate new access token
        const newAccessToken = generateAccessToken({
          sub: decoded.sub,
          role: decoded.role,
        });

        // Set new access token in cookie
        res.cookie("accessToken", newAccessToken, ACCESS_TOKEN_COOKIE_OPTIONS);

        // Attach user info to request
        req.user = decoded;
        next();
      } catch (refreshErr) {
        // Both tokens are invalid/expired
        return res.status(401).json({ message: "Session expired, please login again" });
      }
    }
  } catch (err) {
    res.status(401).json({ message: "Unauthorized" });
  }
}

/**
 * Optional middleware to check user role
 */
function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access forbidden" });
    }

    next();
  };
}

module.exports = { authenticateToken, authorizeRole };
