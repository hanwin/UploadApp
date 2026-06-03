const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { getLogs } = require('../controllers/logsController');

router.get('/', authMiddleware, adminMiddleware, getLogs);

module.exports = router;
