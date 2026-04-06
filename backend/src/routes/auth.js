const express = require('express');
const { register, login, logout, getProfile, forgotPassword, resetPassword } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const {
	loginRateLimit,
	forgotPasswordRateLimit,
	resetPasswordRateLimit
} = require('../middleware/rateLimit');

const router = express.Router();

router.post('/register', register);
router.post('/login', loginRateLimit, login);
router.post('/logout', logout);
router.get('/profile', authMiddleware, getProfile);
router.post('/forgot-password', forgotPasswordRateLimit, forgotPassword);
router.post('/reset-password', resetPasswordRateLimit, resetPassword);

module.exports = router;
