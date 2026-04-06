const jwt = require('jsonwebtoken');
const { getTokenFromRequest } = require('./auth');

// Special auth middleware for audio streaming that allows token in query
// HTML5 audio elements can't send Authorization headers
const streamAuthMiddleware = (req, res, next) => {
  try {
    let token = getTokenFromRequest(req);
    
    // Fall back to query parameter for streaming (required for HTML5 audio)
    if (!token && req.query.token) {
      token = req.query.token;
    }
    
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
