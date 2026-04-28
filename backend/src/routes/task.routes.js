const express = require('express');
const auth = require('../middleware/auth');
const {
  createTask,
  getTasks,
  getTask,
  rerunTask,
  deleteTask,
  createTaskValidation,
} = require('../controllers/task.controller');

const router = express.Router();

// All task routes require authentication
router.use(auth);

router.post('/', createTaskValidation, createTask);
router.get('/', getTasks);
router.get('/:id', getTask);
router.post('/:id/run', rerunTask);
router.delete('/:id', deleteTask);

module.exports = router;
