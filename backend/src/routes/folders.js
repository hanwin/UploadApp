const express = require('express');
const router = express.Router();
const { getAllFolders, createFolder, deleteFolder } = require('../controllers/folderController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get all folders (any authenticated user)
router.get('/', getAllFolders);

// Create folder (admin only)
router.post('/', adminMiddleware, createFolder);

// Delete folder (admin only)
router.delete('/:id', adminMiddleware, deleteFolder);

module.exports = router;
