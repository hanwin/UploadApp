const jwt = require('jsonwebtoken');
const { getTokenFromRequest } = require('./auth');

// Special auth middleware for audio streaming that allows token in query
// HTML5 audio elements can't send Authorization headers
const streamAuthMiddleware = (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { streamAuthMiddleware };
