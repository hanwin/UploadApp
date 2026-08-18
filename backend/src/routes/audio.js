const express = require('express');
const {
  uploadAudio,
  getUserAudioFiles,
  getAllAudioFiles,
  getUserFilesById,
  streamAudio,
  deleteAudio,
  updateBroadcastTime,
  cleanupAbortedUpload
} = require('../controllers/audioController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { streamAuthMiddleware } = require('../middleware/streamAuth');
const { upload, setUploadFolderPath } = require('../middleware/upload');

const router = express.Router();

router.post('/upload', authMiddleware, setUploadFolderPath, upload.single('audio'), uploadAudio);
router.get('/my-files', authMiddleware, getUserAudioFiles);
router.get('/all', authMiddleware, adminMiddleware, getAllAudioFiles);
router.get('/user/:userId', authMiddleware, adminMiddleware, getUserFilesById);
router.get('/stream/:id', streamAuthMiddleware, streamAudio); // Use special middleware for streaming
router.delete('/:id', authMiddleware, deleteAudio);
router.put('/:id/broadcast-time', authMiddleware, updateBroadcastTime);
router.post('/cleanup-aborted', authMiddleware, cleanupAbortedUpload);

module.exports = router;
