const express = require('express');
const router = express.Router();
const { authMiddleware, superadminMiddleware } = require('../middleware/auth');
const { getSettings, updateSettings, syncStorage } = require('../controllers/settingsController');

router.use(authMiddleware, superadminMiddleware);

router.get('/', getSettings);
router.put('/', updateSettings);
router.post('/sync-storage', syncStorage);

module.exports = router;
