/**
 * NEW TWO-STEP REGISTRATION FLOW
 * 
 * User journey:
 * 1. User fills basic form (email, password, name, role) → Click "Sign Up"
 * 2. Backend sends verification code to email
 * 3. Frontend shows verification page with code input
 * 4. User enters 6-digit code → Click "Verify and Register"
 * 5. User account is created in database
 * 6. User is automatically logged in
 */

// ============================================
// STEP 1: User fills form and clicks "Sign Up"
// ============================================

// Frontend request:
const step1Request = {
  method: 'POST',
  url: '/api/auth/signup',
  body: {
    email: 'user@example.com',
    password: 'securePassword123',
    name: 'John Doe',
    role: 'Owner' // or 'Renter'
  }
};

// Backend response:
const step1Response = {
  ok: true,
  message: 'Verification code sent to your email. Please verify to complete registration.',
  email: 'user@example.com',
  expiresIn: '2 minutes'
  // Status: 200
};

// At this point:
// - User data is stored TEMPORARILY in memory (not in database yet)
// - Verification code is sent to user's email
// - Frontend shows verification input page

// ============================================
// STEP 2: User enters code and completes signup
// ============================================

// Frontend request:
const step2Request = {
  method: 'POST',
  url: '/api/auth/verify-and-register',
  body: {
    email: 'user@example.com',
    code: '123456' // 6-digit code from email
  }
};

// Backend response:
const step2Response = {
  ok: true,
  msg: 'Registration successful',
  userId: 'user_id_here',
  email: 'user@example.com',
  role: 'Owner'
  // Status: 201
  // Cookies: accessToken, refreshToken (automatically set)
};

// After this:
// - User is created in database with isEmailVerified = true
// - Auth cookies are set automatically
// - User is logged in and can access protected routes immediately

// ============================================
// AFTER REGISTRATION: Login
// ============================================

const loginRequest = {
  method: 'POST',
  url: '/api/auth/login',
  body: {
    email: 'user@example.com',
    password: 'securePassword123'
  }
};

const loginResponse = {
  ok: true,
  userId: 'user_id_here',
  role: 'Owner'
  // Status: 200
  // Cookies: accessToken, refreshToken
};

// ============================================
// LOGOUT
// ============================================

const logoutRequest = {
  method: 'POST',
  url: '/api/auth/logout'
};

const logoutResponse = {
  ok: true,
  message: 'Logged out successfully'
  // Cookies: cleared
};
