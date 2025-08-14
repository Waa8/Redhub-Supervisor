const express = require('express');
const { query, validationResult } = require('express-validator');
const DatabaseService = require('../services/DatabaseService');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { authenticate, authorize, requireOrganization } = require('../middleware/auth-production');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireOrganization);

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: Get dashboard data with real-time metrics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', [
  query('period').optional().isIn(['today', 'week', 'month', 'quarter', 'year']),
  query('timezone').optional().isLength({ max: 50 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid query parameters', errors.array());
  }

  const { period = 'month', timezone = 'UTC' } = req.query;
  const orgId = req.user.currentOrganizationId;

  // Calculate date range based on period
  const now = new Date();
  let startDate, endDate = now;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Get task metrics
  const taskMetrics = {
    total: await DatabaseService.count('tasks', { organization_id: orgId }),
    pending: await DatabaseService.count('tasks', { organization_id: orgId, status: 'pending' }),
    in_progress: await DatabaseService.count('tasks', { organization_id: orgId, status: 'in_progress' }),
    completed: await DatabaseService.count('tasks', { organization_id: orgId, status: 'completed' }),
    cancelled: await DatabaseService.count('tasks', { organization_id: orgId, status: 'cancelled' }),
    on_hold: await DatabaseService.count('tasks', { organization_id: orgId, status: 'on_hold' }),
    high_priority: await DatabaseService.count('tasks', { organization_id: orgId, priority: 'high' }),
    urgent: await DatabaseService.count('tasks', { organization_id: orgId, priority: 'urgent' }),
    critical: await DatabaseService.count('tasks', { organization_id: orgId, priority: 'critical' })
  };

  // Calculate task completion rate
  taskMetrics.completion_rate = taskMetrics.total > 0 
    ? ((taskMetrics.completed / taskMetrics.total) * 100).toFixed(1)
    : 0;

  // Get order metrics
  const orderMetrics = {
    total: await DatabaseService.count('orders', { organization_id: orgId }),
    pending: await DatabaseService.count('orders', { organization_id: orgId, order_status: 'pending' }),
    confirmed: await DatabaseService.count('orders', { organization_id: orgId, order_status: 'confirmed' }),
    processing: await DatabaseService.count('orders', { organization_id: orgId, order_status: 'processing' }),
    shipped: await DatabaseService.count('orders', { organization_id: orgId, order_status: 'shipped' }),
    delivered: await DatabaseService.count('orders', { organization_id: orgId, order_status: 'delivered' }),
    cancelled: await DatabaseService.count('orders', { organization_id: orgId, order_status: 'cancelled' })
  };

  // Get delivery metrics
  const deliveryMetrics = {
    total: await DatabaseService.count('deliveries', { organization_id: orgId }),
    pending: await DatabaseService.count('deliveries', { organization_id: orgId, delivery_status: 'pending' }),
    assigned: await DatabaseService.count('deliveries', { organization_id: orgId, delivery_status: 'assigned' }),
    in_transit: await DatabaseService.count('deliveries', { organization_id: orgId, delivery_status: 'in_transit' }),
    out_for_delivery: await DatabaseService.count('deliveries', { organization_id: orgId, delivery_status: 'out_for_delivery' }),
    delivered: await DatabaseService.count('deliveries', { organization_id: orgId, delivery_status: 'delivered' }),
    failed: await DatabaseService.count('deliveries', { organization_id: orgId, delivery_status: 'failed' })
  };

  // Get customer metrics
  const customerMetrics = {
    total: await DatabaseService.count('customers', { organization_id: orgId }),
    active: await DatabaseService.count('customers', { organization_id: orgId, is_active: true }),
    new_this_period: 0, // Would need date-based query
    individual: await DatabaseService.count('customers', { organization_id: orgId, customer_type: 'individual' }),
    business: await DatabaseService.count('customers', { organization_id: orgId, customer_type: 'business' }),
    enterprise: await DatabaseService.count('customers', { organization_id: orgId, customer_type: 'enterprise' })
  };

  // Get financial metrics (placeholder - would need proper aggregation)
  const financialMetrics = {
    total_revenue: 0,
    pending_payments: 0,
    overdue_invoices: 0,
    this_period_revenue: 0,
    average_order_value: 0
  };

  // Get support metrics
  const supportMetrics = {
    total_tickets: await DatabaseService.count('support_tickets', { organization_id: orgId }),
    open_tickets: await DatabaseService.count('support_tickets', { organization_id: orgId, status: 'open' }),
    in_progress_tickets: await DatabaseService.count('support_tickets', { organization_id: orgId, status: 'in_progress' }),
    resolved_tickets: await DatabaseService.count('support_tickets', { organization_id: orgId, status: 'resolved' }),
    escalated_tickets: await DatabaseService.count('support_tickets', { organization_id: orgId, status: 'escalated' })
  };

  // Get recent activity
  const recentTasks = await DatabaseService.findWithJoins('tasks', [
    { table: 'users', select: 'first_name, last_name' }
  ], { organization_id: orgId }, {
    limit: 5,
    orderBy: { column: 'updated_at', ascending: false }
  });

  const recentOrders = await DatabaseService.findWithJoins('orders', [
    { table: 'customers', select: 'name, customer_code' }
  ], { organization_id: orgId }, {
    limit: 5,
    orderBy: { column: 'created_at', ascending: false }
  });

  const recentActivity = [
    ...recentTasks.map(task => ({
      id: task.id,
      type: 'task',
      title: task.title,
      description: `Task ${task.status} by ${task.users?.first_name} ${task.users?.last_name}`,
      timestamp: task.updated_at,
      status: task.status,
      priority: task.priority
    })),
    ...recentOrders.map(order => ({
      id: order.id,
      type: 'order',
      title: `Order ${order.order_number}`,
      description: `Order from ${order.customers?.name} - ${order.order_status}`,
      timestamp: order.created_at,
      status: order.order_status,
      amount: order.total_amount
    }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

  // Get user's personal metrics
  const userMetrics = {
    assigned_tasks: await DatabaseService.count('tasks', { 
      organization_id: orgId, 
      assigned_to: req.user.id,
      status: ['pending', 'in_progress']
    }),
    completed_tasks: await DatabaseService.count('tasks', { 
      organization_id: orgId, 
      assigned_to: req.user.id,
      status: 'completed'
    }),
    created_tasks: await DatabaseService.count('tasks', { 
      organization_id: orgId, 
      created_by: req.user.id
    }),
    managed_orders: await DatabaseService.count('orders', { 
      organization_id: orgId, 
      assigned_to: req.user.id
    })
  };

  res.json({
    success: true,
    data: {
      period,
      organization_id: orgId,
      metrics: {
        tasks: taskMetrics,
        orders: orderMetrics,
        deliveries: deliveryMetrics,
        customers: customerMetrics,
        financial: financialMetrics,
        support: supportMetrics,
        user: userMetrics
      },
      recent_activity: recentActivity,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * @swagger
 * /dashboard/analytics:
 *   get:
 *     summary: Get detailed analytics data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 */
router.get('/analytics', authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const orgId = req.user.currentOrganizationId;

  // This would typically involve complex aggregation queries
  // For now, returning basic analytics structure
  
  const analytics = {
    performance_trends: {
      tasks_completed_trend: [], // 30-day trend
      orders_processed_trend: [], // 30-day trend
      revenue_trend: [], // 30-day trend
      customer_satisfaction_trend: [] // 30-day trend
    },
    productivity_metrics: {
      average_task_completion_time: 0,
      task_completion_rate: 0,
      order_fulfillment_rate: 0,
      customer_response_time: 0
    },
    resource_utilization: {
      user_workload: [], // Users and their task counts
      warehouse_capacity: [], // Warehouse utilization
      vehicle_utilization: [] // Vehicle usage stats
    },
    financial_insights: {
      revenue_by_customer_tier: {},
      profit_margins: {},
      payment_collection_rate: 0
    }
  };

  res.json({
    success: true,
    data: { analytics }
  });
}));

module.exports = router;
