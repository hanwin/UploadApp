const jwt = require('jsonwebtoken');

const getTokenFromCookies = (cookieHeader) => {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === 'auth_token') {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return null;
};

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization?.split(' ')[1];
  if (authHeader) {
    return authHeader;
  }

  return getTokenFromCookies(req.headers.cookie);
};

const authMiddleware = (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    
    if (!token) {
      return res.status(401).json({ error: 'Åtkomst nekad. Ingen token angiven.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Ogiltig token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Åtkomst nekad. Kräver administratörsbehörighet.' });
  }
  next();
};

const superadminMiddleware = (req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Åtkomst nekad. Kräver superadmin-behörighet.' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware, superadminMiddleware, getTokenFromRequest };
