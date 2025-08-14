const express = require('express');
const { body, query, validationResult } = require('express-validator');
const DatabaseService = require('../services/DatabaseService');
const SocketService = require('../services/SocketService');
const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', [
  query('status').optional().isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  query('type').optional().isIn(['standard', 'express', 'bulk']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid query parameters', errors.array());
  }

  const { status, type, limit = 20, offset = 0 } = req.query;

  // Build query conditions
  let whereConditions = ['1=1'];
  let queryParams = [];
  let paramIndex = 1;

  if (status) {
    whereConditions.push(`o.order_status = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  if (type) {
    whereConditions.push(`o.order_type = $${paramIndex}`);
    queryParams.push(type);
    paramIndex++;
  }

  // Get orders with customer information
  const ordersQuery = `
    SELECT 
      o.*,
      c.name as customer_name,
      c.email as customer_email,
      c.phone as customer_phone,
      c.customer_type,
      c.tier as customer_tier
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY o.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const ordersResult = await DatabaseService.query(ordersQuery, queryParams);

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM orders o
    WHERE ${whereConditions.join(' AND ')}
  `;

  const countResult = await DatabaseService.query(countQuery, queryParams.slice(0, -2));
  const total = parseInt(countResult.rows[0].total);

  res.json({
    success: true,
    data: {
      orders: ordersResult.rows,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
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
  body('customerId').isUUID(),
  body('orderType').optional().isIn(['standard', 'express', 'bulk']),
  body('totalAmount').isDecimal({ decimal_digits: '0,2' }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('deliveryAddress').isObject(),
  body('deliveryDate').optional().isISO8601(),
  body('specialInstructions').optional().isLength({ max: 1000 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid order data', errors.array());
  }

  const {
    customerId,
    orderType = 'standard',
    totalAmount,
    currency = 'USD',
    deliveryAddress,
    deliveryDate,
    specialInstructions
  } = req.body;

  // Validate customer exists
  const customer = await DatabaseService.findById('customers', customerId);
  if (!customer || !customer.is_active) {
    throw new ValidationError('Customer not found or inactive');
  }

  // Generate order number
  const orderNumber = await generateOrderNumber();

  // Create order
  const orderData = {
    order_number: orderNumber,
    customer_id: customerId,
    order_type: orderType,
    total_amount: totalAmount,
    currency,
    delivery_address: deliveryAddress,
    delivery_date: deliveryDate ? new Date(deliveryDate) : null,
    special_instructions: specialInstructions,
    order_status: 'pending'
  };

  const order = await DatabaseService.create('orders', orderData);

  // Get complete order data with customer information
  const completeOrderResult = await DatabaseService.query(`
    SELECT 
      o.*,
      c.name as customer_name,
      c.email as customer_email,
      c.phone as customer_phone,
      c.customer_type,
      c.tier as customer_tier
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.id = $1
  `, [order.id]);

  const orderWithCustomer = completeOrderResult.rows[0];

  // Send real-time notification
  await SocketService.sendOrderUpdate(order.id, {
    action: 'created',
    order: orderWithCustomer
  });

  // Create order processing task
  await createOrderProcessingTask(order.id, req.user.id);

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: { order: orderWithCustomer }
  });
}));

// Helper function to generate order number
async function generateOrderNumber() {
  const today = new Date();
  const datePrefix = today.getFullYear().toString().slice(-2) + 
                    (today.getMonth() + 1).toString().padStart(2, '0') + 
                    today.getDate().toString().padStart(2, '0');
  
  // Get today's order count
  const countResult = await DatabaseService.query(`
    SELECT COUNT(*) as count
    FROM orders 
    WHERE DATE(created_at) = CURRENT_DATE
  `);
  
  const orderCount = parseInt(countResult.rows[0].count) + 1;
  const orderSequence = orderCount.toString().padStart(4, '0');
  
  return `ORD-${datePrefix}-${orderSequence}`;
}

// Helper function to create order processing task
async function createOrderProcessingTask(orderId, createdBy) {
  const taskData = {
    title: `Process Order ${orderId}`,
    description: `Review and process new order ${orderId}`,
    priority: 'high',
    assigned_to: createdBy,
    created_by: createdBy,
    status: 'pending',
    tags: ['order-processing', 'urgent'],
    metadata: {
      order_id: orderId,
      task_type: 'order_processing'
    }
  };

  return await DatabaseService.create('tasks', taskData);
}

module.exports = router;
