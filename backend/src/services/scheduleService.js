const fs = require('fs');
const path = require('path');
const pool = require('../models/db');
const { encodeCp1252Strict } = require('../utils/cp1252');
const { hasUploadHook } = require('./folderHooks');

async function checkScheduledFiles() {
  const result = await pool.query(
    `SELECT id, original_name, file_path, broadcast_time, folder FROM audio_files
     WHERE broadcast_time <= $1 AND broadcast_time IS NOT NULL ORDER BY broadcast_time ASC`,
    [new Date()]
  );
  const legacyFiles = [];
  for (const file of result.rows) {
    if (file.folder && !(await hasUploadHook(file.folder))) legacyFiles.push(file);
  }
  const byFolder = new Map();
  for (const file of legacyFiles) {
    const files = byFolder.get(file.folder) || [];
    files.push(file);
    byFolder.set(file.folder, files);
  }
  for (const [folder, files] of byFolder) {
    const folderPath = path.join(fs.existsSync('/app/uploads') ? '/app/uploads' : path.resolve(__dirname, '../../uploads'), folder);
    const scheduledPath = path.join(folderPath, 'scheduled.seq');
    const content = `${files.map((file) => `${new Date(file.broadcast_time).toISOString()}|${file.original_name}|${file.file_path}`).join('\n')}\n`;
    fs.appendFileSync(scheduledPath, encodeCp1252Strict(content, scheduledPath));
  }
  if (legacyFiles.length) {
    await pool.query('UPDATE audio_files SET broadcast_time = NULL WHERE id = ANY($1)', [legacyFiles.map((file) => file.id)]);
    global.io?.emit('scheduledFilesProcessed', { count: legacyFiles.length });
  }
}

function startScheduleChecker() {
  checkScheduledFiles().catch((error) => console.error('Legacy schedule check failed:', error));
  setInterval(() => checkScheduledFiles().catch((error) => console.error('Legacy schedule check failed:', error)), 60_000);
}

module.exports = { startScheduleChecker, checkScheduledFiles };
