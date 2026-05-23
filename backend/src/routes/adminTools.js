const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { syncStorage } = require('../controllers/settingsController');

router.use(authMiddleware, adminMiddleware);
router.post('/sync-storage', syncStorage);

module.exports = router;
