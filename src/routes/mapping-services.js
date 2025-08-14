const express = require('express');
const { body, query, validationResult } = require('express-validator');
const MapboxService = require('../services/MapboxService');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authMiddleware: authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * /mapping/geocode:
 *   post:
 *     summary: Convert address to coordinates
 *     tags: [Mapping Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/geocode', [
  body('address')
    .isLength({ min: 1, max: 500 })
    .trim()
    .withMessage('Address is required and must be less than 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { address } = req.body;

  const result = await MapboxService.geocodeAddress(address);

  if (!result) {
    return res.status(404).json({
      success: false,
      message: 'Address not found'
    });
  }

  res.json({
    success: true,
    data: { geocoding: result }
  });
}));

/**
 * @swagger
 * /mapping/reverse-geocode:
 *   post:
 *     summary: Convert coordinates to address
 *     tags: [Mapping Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/reverse-geocode', [
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude is required'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { longitude, latitude } = req.body;

  const result = await MapboxService.reverseGeocode(longitude, latitude);

  if (!result) {
    return res.status(404).json({
      success: false,
      message: 'Location not found'
    });
  }

  res.json({
    success: true,
    data: { address: result }
  });
}));

/**
 * @swagger
 * /mapping/route:
 *   post:
 *     summary: Calculate route between points
 *     tags: [Mapping Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/route', [
  body('coordinates')
    .isArray({ min: 2 })
    .withMessage('At least 2 coordinates are required'),
  body('coordinates.*.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude is required'),
  body('coordinates.*.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude is required'),
  body('profile')
    .optional()
    .isIn(['driving', 'walking', 'cycling'])
    .withMessage('Profile must be driving, walking, or cycling')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { coordinates, profile = 'driving' } = req.body;

  const route = await MapboxService.calculateRoute(coordinates, profile);

  if (!route) {
    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  }

  res.json({
    success: true,
    data: { route }
  });
}));

/**
 * @swagger
 * /mapping/optimize-delivery-route:
 *   post:
 *     summary: Optimize delivery route for multiple destinations
 *     tags: [Mapping Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/optimize-delivery-route', [
  authorize('admin', 'manager', 'logistics_coordinator'),
  body('depot')
    .isObject()
    .withMessage('Depot coordinates are required'),
  body('depot.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid depot longitude is required'),
  body('depot.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid depot latitude is required'),
  body('destinations')
    .isArray({ min: 1, max: 25 })
    .withMessage('1-25 destinations are required'),
  body('destinations.*.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid destination longitude is required'),
  body('destinations.*.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid destination latitude is required'),
  body('profile')
    .optional()
    .isIn(['driving', 'driving-traffic'])
    .withMessage('Profile must be driving or driving-traffic')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { depot, destinations, profile = 'driving' } = req.body;

  const optimizedRoute = await MapboxService.optimizeDeliveryRoute(depot, destinations, profile);

  if (!optimizedRoute) {
    return res.status(404).json({
      success: false,
      message: 'Could not optimize route'
    });
  }

  res.json({
    success: true,
    data: { optimizedRoute }
  });
}));

/**
 * @swagger
 * /mapping/delivery-zones:
 *   post:
 *     summary: Get delivery zones based on service area
 *     tags: [Mapping Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/delivery-zones', [
  authorize('admin', 'manager', 'logistics_coordinator'),
  body('centerPoint')
    .isObject()
    .withMessage('Center point coordinates are required'),
  body('centerPoint.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid center longitude is required'),
  body('centerPoint.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid center latitude is required'),
  body('radiusKm')
    .optional()
    .isFloat({ min: 1, max: 100 })
    .withMessage('Radius must be between 1 and 100 km')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { centerPoint, radiusKm = 10 } = req.body;

  const zones = await MapboxService.getDeliveryZones(centerPoint, radiusKm);

  if (!zones) {
    return res.status(404).json({
      success: false,
      message: 'Could not calculate delivery zones'
    });
  }

  res.json({
    success: true,
    data: { deliveryZones: zones }
  });
}));

/**
 * @swagger
 * /mapping/distance-matrix:
 *   post:
 *     summary: Calculate distance matrix between multiple points
 *     tags: [Mapping Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/distance-matrix', [
  authorize('admin', 'manager', 'logistics_coordinator'),
  body('origins')
    .isArray({ min: 1, max: 25 })
    .withMessage('1-25 origin points are required'),
  body('destinations')
    .isArray({ min: 1, max: 25 })
    .withMessage('1-25 destination points are required'),
  body('profile')
    .optional()
    .isIn(['driving', 'walking', 'cycling'])
    .withMessage('Profile must be driving, walking, or cycling')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { origins, destinations, profile = 'driving' } = req.body;

  const matrix = await MapboxService.calculateDistanceMatrix(origins, destinations, profile);

  if (!matrix) {
    return res.status(404).json({
      success: false,
      message: 'Could not calculate distance matrix'
    });
  }

  res.json({
    success: true,
    data: { distanceMatrix: matrix }
  });
}));

/**
 * @swagger
 * /mapping/estimate-delivery-time:
 *   post:
 *     summary: Estimate delivery time based on distance and traffic
 *     tags: [Mapping Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/estimate-delivery-time', [
  body('distanceMeters')
    .isFloat({ min: 0 })
    .withMessage('Valid distance in meters is required'),
  body('currentHour')
    .optional()
    .isInt({ min: 0, max: 23 })
    .withMessage('Current hour must be between 0 and 23')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { distanceMeters, currentHour } = req.body;

  const estimate = MapboxService.calculateEstimatedDeliveryTime(distanceMeters, currentHour);

  res.json({
    success: true,
    data: { deliveryTimeEstimate: estimate }
  });
}));

/**
 * @swagger
 * /mapping/validate-address:
 *   post:
 *     summary: Validate address format
 *     tags: [Mapping Services]
 *     security:
 *       - bearerAuth: []
 */
router.post('/validate-address', [
  body('address')
    .isObject()
    .withMessage('Address object is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { address } = req.body;

  const isValid = MapboxService.validateAddress(address);
  const formattedAddress = MapboxService.formatAddress(address);

  res.json({
    success: true,
    data: {
      isValid,
      formattedAddress,
      address
    }
  });
}));

/**
 * @swagger
 * /mapping/status:
 *   get:
 *     summary: Get mapping service status
 *     tags: [Mapping Services]
 *     security:
 *       - bearerAuth: []
 */
router.get('/status', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      mappingServiceEnabled: MapboxService.isInitialized,
      mapboxConnected: MapboxService.isInitialized,
      availableFeatures: [
        'geocoding',
        'reverse-geocoding',
        'route-calculation',
        'route-optimization',
        'delivery-zones',
        'distance-matrix',
        'delivery-time-estimation'
      ]
    }
  });
}));

module.exports = router;
