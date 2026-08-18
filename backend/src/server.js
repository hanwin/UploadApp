const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const pool = require('./models/db');
const { ensureTables, ensureSuperadmin } = require('./models/initDb');
const authRoutes = require('./routes/auth');
const audioRoutes = require('./routes/audio');
const userRoutes = require('./routes/users');
const folderRoutes = require('./routes/folders');
const settingsRoutes = require('./routes/settings');
const adminToolsRoutes = require('./routes/adminTools');
const uploadLinksRoutes = require('./routes/uploadLinks');
const mp3TagsRoutes = require('./routes/mp3tags');
const { startDbFileSyncCron } = require('./services/dbFileSyncCronService');
const { startScheduleChecker } = require('./services/scheduleService');
const { ensureLegacyTemplate, getUploadsRoot, hasUploadHook } = require('./services/folderHooks');
const { writeCurrentSeq } = require('./utils/currentSeq');
const { getDefaultSeqPathTemplate } = require('./controllers/settingsController');
const logsRoutes = require('./routes/logs');
const { csrfProtectionMiddleware } = require('./middleware/csrf');

const app = express();
const httpServer = createServer(app);
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:81')
  .split(',')
  .map(s => s.trim());

app.set('trust proxy', 1);
app.disable('x-powered-by');

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// Make io accessible in routes and globally
app.set('io', io);
global.io = io;

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));
app.use(express.json({ charset: 'utf-8', limit: '2gb' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8', limit: '2gb' }));

// Set default charset for responses
app.use((req, res, next) => {
  res.charset = 'utf-8';
  next();
});

app.use('/api', csrfProtectionMiddleware);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/users', userRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin-tools', adminToolsRoutes);
app.use('/api/upload-links', uploadLinksRoutes);
app.use('/api/mp3tags', mp3TagsRoutes);
app.use('/api/logs', logsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Filen får max vara 4GB' });
  }
  
  if (err.message === 'Only MP3 and WAV files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.message && err.message.startsWith('FILE_EXISTS:')) {
    const filename = err.message.split(':')[1];
    return res.status(409).json({ error: err.message, filename });
  }

  if (err.code === 'CP1252_ENCODING_ERROR') {
    return res.status(422).json({
      error: err.userMessage || 'Filnamn eller sökväg innehåller tecken som inte stöds av CP1252.',
      details: err.message
    });
  }
  
  res.status(500).json({ error: 'Något gick fel!' });
});

// Test database connection before starting server
pool.query('SELECT NOW()')
  .then(async () => {
    console.log('✓ Database connected');
    
    // Ensure all tables exist and superadmin is created
    await ensureTables();
    await ensureSuperadmin();
    const folders = await pool.query('SELECT disk_name FROM folders');
    await Promise.all(folders.rows.map(async ({ disk_name: folderName }) => {
      if (!(await hasUploadHook(folderName))) {
        await ensureLegacyTemplate(folderName);
        const folderPath = path.join(getUploadsRoot(), folderName);
        const sequencePath = path.join(folderPath, `${folderName}-seq.seq`);
        if (!fs.existsSync(sequencePath)) {
          const fileResult = await pool.query(
            `SELECT original_name, filename, duration FROM audio_files
             WHERE folder = $1 ORDER BY uploaded_at DESC, id DESC LIMIT 1`,
            [folderName]
          );
          const file = fileResult.rows[0];
          if (file) {
            writeCurrentSeq(
              folderPath,
              file.original_name || file.filename,
              file.duration,
              { defaultSeqPath: await getDefaultSeqPathTemplate() }
            );
          }
        }
      }
    }));
    httpServer.listen(PORT, () => {
      // Disable request timeout for large file uploads (Node.js 18 default is 300s)
      httpServer.requestTimeout = 0;
      httpServer.headersTimeout = 120000; // 2 minutes for headers
      httpServer.timeout = 0; // No socket inactivity timeout

      console.log(`✓ Server running on port ${PORT}`);
      console.log('✓ WebSocket server ready');
      
      // Start DB/filesystem sync cron
      startDbFileSyncCron();
      startScheduleChecker();
    });
  })
  .catch((err) => {
    console.error('✗ Database connection failed:', err.message);
    console.error('Please ensure PostgreSQL is running and credentials are correct');
    process.exit(1);
  });

module.exports = { io };
