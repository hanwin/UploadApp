const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MAX_UPLOAD_BYTES } = require('../utils/uploadLimits');

// Loggfunktion
function debugLog(msg) {
  try {
    fs.appendFileSync(path.join(__dirname, '../../uploads/upload-debug.log'), new Date().toISOString() + ' ' + msg + '\n');
  } catch (e) {}
}

// Middleware: Sätt req.folderPath och kontrollera rättigheter
const { normalizeFolderName } = require('../utils/normalizeFolderName');
async function setUploadFolderPath(req, res, next) {
  try {
    let folderName;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      folderName = req.query.folder || req.headers['x-folder-name'];
      if (folderName && (folderName.includes('..') || folderName.includes('/') || folderName.includes('\\'))) {
        debugLog('Invalid folder name: ' + folderName);
        return res.status(400).json({ error: 'Ogiltigt mappnamn' });
      }
    } else {
      folderName = req.query.folder;
      if (!folderName) {
        debugLog('No folder specified for user');
        return res.status(400).json({ error: 'Ingen mapp angiven' });
      }
    }
    // Spara originalnamn för GUI/databas
    const originalFolderName = folderName;
    // Normalisera för disk med gemensam util
    let safeFolderName = normalizeFolderName(folderName);
    const uploadsDir = path.join(__dirname, '../../uploads');
    const folderPath = path.join(uploadsDir, safeFolderName);
    if (!folderPath.startsWith(uploadsDir)) {
      debugLog('Invalid folder path: ' + folderPath);
      return res.status(400).json({ error: 'Ogiltig mappsökväg' });
    }
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      debugLog('Created folderPath: ' + folderPath);
    }
    req.folderPath = folderPath;
    debugLog('Set req.folderPath: ' + folderPath);
    next();
  } catch (error) {
    debugLog('Error in setUploadFolderPath: ' + error);
    res.status(500).json({ error: 'Det gick inte att fastställa uppladdningsmål' });
  }
}

// Multer storage: alltid originalnamn
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    debugLog('Multer destination: ' + req.folderPath);
    cb(null, req.folderPath);
  },
  filename: (req, file, cb) => {
    debugLog('Multer filename: ' + file.originalname);
    cb(null, file.originalname);
  }
});

// Endast MP3/WAV
function fileFilter(req, file, cb) {
  const allowedMimeTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav'];
  const allowedExtensions = ['.mp3', '.wav'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    debugLog('File rejected: ' + file.originalname + ', mimetype=' + file.mimetype);
    cb(new Error('Only MP3 and WAV files are allowed'), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  preservePath: false
});

module.exports = { upload, setUploadFolderPath };
