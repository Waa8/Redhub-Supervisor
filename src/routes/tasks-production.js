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
 *     summary: Get tasks with advanced filtering and search
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', [
  query('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled', 'on_hold']),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent', 'critical']),
  query('assigned_to').optional().isUUID(),
  query('created_by').optional().isUUID(),
  query('project_id').optional().isUUID(),
  query('category_id').optional().isUUID(),
  query('due_date_from').optional().isISO8601(),
  query('due_date_to').optional().isISO8601(),
  query('search').optional().isLength({ min: 1, max: 100 }),
  query('tags').optional(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort_by').optional().isIn(['created_at', 'updated_at', 'due_date', 'priority', 'title']),
  query('sort_order').optional().isIn(['asc', 'desc']),
  query('include_subtasks').optional().isBoolean(),
  query('my_tasks_only').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid query parameters', errors.array());
  }

  const { 
    status, 
    priority, 
    assigned_to, 
    created_by,
    project_id,
    category_id,
    due_date_from,
    due_date_to,
    search,
    tags,
    page = 1, 
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'desc',
    include_subtasks = true,
    my_tasks_only = false
  } = req.query;

  const offset = (page - 1) * limit;

  // Build conditions for organization isolation
  const conditions = { organization_id: req.user.currentOrganizationId };
  
  if (status) conditions.status = status;
  if (priority) conditions.priority = priority;
  if (project_id) conditions.project_id = project_id;
  if (category_id) conditions.category_id = category_id;
  
  // Filter by assignment
  if (my_tasks_only === 'true') {
    conditions.assigned_to = req.user.id;
  } else if (assigned_to) {
    conditions.assigned_to = assigned_to;
  }
  
  if (created_by) {
    conditions.created_by = created_by;
  }

  let tasks;
  
  if (search) {
    // Use search functionality
    tasks = await DatabaseService.search('tasks', search, ['title', 'description'], {
      conditions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: { column: sort_by, ascending: sort_order === 'asc' }
    });
  } else {
    // Regular query with joins for related data
    tasks = await DatabaseService.findWithJoins('tasks', [
      { table: 'users', select: 'id, first_name, last_name, username, avatar_url' },
      { table: 'projects', select: 'id, name, code, status' },
      { table: 'task_categories', select: 'id, name, color, icon' }
    ], conditions, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: { column: sort_by, ascending: sort_order === 'asc' }
    });
  }

  // Apply date filters (would be better done in database query)
  if (due_date_from || due_date_to || tags) {
    tasks = tasks.filter(task => {
      if (due_date_from && task.due_date && new Date(task.due_date) < new Date(due_date_from)) {
        return false;
      }
      if (due_date_to && task.due_date && new Date(task.due_date) > new Date(due_date_to)) {
        return false;
      }
      if (tags && tags.length > 0) {
        const taskTags = task.tags || [];
        const tagArray = Array.isArray(tags) ? tags : [tags];
        const hasMatchingTag = tagArray.some(tag => taskTags.includes(tag));
        if (!hasMatchingTag) return false;
      }
      return true;
    });
  }

  // Get subtasks if requested
  if (include_subtasks === 'true') {
    for (let task of tasks) {
      const subtasks = await DatabaseService.findAll('tasks', {
        parent_task_id: task.id,
        organization_id: req.user.currentOrganizationId
      });
      task.subtasks = subtasks;
    }
  }

  // Get total count for pagination
  const totalCount = await DatabaseService.count('tasks', conditions);

  // Get task statistics for dashboard
  const stats = {
    total: totalCount,
    pending: await DatabaseService.count('tasks', { ...conditions, status: 'pending' }),
    in_progress: await DatabaseService.count('tasks', { ...conditions, status: 'in_progress' }),
    completed: await DatabaseService.count('tasks', { ...conditions, status: 'completed' }),
    cancelled: await DatabaseService.count('tasks', { ...conditions, status: 'cancelled' }),
    on_hold: await DatabaseService.count('tasks', { ...conditions, status: 'on_hold' })
  };

  res.json({
    success: true,
    data: {
      tasks,
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
 * /tasks/{id}:
 *   get:
 *     summary: Get a specific task with full details
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Valid task ID required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid parameters', errors.array());
  }

  const { id } = req.params;

  // Get task with all related data
  const tasks = await DatabaseService.findWithJoins('tasks', [
    { table: 'users', select: 'id, first_name, last_name, username, avatar_url' },
    { table: 'projects', select: 'id, name, code, status' },
    { table: 'task_categories', select: 'id, name, color, icon' }
  ], { 
    id, 
    organization_id: req.user.currentOrganizationId 
  });

  const task = tasks[0];
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  // Get task comments
  const comments = await DatabaseService.findWithJoins('task_comments', [
    { table: 'users', select: 'id, first_name, last_name, username, avatar_url' }
  ], { task_id: id }, {
    orderBy: { column: 'created_at', ascending: true }
  });

  // Get subtasks
  const subtasks = await DatabaseService.findWithJoins('tasks', [
    { table: 'users', select: 'id, first_name, last_name, username' }
  ], { 
    parent_task_id: id,
    organization_id: req.user.currentOrganizationId 
  });

  // Get task dependencies
  const dependencies = await DatabaseService.findWithJoins('task_dependencies', [
    { table: 'tasks', select: 'id, title, status, priority' }
  ], { task_id: id });

  task.comments = comments;
  task.subtasks = subtasks;
  task.dependencies = dependencies;

  res.json({
    success: true,
    data: { task }
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
 */
router.post('/', [
  body('title')
    .isLength({ min: 1, max: 200 })
    .trim()
    .withMessage('Title is required and must be less than 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 5000 })
    .trim(),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
    .withMessage('Invalid priority'),
  body('assigned_to')
    .optional()
    .isUUID()
    .withMessage('Invalid user ID'),
  body('project_id')
    .optional()
    .isUUID()
    .withMessage('Invalid project ID'),
  body('category_id')
    .optional()
    .isUUID()
    .withMessage('Invalid category ID'),
  body('parent_task_id')
    .optional()
    .isUUID()
    .withMessage('Invalid parent task ID'),
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Invalid due date format'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('estimated_hours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated hours must be a positive number'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('checklist')
    .optional()
    .isArray()
    .withMessage('Checklist must be an array'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const taskData = {
    ...req.body,
    organization_id: req.user.currentOrganizationId,
    created_by: req.user.id,
    status: 'pending'
  };

  // Validate assigned user belongs to same organization
  if (taskData.assigned_to) {
    const assignedUser = await DatabaseService.findById('users', taskData.assigned_to);
    if (!assignedUser) {
      throw new ValidationError('Assigned user not found');
    }

    const userOrgs = await DatabaseService.findAll('user_organizations', {
      user_id: taskData.assigned_to,
      organization_id: req.user.currentOrganizationId,
      is_active: true
    });

    if (userOrgs.length === 0) {
      throw new ValidationError('Cannot assign task to user outside organization');
    }
  }

  // Validate project belongs to organization
  if (taskData.project_id) {
    const project = await DatabaseService.findById('projects', taskData.project_id);
    if (!project || project.organization_id !== req.user.currentOrganizationId) {
      throw new ValidationError('Invalid project');
    }
  }

  // Create task
  const task = await DatabaseService.create('tasks', taskData);

  // Emit real-time update
  if (SocketService.isInitialized) {
    SocketService.emitToOrganization(req.user.currentOrganizationId, 'task:created', {
      task,
      createdBy: {
        id: req.user.id,
        name: `${req.user.firstName} ${req.user.lastName}`
      }
    });
  }

  res.status(201).json({
    success: true,
    message: 'Task created successfully',
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
 */
router.put('/:id', [
  param('id').isUUID().withMessage('Valid task ID required'),
  body('title')
    .optional()
    .isLength({ min: 1, max: 200 })
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 5000 })
    .trim(),
  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'cancelled', 'on_hold']),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent', 'critical']),
  body('assigned_to')
    .optional()
    .isUUID(),
  body('due_date')
    .optional()
    .isISO8601(),
  body('progress')
    .optional()
    .isInt({ min: 0, max: 100 }),
  body('actual_hours')
    .optional()
    .isFloat({ min: 0 }),
  body('tags')
    .optional()
    .isArray(),
  body('checklist')
    .optional()
    .isArray()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }

  const { id } = req.params;

  // Check if task exists and user has permission
  const existingTask = await DatabaseService.findById('tasks', id);
  if (!existingTask) {
    throw new NotFoundError('Task not found');
  }

  if (existingTask.organization_id !== req.user.currentOrganizationId) {
    throw new ForbiddenError('Access denied');
  }

  // Check if user can update this task
  const canUpdate = existingTask.created_by === req.user.id ||
                   existingTask.assigned_to === req.user.id ||
                   ['admin', 'manager'].includes(req.user.role);

  if (!canUpdate) {
    throw new ForbiddenError('You do not have permission to update this task');
  }

  // Prepare update data
  const updateData = { ...req.body };

  // Auto-complete task if progress is 100%
  if (updateData.progress === 100 && existingTask.status !== 'completed') {
    updateData.status = 'completed';
    updateData.completed_at = new Date();
  }

  // Auto-set completion time if status changed to completed
  if (updateData.status === 'completed' && existingTask.status !== 'completed') {
    updateData.completed_at = new Date();
    if (!updateData.progress) {
      updateData.progress = 100;
    }
  }

  // Update task
  const updatedTask = await DatabaseService.update('tasks', id, updateData);

  // Emit real-time update
  if (SocketService.isInitialized) {
    SocketService.emitToOrganization(req.user.currentOrganizationId, 'task:updated', {
      task: updatedTask,
      updatedBy: {
        id: req.user.id,
        name: `${req.user.firstName} ${req.user.lastName}`
      },
      changes: Object.keys(updateData)
    });
  }

  res.json({
    success: true,
    message: 'Task updated successfully',
    data: { task: updatedTask }
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
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Valid task ID required')
], authorize('admin', 'manager'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Invalid parameters', errors.array());
  }

  const { id } = req.params;

  // Check if task exists
  const task = await DatabaseService.findById('tasks', id);
  if (!task) {
    throw new NotFoundError('Task not found');
  }

  if (task.organization_id !== req.user.currentOrganizationId) {
    throw new ForbiddenError('Access denied');
  }

  // Check for subtasks
  const subtasks = await DatabaseService.findAll('tasks', { parent_task_id: id });
  if (subtasks.length > 0) {
    throw new ValidationError('Cannot delete task with subtasks. Please delete or reassign subtasks first.');
  }

  // Delete task
  await DatabaseService.delete('tasks', id);

  // Emit real-time update
  if (SocketService.isInitialized) {
    SocketService.emitToOrganization(req.user.currentOrganizationId, 'task:deleted', {
      taskId: id,
      deletedBy: {
        id: req.user.id,
        name: `${req.user.firstName} ${req.user.lastName}`
      }
    });
  }

  res.json({
    success: true,
    message: 'Task deleted successfully'
  });
}));

module.exports = router;
