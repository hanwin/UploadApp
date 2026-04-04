const pool = require('../models/db');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Check for scheduled files and write to scheduled.seq in each folder
const checkScheduledFiles = async () => {
  try {
    const now = new Date();
    
    // Find files scheduled for now or in the past that haven't been processed yet
    const result = await pool.query(
      `SELECT id, original_name, file_path, broadcast_time, folder
       FROM audio_files 
       WHERE broadcast_time <= $1 
       AND broadcast_time IS NOT NULL
       ORDER BY broadcast_time ASC`,
      [now]
    );

    if (result.rows.length > 0) {
      // Group files by folder
      const filesByFolder = {};
      result.rows.forEach(file => {
        if (!filesByFolder[file.folder]) {
          filesByFolder[file.folder] = [];
        }
        filesByFolder[file.folder].push(file);
      });

      // Write to scheduled.seq in each folder
      const { normalizeFolderName } = require('../utils/normalizeFolderName');
      for (const [folder, files] of Object.entries(filesByFolder)) {
        const safeFolder = normalizeFolderName(folder);
        const folderPath = path.join(UPLOADS_DIR, safeFolder);
        const scheduledFile = path.join(folderPath, 'scheduled.seq');

        // Ensure folder exists
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }

        // Prepare lines for this folder
        const lines = files.map(file => {
          const timestamp = new Date(file.broadcast_time).toISOString();
          return `${timestamp}|${file.original_name}|${file.file_path}`;
        }).join('\n') + '\n';

        // Append to folder's scheduled.seq
        fs.appendFileSync(scheduledFile, lines);
        
        console.log(`✓ Wrote ${files.length} scheduled file(s) to ${folder}/scheduled.seq`);
      }
      
      // Clear broadcast_time for processed files
      const fileIds = result.rows.map(f => f.id);
      await pool.query(
        'UPDATE audio_files SET broadcast_time = NULL WHERE id = ANY($1)',
        [fileIds]
      );

      // Emit WebSocket event for UI update
      const io = global.io || require('../server').io;
      if (io) {
        io.emit('scheduledFilesProcessed', { count: result.rows.length });
      }
    }
  } catch (error) {
    console.error('Error checking scheduled files:', error);
  }
};

// Start scheduled file checker (runs every minute)
const startScheduleChecker = () => {
  // Ensure uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('✓ Created uploads directory');
  }

  // Run immediately
  checkScheduledFiles();
  
  // Then run every minute
  setInterval(checkScheduledFiles, 60 * 1000);
  
  console.log('✓ Schedule checker started (checking every minute)');
};

module.exports = {
  startScheduleChecker,
  checkScheduledFiles
};
