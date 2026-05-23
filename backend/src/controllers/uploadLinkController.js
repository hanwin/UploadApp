const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../models/db');
const { getCanonicalAudioMimeType } = require('../utils/audioMime');
const {
  getPublicUploadFolderName,
  getPublicUploadFolderDisplayName
} = require('./settingsController');

const DEFAULT_FRONTEND_URL = 'http://localhost:81';

function buildFrontendBaseUrl(req) {
  const configured = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const protocol = req.protocol || 'http';
  const host = req.get('host');
  return `${protocol}://${host}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function decodeOriginalName(name) {
  return Buffer.from(name || '', 'latin1').toString('utf8').normalize('NFC');
}

async function ensurePublicFolderExists() {
  const folderName = await getPublicUploadFolderName();
  const displayName = await getPublicUploadFolderDisplayName();

  if (folderName.includes('..') || folderName.includes('/') || folderName.includes('\\')) {
    throw new Error('Invalid public upload folder name');
  }

  await pool.query(
    `INSERT INTO folders (original_name, disk_name, default_mp3_title, default_mp3_artist, default_seq_path)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (disk_name) DO NOTHING`,
    [displayName, folderName, null, null, null]
  );

  const uploadsRoot = path.join(__dirname, '../../uploads');
  const folderPath = path.join(uploadsRoot, folderName);
  if (!folderPath.startsWith(uploadsRoot)) {
    throw new Error('Invalid public upload folder path');
  }

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  return { folderName, displayName, folderPath };
}

const createUploadLink = async (req, res) => {
  try {
    const validDays = Number.parseInt(req.body?.validDays, 10);
    if (!Number.isInteger(validDays) || validDays < 1 || validDays > 7) {
      return res.status(400).json({ error: 'Giltighetstid måste vara mellan 1 och 7 dagar' });
    }

    const { folderName } = await ensurePublicFolderExists();

    await pool.query(
      `INSERT INTO user_folders (user_id, folder_name)
       VALUES ($1, $2)
       ON CONFLICT (user_id, folder_name) DO NOTHING`,
      [req.user.id, folderName]
    );

    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(plainToken);
    const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);

    const insertResult = await pool.query(
      `INSERT INTO upload_links (token_hash, created_by_user_id, folder_name, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at, expires_at`,
      [tokenHash, req.user.id, folderName, expiresAt]
    );

    const frontendBase = buildFrontendBaseUrl(req);
    const uploadUrl = `${frontendBase}/public-upload?token=${plainToken}`;

    return res.status(201).json({
      id: insertResult.rows[0].id,
      uploadUrl,
      expiresAt: insertResult.rows[0].expires_at,
      createdAt: insertResult.rows[0].created_at,
      validDays
    });
  } catch (error) {
    console.error('Create upload link error:', error);
    return res.status(500).json({ error: 'Det gick inte att skapa uppladdningslänk' });
  }
};

const getMyUploadLinks = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, expires_at, created_at, is_active, use_count, last_used_at
       FROM upload_links
       WHERE created_by_user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get upload links error:', error);
    res.status(500).json({ error: 'Det gick inte att hämta uppladdningslänkar' });
  }
};

async function findActiveUploadLinkByToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const tokenHash = hashToken(token);
  const result = await pool.query(
    `SELECT id, created_by_user_id, folder_name, expires_at, is_active
     FROM upload_links
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const link = result.rows[0];
  const expired = new Date(link.expires_at).getTime() <= Date.now();
  if (!link.is_active || expired) {
    return null;
  }

  return link;
}

const getPublicUploadLinkInfo = async (req, res) => {
  try {
    const token = req.query?.token;
    const link = await findActiveUploadLinkByToken(token);

    if (!link) {
      return res.status(404).json({ error: 'Länken är ogiltig eller har gått ut' });
    }

    return res.json({
      valid: true,
      expiresAt: link.expires_at
    });
  } catch (error) {
    console.error('Get public upload link info error:', error);
    return res.status(500).json({ error: 'Det gick inte att verifiera länken' });
  }
};

const validatePublicUploadToken = async (req, res, next) => {
  try {
    const token = req.query?.token;
    const link = await findActiveUploadLinkByToken(token);

    if (!link) {
      return res.status(404).json({ error: 'Länken är ogiltig eller har gått ut' });
    }

    req.uploadLink = link;
    return next();
  } catch (error) {
    console.error('Validate public upload token error:', error);
    return res.status(500).json({ error: 'Det gick inte att verifiera länken' });
  }
};

const handlePublicUpload = async (req, res) => {
  try {
    const link = req.uploadLink;

    if (!link) {
      return res.status(404).json({ error: 'Länken är ogiltig eller har gått ut' });
    }

    const { folderName } = await ensurePublicFolderExists();
    if (folderName !== link.folder_name) {
      return res.status(400).json({ error: 'Länkens målmapp matchar inte konfigurationen' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Ingen fil uppladdad' });
    }

    const decodedOriginalName = decodeOriginalName(req.file.originalname);
    const canonicalMimeType = getCanonicalAudioMimeType(decodedOriginalName) || getCanonicalAudioMimeType(req.file.filename);

    if (!canonicalMimeType) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Filtypen stöds inte' });
    }

    const insertResult = await pool.query(
      `INSERT INTO audio_files (user_id, filename, original_name, file_path, file_size, mime_type, folder, processing_status, delete_original_on_success)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        link.created_by_user_id,
        req.file.filename,
        decodedOriginalName,
        req.file.path,
        req.file.size,
        canonicalMimeType,
        link.folder_name,
        'none',
        false
      ]
    );

    await pool.query(
      `UPDATE upload_links
       SET use_count = use_count + 1,
           last_used_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [link.id]
    );

    return res.status(201).json({
      message: 'Fil uppladdad',
      file: insertResult.rows[0]
    });
  } catch (error) {
    console.error('Public upload error:', error);
    return res.status(500).json({ error: 'Det gick inte att ladda upp filen' });
  }
};

module.exports = {
  createUploadLink,
  getMyUploadLinks,
  getPublicUploadLinkInfo,
  validatePublicUploadToken,
  handlePublicUpload,
  ensurePublicFolderExists
};
