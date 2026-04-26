const crypto = require('crypto');

const CSRF_COOKIE_NAME = 'csrf_token';

const parseCookies = (cookieHeader = '') => {
  const cookies = {};

  cookieHeader.split(';').forEach((part) => {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (!rawName) {
      return;
    }

    cookies[rawName] = decodeURIComponent(rawValueParts.join('='));
  });

  return cookies;
};

const csrfCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/'
};

const createCsrfToken = () => crypto.randomBytes(32).toString('hex');

const getRequestCsrfToken = (req) => req.get('x-csrf-token') || req.body?.csrfToken;

const issueCsrfToken = (req, res) => {
  const token = createCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);
  res.json({ csrfToken: token });
};

const csrfProtectionMiddleware = (req, res, next) => {
  const method = (req.method || '').toUpperCase();
  const isUnsafeMethod = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

  if (!isUnsafeMethod) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const csrfCookie = cookies[CSRF_COOKIE_NAME];
  const csrfRequest = getRequestCsrfToken(req);

  if (!csrfCookie || !csrfRequest || csrfCookie !== csrfRequest) {
    return res.status(403).json({ error: 'Ogiltig CSRF-token' });
  }

  return next();
};

module.exports = {
  csrfProtectionMiddleware,
  issueCsrfToken
};
