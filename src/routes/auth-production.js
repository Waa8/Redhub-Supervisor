const express = require('express');
const { body, validationResult } = require('express-validator');
const AuthService = require('../services/AuthService');
const DatabaseService = require('../services/DatabaseService');
const { asyncHandler, ValidationError, UnauthorizedError } = require('../middleware/errorHandler');
const { authRateLimiter, strictRateLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth-production');

const router = express.Router();

// Apply rate limiting to all auth routes
router.use(authRateLimiter);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user (Production)
 *     tags: [Authentication]
 */
router.post('/register', [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters, alphanumeric and underscores only')
    .trim(),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters'),
  body('firstName')
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('First name is required'),
  body('lastName')
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Last name is required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('role')
    .optional()
    .isIn(['admin', 'manager', 'agent', 'representative', 'customer', 'warehouse_manager', 'financial_manager', 'logistics_coordinator'])
    .withMessage('Invalid role specified'),
  body('organizationId')
    .isUUID()
    .withMessage('Valid organization ID is required'),
  body('department')
    .optional()
    .isLength({ max: 100 })
    .trim(),
  body('position')
    .optional()
    .isLength({ max: 100 })
    .trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { organizationId, ...userData } = req.body;

  // Verify organization exists and is active
  const organization = await DatabaseService.findById('organizations', organizationId);
  if (!organization || !organization.is_active) {
    throw new ValidationError('Invalid organization');
  }

  // Register user
  const result = await AuthService.register(userData, organizationId);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: result
  });
}));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login (Production)
 *     tags: [Authentication]
 */
router.post('/login', [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .trim(),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail(),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  body('organizationId')
    .optional()
    .isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { username, email, password, organizationId } = req.body;

  if (!username && !email) {
    throw new ValidationError('Username or email is required');
  }

  // Login user
  const result = await AuthService.login({ username, email, password }, organizationId);

  res.json({
    success: true,
    message: 'Login successful',
    data: result
  });
}));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 */
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { refreshToken } = req.body;

  const result = await AuthService.refreshToken(refreshToken);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: result
  });
}));

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 */
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const userWithOrgs = await AuthService.getUserWithOrganizations(req.user.id);

  res.json({
    success: true,
    data: { user: userWithOrgs }
  });
}));

/**
 * @swagger
 * /auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 */
router.put('/profile', [
  authenticate,
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .trim(),
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .trim(),
  body('phone')
    .optional()
    .isMobilePhone(),
  body('timezone')
    .optional()
    .isLength({ max: 50 }),
  body('language')
    .optional()
    .isIn(['en', 'ar']),
  body('preferences')
    .optional()
    .isObject()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const updatedUser = await AuthService.updateProfile(req.user.id, req.body);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
}));

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 */
router.post('/change-password', [
  authenticate,
  strictRateLimiter, // Extra strict rate limiting for password changes
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('New password must meet security requirements')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { currentPassword, newPassword } = req.body;

  await AuthService.changePassword(req.user.id, currentPassword, newPassword);

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  // In a production app, you might want to blacklist the token
  // For now, we'll just return success as the client will remove the token
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * @swagger
 * /auth/verify-token:
 *   post:
 *     summary: Verify if token is valid
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 */
router.post('/verify-token', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        organizationId: req.user.organizationId
      }
    }
  });
}));

module.exports = router;
