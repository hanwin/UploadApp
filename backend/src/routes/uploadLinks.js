const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');
const { MAX_UPLOAD_BYTES } = require('../utils/uploadLimits');
const { getCanonicalAudioMimeType } = require('../utils/audioMime');
const {
  createUploadLink,
  getMyUploadLinks,
  getPublicUploadLinkInfo,
  validatePublicUploadToken,
  handlePublicUpload,
  ensurePublicFolderExists
} = require('../controllers/uploadLinkController');

const router = express.Router();

const publicUploadStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const { folderPath } = await ensurePublicFolderExists();
      req.publicUploadFolderPath = folderPath;
      cb(null, folderPath);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8').normalize('NFC');
    const baseName = path.basename(decodedName);

    if (!baseName || baseName === '.' || baseName === '..') {
      const fallback = `${Date.now()}-${Math.round(Math.random() * 1e9)}.mp3`;
      cb(null, fallback);
      return;
    }

    // Avoid collisions by suffixing when needed.
    const uploadsRoot = path.join(__dirname, '../../uploads');
    const publicFolder = req.publicUploadFolderPath || uploadsRoot;
    const safeDestination = publicFolder.startsWith(uploadsRoot) ? publicFolder : uploadsRoot;
    const candidatePath = path.join(safeDestination, baseName);

    if (!fs.existsSync(candidatePath)) {
      cb(null, baseName);
      return;
    }

    const parsed = path.parse(baseName);
    const suffixed = `${parsed.name}-${Date.now()}${parsed.ext}`;
    cb(null, suffixed);
  }
});

const publicUpload = multer({
  storage: publicUploadStorage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const canonicalMimeType = getCanonicalAudioMimeType(decodedName);

    if (!canonicalMimeType) {
      return cb(new Error('Only MP3 and WAV files are allowed'), false);
    }

    return cb(null, true);
  }
});

router.get('/public-info', getPublicUploadLinkInfo);
router.post('/public-upload', validatePublicUploadToken, publicUpload.single('audio'), handlePublicUpload);

router.use(authMiddleware);
router.get('/', getMyUploadLinks);
router.post('/', createUploadLink);

module.exports = router;
