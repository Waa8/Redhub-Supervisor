const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const AuthService = require('../services/AuthService');
const DatabaseService = require('../services/DatabaseService');
const RedisService = require('../services/RedisService');
const { asyncHandler, ValidationError, UnauthorizedError } = require('../middleware/errorHandler');
const { authRateLimiter, strictRateLimiter } = require('../middleware/rateLimiter');
const { authMiddleware: authenticate } = require('../middleware/auth');

const router = express.Router();

// Apply rate limiting to all auth routes
router.use(authRateLimiter);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, manager, agent, representative, customer]
 */
router.post('/register', [
  body('username').isLength({ min: 3, max: 50 }).trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').isLength({ min: 1, max: 100 }).trim(),
  body('lastName').isLength({ min: 1, max: 100 }).trim(),
  body('phone').optional().isMobilePhone(),
  body('role').optional().isIn(['admin', 'manager', 'agent', 'representative', 'customer'])
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, phone, role = 'agent' } = req.body;

    // Check if user already exists using Supabase
    const existingByUsername = await DatabaseService.findByField('users', 'username', username);
    const existingByEmail = await DatabaseService.findByField('users', 'email', email);

    if (existingByUsername.length > 0 || existingByEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Create user
    const user = await DatabaseService.create('users', {
      username,
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      phone,
      role,
      is_active: true
    });

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // Store refresh token
    await RedisService.set(`refresh_token:${user.id}`, refreshToken, 7 * 24 * 60 * 60); // 7 days

    // Remove password from response
    delete user.password_hash;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 */
router.post('/login', [
  body('username').notEmpty().trim(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // For demo purposes, use hardcoded admin user
    // In production, this would query the database properly
    const demoUsers = [
      {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        username: 'admin',
        email: 'admin@demo.com',
        password_hash: '$2a$12$RdG2qkLn7JlTldjuZyiVQu2KQspUa6h9gdkSHfqTwMjbXl/xPtaa.', // admin123
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        is_active: true
      },
      {
        id: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
        username: 'manager',
        email: 'manager@demo.com',
        password_hash: '$2a$12$RdG2qkLn7JlTldjuZyiVQu2KQspUa6h9gdkSHfqTwMjbXl/xPtaa.', // manager123
        first_name: 'Manager',
        last_name: 'User',
        role: 'manager',
        is_active: true
      },
      {
        id: 'c3d4e5f6-g7h8-9012-cdef-345678901234',
        username: 'agent',
        email: 'agent@demo.com',
        password_hash: '$2a$12$RdG2qkLn7JlTldjuZyiVQu2KQspUa6h9gdkSHfqTwMjbXl/xPtaa.', // agent123
        first_name: 'Agent',
        last_name: 'User',
        role: 'agent',
        is_active: true
      }
    ];

    const user = demoUsers.find(u => u.username === username || u.email === username);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login (commented out for demo)
    // await DatabaseService.update('users', user.id, {
    //   last_login: new Date()
    // });

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // Store refresh token
    await RedisService.set(`refresh_token:${user.id}`, refreshToken, 7 * 24 * 60 * 60);

    // Remove password from response
    delete user.password_hash;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Check if refresh token exists in Redis
    const storedToken = await RedisService.get(`refresh_token:${decoded.userId}`);
    
    if (storedToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Get user
    const user = await DatabaseService.findById('users', decoded.userId);
    
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization.substring(7);
    
    // Add token to blacklist
    const decoded = jwt.decode(token);
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    
    if (expiresIn > 0) {
      await RedisService.set(`blacklist:${token}`, true, expiresIn);
    }

    // Remove refresh token
    await RedisService.del(`refresh_token:${req.user.id}`);

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await DatabaseService.findById('users', req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove sensitive data
    delete user.password_hash;

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

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
  body('firstName').optional().isLength({ min: 1, max: 100 }).trim(),
  body('lastName').optional().isLength({ min: 1, max: 100 }).trim(),
  body('phone').optional().isMobilePhone(),
  body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { firstName, lastName, phone, email } = req.body;
    const updateData = {};

    if (firstName) updateData.first_name = firstName;
    if (lastName) updateData.last_name = lastName;
    if (phone) updateData.phone = phone;
    if (email) updateData.email = email;

    // Check if email is already taken by another user
    if (email) {
      const existingUsers = await DatabaseService.findByField('users', 'email', email);
      const otherUser = existingUsers.find(u => u.id !== req.user.id);

      if (otherUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    const updatedUser = await DatabaseService.update('users', req.user.id, updateData);
    delete updatedUser.password_hash;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Profile update failed'
    });
  }
});

module.exports = router;
