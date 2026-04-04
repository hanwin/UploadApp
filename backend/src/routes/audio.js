const express = require('express');
const {
  uploadAudio,
  getUserAudioFiles,
  getAllAudioFiles,
  getUserFilesById,
  streamAudio,
  deleteAudio,
  updateBroadcastTime
} = require('../controllers/audioController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { streamAuthMiddleware } = require('../middleware/streamAuth');
const { upload, setUploadFolderPath } = require('../middleware/upload');

const router = express.Router();

router.post('/upload', (req, res, next) => {
  const fs = require('fs');
  try {
    fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' ROUTE /api/audio/upload HIT!\n');
    fs.appendFileSync('/app/uploads/upload-debug.log', '  Method: ' + req.method + ', Content-Type: ' + req.get('content-type') + '\n');
    fs.appendFileSync('/app/uploads/upload-debug.log', '  req.files: ' + JSON.stringify(req.files) + ', req.file: ' + JSON.stringify(req.file) + '\n');
    fs.appendFileSync('/app/uploads/upload-debug.log', '  req.body keys: ' + Object.keys(req.body).join(', ') + '\n');
  } catch (e) {}
  next();
}, authMiddleware, setUploadFolderPath, upload.single('audio'), uploadAudio);
router.get('/my-files', authMiddleware, getUserAudioFiles);
router.get('/all', authMiddleware, adminMiddleware, getAllAudioFiles);
router.get('/user/:userId', authMiddleware, adminMiddleware, getUserFilesById);
router.get('/stream/:id', streamAuthMiddleware, streamAudio); // Use special middleware for streaming
router.delete('/:id', authMiddleware, deleteAudio);
router.put('/:id/broadcast-time', authMiddleware, updateBroadcastTime);

module.exports = router;
