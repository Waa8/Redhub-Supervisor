const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const DatabaseService = require('../services/DatabaseService');
const { asyncHandler, ValidationError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const { authenticate, authorize, requireOrganization } = require('../middleware/auth-production');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireOrganization);

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: Get customers with filtering and search
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', [
  query('customer_type').optional().isIn(['individual', 'business', 'enterprise', 'government']),
  query('tier').optional().isIn(['bronze', 'silver', 'gold', 'platinum', 'diamond']),
  query('assigned_representative').optional().isUUID(),
  query('is_active').optional().isBoolean(),
  query('search').optional().isLength({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort_by').optional().isIn(['created_at', 'updated_at', 'name', 'customer_code']),
  query('sort_order').optional().isIn(['asc', 'desc'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid query parameters', errors.array());
  }

  const { 
    customer_type,
    tier,
    assigned_representative,
    is_active,
    search,
    page = 1, 
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Build conditions for organization isolation
  const conditions = { organization_id: req.user.currentOrganizationId };
  
  if (customer_type) conditions.customer_type = customer_type;
  if (tier) conditions.tier = tier;
  if (assigned_representative) conditions.assigned_representative = assigned_representative;
  if (is_active !== undefined) conditions.is_active = is_active === 'true';

  let customers;
  
  if (search) {
    // Search in customer name, email, phone, company
    customers = await DatabaseService.search('customers', search, ['name', 'email', 'phone', 'company_name'], {
      conditions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: { column: sort_by, ascending: sort_order === 'asc' }
    });
  } else {
    // Get customers with representative information
    customers = await DatabaseService.findWithJoins('customers', [
      { table: 'users', select: 'id, first_name, last_name, username' }
    ], conditions, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: { column: sort_by, ascending: sort_order === 'asc' }
    });
  }

  // Get customer contacts and recent orders for each customer
  for (let customer of customers) {
    // Get primary contact
    const contacts = await DatabaseService.findAll('customer_contacts', {
      customer_id: customer.id,
      is_primary: true,
      is_active: true
    });
    customer.primary_contact = contacts[0] || null;

    // Get recent orders count
    const recentOrdersCount = await DatabaseService.count('orders', {
      customer_id: customer.id,
      organization_id: req.user.currentOrganizationId
    });
    customer.total_orders = recentOrdersCount;

    // Calculate total spent (would need a proper aggregation query)
    customer.total_spent = 0; // Placeholder - implement with proper aggregation
  }

  // Get total count and statistics
  const totalCount = await DatabaseService.count('customers', conditions);
  
  const stats = {
    total: totalCount,
    individual: await DatabaseService.count('customers', { ...conditions, customer_type: 'individual' }),
    business: await DatabaseService.count('customers', { ...conditions, customer_type: 'business' }),
    enterprise: await DatabaseService.count('customers', { ...conditions, customer_type: 'enterprise' }),
    active: await DatabaseService.count('customers', { ...conditions, is_active: true }),
    inactive: await DatabaseService.count('customers', { ...conditions, is_active: false })
  };

  res.json({
    success: true,
    data: {
      customers,
      statistics: stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        hasNext: (page * limit) < totalCount,
        hasPrev: page > 1
      }
    }
  });
}));

/**
 * @swagger
 * /customers/{id}:
 *   get:
 *     summary: Get customer details with full information
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Valid customer ID required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid parameters', errors.array());
  }

  const { id } = req.params;

  // Get customer with representative info
  const customers = await DatabaseService.findWithJoins('customers', [
    { table: 'users', select: 'id, first_name, last_name, username, email, phone' }
  ], { 
    id, 
    organization_id: req.user.currentOrganizationId 
  });

  const customer = customers[0];
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  // Get customer contacts
  const contacts = await DatabaseService.findAll('customer_contacts', {
    customer_id: id,
    is_active: true
  }, {
    orderBy: { column: 'is_primary', ascending: false }
  });

  // Get customer orders
  const orders = await DatabaseService.findAll('orders', {
    customer_id: id,
    organization_id: req.user.currentOrganizationId
  }, {
    limit: 10,
    orderBy: { column: 'created_at', ascending: false }
  });

  // Get customer support tickets
  const tickets = await DatabaseService.findAll('support_tickets', {
    customer_id: id,
    organization_id: req.user.currentOrganizationId
  }, {
    limit: 5,
    orderBy: { column: 'created_at', ascending: false }
  });

  // Calculate customer metrics
  const totalOrders = await DatabaseService.count('orders', {
    customer_id: id,
    organization_id: req.user.currentOrganizationId
  });

  const completedOrders = await DatabaseService.count('orders', {
    customer_id: id,
    organization_id: req.user.currentOrganizationId,
    order_status: 'delivered'
  });

  customer.contacts = contacts;
  customer.recent_orders = orders;
  customer.recent_tickets = tickets;
  customer.metrics = {
    total_orders: totalOrders,
    completed_orders: completedOrders,
    completion_rate: totalOrders > 0 ? (completedOrders / totalOrders * 100).toFixed(1) : 0,
    total_spent: 0, // Would need aggregation query
    average_order_value: 0 // Would need aggregation query
  };

  res.json({
    success: true,
    data: { customer }
  });
}));

/**
 * @swagger
 * /customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', [
  body('name')
    .isLength({ min: 1, max: 200 })
    .trim()
    .withMessage('Customer name is required'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail(),
  body('phone')
    .optional()
    .isMobilePhone(),
  body('customer_type')
    .optional()
    .isIn(['individual', 'business', 'enterprise', 'government']),
  body('tier')
    .optional()
    .isIn(['bronze', 'silver', 'gold', 'platinum', 'diamond']),
  body('company_name')
    .optional()
    .isLength({ max: 200 })
    .trim(),
  body('billing_address')
    .optional()
    .isObject(),
  body('shipping_address')
    .optional()
    .isObject(),
  body('assigned_representative')
    .optional()
    .isUUID(),
  body('payment_terms')
    .optional()
    .isInt({ min: 0, max: 365 }),
  body('credit_limit')
    .optional()
    .isFloat({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  // Check for duplicate email
  if (req.body.email) {
    const existingCustomer = await DatabaseService.findAll('customers', {
      email: req.body.email.toLowerCase(),
      organization_id: req.user.currentOrganizationId
    });

    if (existingCustomer.length > 0) {
      throw new ValidationError('Customer with this email already exists');
    }
  }

  // Generate customer code
  const customerCount = await DatabaseService.count('customers', {
    organization_id: req.user.currentOrganizationId
  });
  const customerCode = `CUST-${String(customerCount + 1).padStart(6, '0')}`;

  // Validate assigned representative
  if (req.body.assigned_representative) {
    const representative = await DatabaseService.findById('users', req.body.assigned_representative);
    if (!representative) {
      throw new ValidationError('Assigned representative not found');
    }

    const repOrgs = await DatabaseService.findAll('user_organizations', {
      user_id: req.body.assigned_representative,
      organization_id: req.user.currentOrganizationId,
      is_active: true
    });

    if (repOrgs.length === 0) {
      throw new ValidationError('Representative does not belong to this organization');
    }
  }

  // Create customer
  const customerData = {
    ...req.body,
    customer_code: customerCode,
    organization_id: req.user.currentOrganizationId,
    email: req.body.email ? req.body.email.toLowerCase() : null,
    is_active: true
  };

  const customer = await DatabaseService.create('customers', customerData);

  res.status(201).json({
    success: true,
    message: 'Customer created successfully',
    data: { customer }
  });
}));

module.exports = router;
