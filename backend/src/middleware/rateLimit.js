const rateLimit = require('express-rate-limit');

const createLimiter = ({ windowMs, max, message, skipSuccessfulRequests = false }) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests,
  message: { error: message }
});

const loginRateLimit = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'För många inloggningsförsök. Försök igen om 15 minuter.'
});

const forgotPasswordRateLimit = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'För många försök att återställa lösenord. Försök igen om 15 minuter.'
});

const resetPasswordRateLimit = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'För många försök att sätta nytt lösenord. Försök igen om 15 minuter.'
});

module.exports = {
  loginRateLimit,
  forgotPasswordRateLimit,
  resetPasswordRateLimit
};