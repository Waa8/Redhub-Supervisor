const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const DatabaseService = require('../services/DatabaseService');
const SocketService = require('../services/SocketService');
const { asyncHandler, ValidationError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const { authenticate, authorize, requireOrganization } = require('../middleware/auth-production');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireOrganization);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get orders with advanced filtering
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', [
  query('status').optional().isIn(['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned']),
  query('type').optional().isIn(['standard', 'express', 'bulk', 'subscription', 'custom']),
  query('customer_id').optional().isUUID(),
  query('assigned_to').optional().isUUID(),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
  query('search').optional().isLength({ min: 1, max: 100 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort_by').optional().isIn(['created_at', 'updated_at', 'delivery_date', 'total_amount', 'order_number']),
  query('sort_order').optional().isIn(['asc', 'desc'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid query parameters', errors.array());
  }

  const { 
    status, 
    type,
    customer_id, 
    assigned_to,
    date_from,
    date_to,
    search,
    page = 1, 
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Build conditions for organization isolation
  const conditions = { organization_id: req.user.currentOrganizationId };
  
  if (status) conditions.order_status = status;
  if (type) conditions.order_type = type;
  if (customer_id) conditions.customer_id = customer_id;
  if (assigned_to) conditions.assigned_to = assigned_to;

  let orders;
  
  if (search) {
    // Search in order number, customer name, etc.
    orders = await DatabaseService.search('orders', search, ['order_number'], {
      conditions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: { column: sort_by, ascending: sort_order === 'asc' }
    });
  } else {
    // Get orders with customer and user information
    orders = await DatabaseService.findWithJoins('orders', [
      { table: 'customers', select: 'id, name, email, phone, customer_code, tier' },
      { table: 'users', select: 'id, first_name, last_name, username' }
    ], conditions, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: { column: sort_by, ascending: sort_order === 'asc' }
    });
  }

  // Apply date filters
  if (date_from || date_to) {
    orders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      if (date_from && orderDate < new Date(date_from)) return false;
      if (date_to && orderDate > new Date(date_to)) return false;
      return true;
    });
  }

  // Get order items for each order
  for (let order of orders) {
    const items = await DatabaseService.findAll('order_items', { order_id: order.id });
    order.items = items;
    order.item_count = items.length;
    order.total_quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  }

  // Get total count and statistics
  const totalCount = await DatabaseService.count('orders', conditions);
  
  const stats = {
    total: totalCount,
    pending: await DatabaseService.count('orders', { ...conditions, order_status: 'pending' }),
    confirmed: await DatabaseService.count('orders', { ...conditions, order_status: 'confirmed' }),
    processing: await DatabaseService.count('orders', { ...conditions, order_status: 'processing' }),
    shipped: await DatabaseService.count('orders', { ...conditions, order_status: 'shipped' }),
    delivered: await DatabaseService.count('orders', { ...conditions, order_status: 'delivered' }),
    cancelled: await DatabaseService.count('orders', { ...conditions, order_status: 'cancelled' })
  };

  res.json({
    success: true,
    data: {
      orders,
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
 * /orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', [
  body('customer_id')
    .isUUID()
    .withMessage('Valid customer ID required'),
  body('order_type')
    .optional()
    .isIn(['standard', 'express', 'bulk', 'subscription', 'custom']),
  body('billing_address')
    .isObject()
    .withMessage('Billing address is required'),
  body('shipping_address')
    .isObject()
    .withMessage('Shipping address is required'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one order item is required'),
  body('items.*.product_id')
    .isUUID()
    .withMessage('Valid product ID required for each item'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('items.*.unit_price')
    .isFloat({ min: 0 })
    .withMessage('Unit price must be a positive number'),
  body('delivery_date')
    .optional()
    .isISO8601(),
  body('special_instructions')
    .optional()
    .isLength({ max: 1000 })
    .trim(),
  body('payment_method')
    .optional()
    .isLength({ max: 50 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { customer_id, items, ...orderData } = req.body;

  // Verify customer exists and belongs to organization
  const customer = await DatabaseService.findById('customers', customer_id);
  if (!customer || customer.organization_id !== req.user.currentOrganizationId) {
    throw new ValidationError('Invalid customer');
  }

  // Validate products and calculate totals
  let subtotal = 0;
  const validatedItems = [];

  for (const item of items) {
    const product = await DatabaseService.findById('products', item.product_id);
    if (!product || product.organization_id !== req.user.currentOrganizationId) {
      throw new ValidationError(`Invalid product: ${item.product_id}`);
    }

    // Check inventory availability
    const inventory = await DatabaseService.findAll('inventory', {
      product_id: item.product_id,
      organization_id: req.user.currentOrganizationId
    });

    const totalAvailable = inventory.reduce((sum, inv) => sum + inv.available_quantity, 0);
    if (totalAvailable < item.quantity) {
      throw new ValidationError(`Insufficient inventory for product: ${product.name}. Available: ${totalAvailable}, Requested: ${item.quantity}`);
    }

    const itemTotal = item.quantity * item.unit_price;
    subtotal += itemTotal;

    validatedItems.push({
      product_id: item.product_id,
      sku: product.sku,
      name: product.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: itemTotal,
      discount_amount: item.discount_amount || 0,
      tax_rate: item.tax_rate || 0,
      tax_amount: (itemTotal * (item.tax_rate || 0)) / 100,
      notes: item.notes || null
    });
  }

  // Calculate totals
  const taxAmount = validatedItems.reduce((sum, item) => sum + item.tax_amount, 0);
  const discountAmount = validatedItems.reduce((sum, item) => sum + item.discount_amount, 0);
  const shippingAmount = orderData.shipping_amount || 0;
  const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

  // Create order
  const newOrder = await DatabaseService.create('orders', {
    ...orderData,
    customer_id,
    organization_id: req.user.currentOrganizationId,
    subtotal,
    tax_amount: taxAmount,
    discount_amount: discountAmount,
    shipping_amount: shippingAmount,
    total_amount: totalAmount,
    order_status: 'pending',
    payment_status: 'pending',
    assigned_to: req.user.id
  });

  // Create order items
  for (const item of validatedItems) {
    await DatabaseService.create('order_items', {
      ...item,
      order_id: newOrder.id
    });
  }

  // Get complete order with items
  const completeOrder = await DatabaseService.findWithJoins('orders', [
    { table: 'customers', select: 'id, name, email, customer_code' },
    { table: 'users', select: 'id, first_name, last_name, username' }
  ], { id: newOrder.id });

  const orderItems = await DatabaseService.findAll('order_items', { order_id: newOrder.id });
  completeOrder[0].items = orderItems;

  // Emit real-time update
  if (SocketService.isInitialized) {
    SocketService.emitToOrganization(req.user.currentOrganizationId, 'order:created', {
      order: completeOrder[0],
      createdBy: {
        id: req.user.id,
        name: `${req.user.firstName} ${req.user.lastName}`
      }
    });
  }

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: { order: completeOrder[0] }
  });
}));

module.exports = router;
