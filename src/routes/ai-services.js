const express = require('express');
const { body, validationResult } = require('express-validator');
const AIService = require('../services/AIService');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware: authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * /ai/enhance-task:
 *   post:
 *     summary: Enhance task description using AI
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/enhance-task', [
  body('title')
    .isLength({ min: 1, max: 200 })
    .trim()
    .withMessage('Title is required and must be less than 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { title, description } = req.body;

  const enhancement = await AIService.enhanceTaskDescription(title, description || '');

  res.json({
    success: true,
    data: { enhancement }
  });
}));

/**
 * @swagger
 * /ai/generate-ticket-response:
 *   post:
 *     summary: Generate AI-powered customer service response
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/generate-ticket-response', [
  authorize('admin', 'manager', 'agent'),
  body('subject')
    .isLength({ min: 1, max: 200 })
    .trim()
    .withMessage('Subject is required'),
  body('description')
    .isLength({ min: 1, max: 2000 })
    .trim()
    .withMessage('Description is required'),
  body('customerHistory')
    .optional()
    .isArray()
    .withMessage('Customer history must be an array')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { subject, description, customerHistory = [] } = req.body;

  const response = await AIService.generateTicketResponse(subject, description, customerHistory);

  res.json({
    success: true,
    data: { response }
  });
}));

/**
 * @swagger
 * /ai/analyze-order-pattern:
 *   post:
 *     summary: Analyze customer order patterns using AI
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/analyze-order-pattern', [
  authorize('admin', 'manager', 'agent'),
  body('customerOrders')
    .isArray()
    .withMessage('Customer orders must be an array'),
  body('customerProfile')
    .isObject()
    .withMessage('Customer profile is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { customerOrders, customerProfile } = req.body;

  const analysis = await AIService.analyzeOrderPattern(customerOrders, customerProfile);

  res.json({
    success: true,
    data: { analysis }
  });
}));

/**
 * @swagger
 * /ai/optimize-inventory:
 *   post:
 *     summary: Get AI-powered inventory optimization recommendations
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/optimize-inventory', [
  authorize('admin', 'manager', 'warehouse_manager'),
  body('inventoryData')
    .isArray()
    .withMessage('Inventory data must be an array'),
  body('salesData')
    .isArray()
    .withMessage('Sales data must be an array')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { inventoryData, salesData } = req.body;

  const optimization = await AIService.optimizeInventory(inventoryData, salesData);

  res.json({
    success: true,
    data: { optimization }
  });
}));

/**
 * @swagger
 * /ai/performance-insights:
 *   post:
 *     summary: Generate AI-powered performance insights
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/performance-insights', [
  authorize('admin', 'manager'),
  body('userMetrics')
    .isObject()
    .withMessage('User metrics are required'),
  body('teamMetrics')
    .optional()
    .isObject()
    .withMessage('Team metrics must be an object')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { userMetrics, teamMetrics = {} } = req.body;

  const insights = await AIService.generatePerformanceInsights(userMetrics, teamMetrics);

  res.json({
    success: true,
    data: { insights }
  });
}));

/**
 * @swagger
 * /ai/status:
 *   get:
 *     summary: Get AI service status
 *     tags: [AI Services]
 *     security:
 *       - bearerAuth: []
 */
router.get('/status', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      aiServiceEnabled: AIService.isInitialized,
      deepseekConnected: AIService.isInitialized,
      availableFeatures: [
        'task-enhancement',
        'ticket-response-generation',
        'order-pattern-analysis',
        'inventory-optimization',
        'performance-insights'
      ]
    }
  });
}));

module.exports = router;
