const pool = require('../models/db');

const EVENT_TYPE_LABELS = {
  login_success: 'Inloggning lyckades',
  login_failure: 'Inloggning misslyckades',
  logout: 'Utloggning',
  upload_success: 'Uppladdning lyckades',
  upload_failure: 'Uppladdning misslyckades',
  file_delete: 'Fil raderad'
};

const getLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const eventType = req.query.event_type || null;
    const userId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
    const from = req.query.from || null;
    const to = req.query.to || null;

    const conditions = [];
    const params = [];

    if (eventType) {
      params.push(eventType);
      conditions.push(`event_type = $${params.length}`);
    }
    if (userId) {
      params.push(userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`created_at <= $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM activity_logs ${where}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    params.push(limit, offset);
    const dataResult = await pool.query(
      `SELECT id, event_type, user_id, username, ip_address, details, created_at
       FROM activity_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      eventTypeLabels: EVENT_TYPE_LABELS,
      logs: dataResult.rows
    });
  } catch (error) {
    console.error('getLogs error:', error);
    res.status(500).json({ error: 'Det gick inte att hämta loggar' });
  }
};

module.exports = { getLogs };
