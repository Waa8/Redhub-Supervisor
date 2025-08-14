const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const DatabaseService = require('../services/DatabaseService');
const SocketService = require('../services/SocketService');
const { asyncHandler, ValidationError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');
const { authenticate, authorize, requireOrganization } = require('../middleware/auth-production');
const { searchRateLimiter } = require('../middleware/rateLimiter-production');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(requireOrganization);

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get tasks for the authenticated user
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, completed, cancelled]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 */
router.get('/', [
  query('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid query parameters', errors.array());
  }

  const { status, priority, limit = 20, offset = 0 } = req.query;
  const userId = req.user.id;

  // Build query conditions
  let whereConditions = ['assigned_to = $1'];
  let queryParams = [userId];
  let paramIndex = 2;

  if (status) {
    whereConditions.push(`status = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  if (priority) {
    whereConditions.push(`priority = $${paramIndex}`);
    queryParams.push(priority);
    paramIndex++;
  }

  // Get tasks with pagination
  const tasksQuery = `
    SELECT 
      t.*,
      u.username as assigned_to_username,
      u.first_name as assigned_to_first_name,
      u.last_name as assigned_to_last_name,
      c.username as created_by_username,
      c.first_name as created_by_first_name,
      c.last_name as created_by_last_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY 
      CASE t.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      t.due_date ASC NULLS LAST,
      t.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  queryParams.push(limit, offset);

  const tasksResult = await DatabaseService.query(tasksQuery, queryParams);

  // Get total count for pagination
  const countQuery = `
    SELECT COUNT(*) as total
    FROM tasks t
    WHERE ${whereConditions.join(' AND ')}
  `;

  const countResult = await DatabaseService.query(countQuery, queryParams.slice(0, -2));
  const total = parseInt(countResult.rows[0].total);

  res.json({
    success: true,
    data: {
      tasks: tasksResult.rows,
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
 * /tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               assignedTo:
 *                 type: string
 *                 format: uuid
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 */
router.post('/', [
  body('title').isLength({ min: 1, max: 200 }).trim(),
  body('description').optional().isLength({ max: 2000 }).trim(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('assignedTo').optional().isUUID(),
  body('dueDate').optional().isISO8601(),
  body('tags').optional().isArray()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid task data', errors.array());
  }

  const {
    title,
    description,
    priority = 'medium',
    assignedTo,
    dueDate,
    tags = []
  } = req.body;

  // Validate assigned user exists if provided
  if (assignedTo) {
    const assignedUser = await DatabaseService.findById('users', assignedTo);
    if (!assignedUser || !assignedUser.is_active) {
      throw new ValidationError('Assigned user not found or inactive');
    }
  }

  // Create task
  const taskData = {
    title,
    description,
    priority,
    assigned_to: assignedTo || req.user.id,
    created_by: req.user.id,
    due_date: dueDate ? new Date(dueDate) : null,
    tags,
    status: 'pending'
  };

  const task = await DatabaseService.create('tasks', taskData);

  // Get complete task data with user information
  const completeTask = await DatabaseService.query(`
    SELECT 
      t.*,
      u.username as assigned_to_username,
      u.first_name as assigned_to_first_name,
      u.last_name as assigned_to_last_name,
      c.username as created_by_username,
      c.first_name as created_by_first_name,
      c.last_name as created_by_last_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.id = $1
  `, [task.id]);

  const taskWithUsers = completeTask.rows[0];

  // Send real-time notification to assigned user
  if (assignedTo && assignedTo !== req.user.id) {
    await SocketService.sendToUser(assignedTo, 'task:assigned', {
      task: taskWithUsers,
      assignedBy: {
        id: req.user.id,
        name: `${req.user.firstName} ${req.user.lastName}`.trim() || req.user.username
      }
    });
  }

  // Send task update to all subscribers
  await SocketService.sendTaskUpdate(task.id, {
    action: 'created',
    task: taskWithUsers
  });

  res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: { task: taskWithUsers }
  });
}));

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get a specific task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const taskResult = await DatabaseService.query(`
    SELECT 
      t.*,
      u.username as assigned_to_username,
      u.first_name as assigned_to_first_name,
      u.last_name as assigned_to_last_name,
      c.username as created_by_username,
      c.first_name as created_by_first_name,
      c.last_name as created_by_last_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.id = $1
  `, [id]);

  if (taskResult.rows.length === 0) {
    throw new NotFoundError('Task not found');
  }

  const task = taskResult.rows[0];

  // Check if user has access to this task
  const hasAccess = task.assigned_to === req.user.id || 
                   task.created_by === req.user.id || 
                   req.user.role === 'admin' || 
                   req.user.role === 'manager';

  if (!hasAccess) {
    throw new ForbiddenError('Access denied to this task');
  }

  res.json({
    success: true,
    data: { task }
  });
}));

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Update a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 */
router.put('/:id', [
  body('title').optional().isLength({ min: 1, max: 200 }).trim(),
  body('description').optional().isLength({ max: 2000 }).trim(),
  body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('assignedTo').optional().isUUID(),
  body('dueDate').optional().isISO8601(),
  body('tags').optional().isArray()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid task data', errors.array());
  }

  const { id } = req.params;
  const updateData = req.body;

  // Get current task
  const currentTask = await DatabaseService.findById('tasks', id);
  if (!currentTask) {
    throw new NotFoundError('Task not found');
  }

  // Check permissions
  const canUpdate = currentTask.assigned_to === req.user.id || 
                   currentTask.created_by === req.user.id || 
                   req.user.role === 'admin' || 
                   req.user.role === 'manager';

  if (!canUpdate) {
    throw new ForbiddenError('Access denied to update this task');
  }

  // Prepare update data
  const updates = {};
  if (updateData.title) updates.title = updateData.title;
  if (updateData.description !== undefined) updates.description = updateData.description;
  if (updateData.status) updates.status = updateData.status;
  if (updateData.priority) updates.priority = updateData.priority;
  if (updateData.assignedTo) updates.assigned_to = updateData.assignedTo;
  if (updateData.dueDate) updates.due_date = new Date(updateData.dueDate);
  if (updateData.tags) updates.tags = updateData.tags;

  // Set completion date if status is completed
  if (updateData.status === 'completed' && currentTask.status !== 'completed') {
    updates.completed_at = new Date();
  } else if (updateData.status !== 'completed') {
    updates.completed_at = null;
  }

  // Update task
  const updatedTask = await DatabaseService.update('tasks', id, updates);

  // Get complete task data
  const completeTaskResult = await DatabaseService.query(`
    SELECT 
      t.*,
      u.username as assigned_to_username,
      u.first_name as assigned_to_first_name,
      u.last_name as assigned_to_last_name,
      c.username as created_by_username,
      c.first_name as created_by_first_name,
      c.last_name as created_by_last_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE t.id = $1
  `, [id]);

  const taskWithUsers = completeTaskResult.rows[0];

  // Send real-time updates
  await SocketService.sendTaskUpdate(id, {
    action: 'updated',
    task: taskWithUsers,
    updatedBy: req.user.id,
    changes: Object.keys(updates)
  });

  // Notify assigned user if assignment changed
  if (updateData.assignedTo && updateData.assignedTo !== currentTask.assigned_to) {
    await SocketService.sendToUser(updateData.assignedTo, 'task:reassigned', {
      task: taskWithUsers,
      reassignedBy: {
        id: req.user.id,
        name: `${req.user.firstName} ${req.user.lastName}`.trim() || req.user.username
      }
    });
  }

  res.json({
    success: true,
    message: 'Task updated successfully',
    data: { task: taskWithUsers }
  });
}));

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get current task
  const currentTask = await DatabaseService.findById('tasks', id);
  if (!currentTask) {
    throw new NotFoundError('Task not found');
  }

  // Check permissions (only creator or admin can delete)
  const canDelete = currentTask.created_by === req.user.id || 
                   req.user.role === 'admin';

  if (!canDelete) {
    throw new ForbiddenError('Access denied to delete this task');
  }

  // Delete task
  await DatabaseService.delete('tasks', id);

  // Send real-time update
  await SocketService.sendTaskUpdate(id, {
    action: 'deleted',
    taskId: id,
    deletedBy: req.user.id
  });

  res.json({
    success: true,
    message: 'Task deleted successfully'
  });
}));

