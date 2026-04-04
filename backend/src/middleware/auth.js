const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    // Only check for token in Authorization header (security best practice)
    const token = req.headers.authorization?.split(' ')[1];
    
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

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Access denied. Admin only.' });
  }
  next();
};

const superadminMiddleware = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Access denied. Superadmin only.' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware, superadminMiddleware };
