const pool = require('../models/db');

function normalizePathSeparators(value) {
  const input = String(value || '').trim();
  const uncPrefixMatch = input.match(/^(\\\\|\/\/)/);
  const uncPrefix = uncPrefixMatch ? uncPrefixMatch[0] : '';
  const body = uncPrefix ? input.slice(uncPrefix.length) : input;

  return `${uncPrefix}${body.replace(/[\\/]{2,}/g, (match) => match[0])}`;
}

function sanitizeDefaultSeqPath(value) {
  return normalizePathSeparators(String(value || '').replace(/[\\/]?\{filename\}\s*$/i, ''));
}

const SETTING_KEY = 'default_seq_path_template';

const getSettings = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT value FROM app_settings WHERE key = $1 LIMIT 1',
      [SETTING_KEY]
    );

    res.json({
      defaultSeqPathTemplate: result.rows[0]?.value || ''
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Det gick inte att hämta inställningar' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const sanitizedValue = sanitizeDefaultSeqPath(req.body?.defaultSeqPathTemplate || '');

    const result = await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
       RETURNING value`,
      [SETTING_KEY, sanitizedValue]
    );

    res.json({
      defaultSeqPathTemplate: result.rows[0]?.value || ''
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Det gick inte att spara inställningar' });
  }
};

const getDefaultSeqPathTemplate = async () => {
  const result = await pool.query(
    'SELECT value FROM app_settings WHERE key = $1 LIMIT 1',
    [SETTING_KEY]
  );

  return result.rows[0]?.value || '';
};

module.exports = {
  getSettings,
  updateSettings,
  getDefaultSeqPathTemplate
};
