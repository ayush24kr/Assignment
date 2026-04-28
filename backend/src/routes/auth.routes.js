const express = require('express');
const auth = require('../middleware/auth');
const {
  register,
  login,
  getMe,
  registerValidation,
  loginValidation,
} = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply stricter rate limit to auth routes
router.use(authLimiter);

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', auth, getMe);

module.exports = router;