/**
 * @swagger
 * /tasks/summary:
 *   get:
 *     summary: Get task summary for dashboard
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get task counts by status
  const summaryResult = await DatabaseService.query(`
    SELECT 
      status,
      priority,
      COUNT(*) as count
    FROM tasks 
    WHERE assigned_to = $1
    GROUP BY status, priority
  `, [userId]);

  // Get overdue tasks count
  const overdueResult = await DatabaseService.query(`
    SELECT COUNT(*) as count
    FROM tasks 
    WHERE assigned_to = $1 
      AND due_date < NOW() 
      AND status NOT IN ('completed', 'cancelled')
  `, [userId]);

  // Get today's tasks
  const todayResult = await DatabaseService.query(`
    SELECT COUNT(*) as count
    FROM tasks 
    WHERE assigned_to = $1 
      AND DATE(due_date) = CURRENT_DATE
      AND status NOT IN ('completed', 'cancelled')
  `, [userId]);

  // Process summary data
  const summary = {
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    overdue: parseInt(overdueResult.rows[0].count),
    today: parseInt(todayResult.rows[0].count),
    byPriority: {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0
    }
  };

  summaryResult.rows.forEach(row => {
    summary.total += parseInt(row.count);
    summary[row.status] += parseInt(row.count);
    summary.byPriority[row.priority] += parseInt(row.count);
  });

  // Calculate completion rate
  summary.completionRate = summary.total > 0 
    ? Math.round((summary.completed / summary.total) * 100) 
    : 0;

  res.json({
    success: true,
    data: { summary }
  });
}));

module.exports = router;
