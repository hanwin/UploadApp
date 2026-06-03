const pool = require('../models/db');

/**
 * Log an activity event to the activity_logs table.
 * Errors are silently swallowed so logging never breaks request handling.
 *
 * @param {object} opts
 * @param {string}  opts.eventType  - e.g. 'login_success', 'upload_success'
 * @param {number|null} [opts.userId]
 * @param {string|null} [opts.username]
 * @param {string|null} [opts.ipAddress]
 * @param {object|null} [opts.details]  - arbitrary JSONB payload
 */
async function logActivity({ eventType, userId = null, username = null, ipAddress = null, details = null }) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (event_type, user_id, username, ip_address, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventType, userId || null, username || null, ipAddress || null, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('activityLogger: failed to write log entry', err.message);
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || null;
}

module.exports = { logActivity, getClientIp };
