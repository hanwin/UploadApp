// Robust loggfunktion till fil
function debugLog(msg) {
  try {
    fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' ' + msg + '\n');
  } catch (e) {}
}

const { normalizeFolderName } = require('../utils/normalizeFolderName');
const { getCanonicalAudioMimeType } = require('../utils/audioMime');
const { MAX_UPLOAD_BYTES } = require('../utils/uploadLimits');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../models/db');

// Ensure uploads directory exists (must be before setUploadFolderPath)
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}


async function setUploadFolderPath(req, res, next) {
  debugLog('setUploadFolderPath: start, user=' + (req.user && req.user.id) + ', role=' + (req.user && req.user.role));
  try {
    let folderName;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      folderName = req.query.folder || req.headers['x-folder-name'];
      if (folderName && (folderName.includes('..') || folderName.includes('/') || folderName.includes('\\'))) {
        debugLog('setUploadFolderPath: invalid folderName=' + folderName);
        return res.status(400).json({ error: 'Ogiltigt mappnamn' });
      }
    } else {
      folderName = req.query.folder;
      if (folderName) {
        const accessCheck = await pool.query(
          `SELECT 1
             FROM user_folders uf
             JOIN folders f ON f.disk_name = uf.folder_name
            WHERE uf.user_id = $1 AND uf.folder_name = $2`,
          [req.user.id, folderName]
        );
        if (accessCheck.rows.length === 0) {
          debugLog('setUploadFolderPath: access denied to folderName=' + folderName);
          return res.status(403).json({ error: 'Åtkomst nekad till denna mapp' });
        }
      } else {
        const userFolders = await pool.query(
          `SELECT uf.folder_name
             FROM user_folders uf
             JOIN folders f ON f.disk_name = uf.folder_name
            WHERE uf.user_id = $1
            ORDER BY uf.folder_name
            LIMIT 1`,
          [req.user.id]
        );
        folderName = userFolders.rows[0]?.folder_name;
      }
    }
    if (!folderName) {
      debugLog('setUploadFolderPath: no folder specified');
      return res.status(400).json({ error: 'Ingen mapp angiven' });
    }
    const folderCheck = await pool.query(
      'SELECT disk_name FROM folders WHERE disk_name = $1 LIMIT 1',
      [folderName]
    );
    if (folderCheck.rows.length === 0) {
      debugLog('setUploadFolderPath: unknown folderName=' + folderName);
      return res.status(400).json({ error: 'Mappen finns inte' });
    }

    // Use folder names managed by folders table only.
    const folderPath = path.join(uploadsDir, folderName);
    if (!folderPath.startsWith(uploadsDir)) {
      debugLog('setUploadFolderPath: invalid folderPath=' + folderPath);
      return res.status(400).json({ error: 'Ogiltig mappsökväg' });
    }
    if (!fs.existsSync(folderPath)) {
      debugLog('setUploadFolderPath: folder missing on disk for managed folder=' + folderName);
      return res.status(500).json({ error: 'Mappen finns inte på servern. Skapa den via mapphanteringen.' });
    }
    req.folderPath = folderPath;
    debugLog('setUploadFolderPath: set req.folderPath=' + folderPath);
    next();
  } catch (error) {
    debugLog('setUploadFolderPath: error=' + error);
    console.error('Error determining upload destination:', error);
    res.status(500).json({ error: 'Det gick inte att fastställa uppladdningsmål' });
  }
}


// Synchronous Multer storage: destination only reads req.folderPath
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    debugLog('Multer destination: req.folderPath=' + req.folderPath + ', file.originalname=' + file.originalname);
    if (!req.folderPath) {
      debugLog('Multer destination: MISSING req.folderPath!');
      return cb(new Error('No folderPath set on request'), null);
    }
    cb(null, req.folderPath);
  },
  filename: (req, file, cb) => {
    debugLog('Multer filename: file.originalname=' + file.originalname + ', req.folderPath=' + req.folderPath);
    // Multer sends originalname as latin1; decode to utf-8
    let safeName = Buffer.from(file.originalname, 'latin1').toString('utf8').normalize('NFC');
    safeName = path.basename(safeName);
    debugLog('Multer filename: safeName=' + safeName);
    const destFolder = req.folderPath;
    const fullPath = path.join(destFolder, safeName);
    const allowOverwrite = req.headers['x-overwrite'] === 'true';
    if (fs.existsSync(fullPath) && !allowOverwrite) {
      debugLog('Multer filename: file exists and overwrite not allowed: ' + safeName);
      return cb(new Error('FILE_EXISTS:' + safeName), null);
    }
    if (!safeName || safeName === '' || safeName === '.' || safeName === '..') {
      const fallback = Date.now() + '-' + Math.round(Math.random() * 1e9) + '.mp3';
      debugLog('Multer filename: safeName invalid, fallback=' + fallback);
      return cb(null, fallback);
    }
    cb(null, safeName);
  }
});

// File filter to accept only audio files
const fileFilter = (req, file, cb) => {
  const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
  const canonicalMimeType = getCanonicalAudioMimeType(decodedName);

  if (canonicalMimeType) {
    cb(null, true);
  } else {
    debugLog('fileFilter rejected: mimetype=' + file.mimetype + ', originalname=' + decodedName);
    cb(new Error('Only MP3 and WAV files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_BYTES
  },
  preservePath: false
});

module.exports = { upload, setUploadFolderPath };
