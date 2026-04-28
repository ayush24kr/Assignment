const { validationResult, body } = require('express-validator');
const Task = require('../models/Task');
const { enqueueTask } = require('../services/queue.service');

// Validation rules
const createTaskValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('inputText')
    .trim()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Input text must be between 1 and 10000 characters'),
  body('operation')
    .isIn(['uppercase', 'lowercase', 'reverse', 'word_count'])
    .withMessage('Operation must be one of: uppercase, lowercase, reverse, word_count'),
];

// POST /api/tasks — Create a new task
const createTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array().map((e) => e.msg),
      });
    }

    const { title, inputText, operation } = req.body;

    // Create task with pending status
    const task = await Task.create({
      userId: req.user.id,
      title,
      inputText,
      operation,
      status: 'pending',
      logs: [{ message: 'Task created', level: 'info' }],
    });

    // Push to Redis queue
    await enqueueTask(task._id);

    // Add queued log
    task.logs.push({ message: 'Task added to processing queue', level: 'info' });
    await task.save();

    res.status(201).json({
      success: true,
      message: 'Task created and queued for processing',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/tasks — List user's tasks (paginated)
const getTasks = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const query = { userId: req.user.id };
    if (status && ['pending', 'running', 'success', 'failed'].includes(status)) {
      query.status = status;
    }

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-logs'),
      Task.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/tasks/:id — Get task details
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    res.json({
      success: true,
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/tasks/:id/run — Re-run a failed task
const rerunTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    if (task.status !== 'failed') {
      return res.status(400).json({
        success: false,
        message: 'Only failed tasks can be re-run',
      });
    }

    // Reset task
    task.status = 'pending';
    task.result = null;
    task.errorMessage = null;
    task.logs.push({ message: 'Task re-queued for processing', level: 'info' });
    await task.save();

    // Re-enqueue
    await enqueueTask(task._id);

    res.json({
      success: true,
      message: 'Task re-queued for processing',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/tasks/:id — Delete a task
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    res.json({
      success: true,
      message: 'Task deleted',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTask,
  getTasks,
  getTask,
  rerunTask,
  deleteTask,
  createTaskValidation,
};
