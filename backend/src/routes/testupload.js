const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { getCanonicalAudioMimeType } = require('../utils/audioMime');

const router = express.Router();

// Minimal Multer storage med loggning
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '../../uploads/test');
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.appendFileSync(path.join(__dirname, '../../uploads/upload-debug.log'), new Date().toISOString() + ' TEST destination körs\n');
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    fs.appendFileSync(path.join(__dirname, '../../uploads/upload-debug.log'), new Date().toISOString() + ' TEST filename: ' + file.originalname + '\n');
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const canonicalMimeType = getCanonicalAudioMimeType(decodedName);
    if (!canonicalMimeType) {
      return cb(new Error('Only MP3 and WAV files are allowed'), false);
    }
    return cb(null, true);
  }
});

router.post('/test-upload', authMiddleware, adminMiddleware, upload.single('audio'), (req, res) => {
  fs.appendFileSync(path.join(__dirname, '../../uploads/upload-debug.log'), new Date().toISOString() + ' TEST route handler, file=' + (req.file && req.file.filename) + '\n');
  res.json({
    message: 'Test upload route hit',
    file: req.file
  });
});

module.exports = router;
