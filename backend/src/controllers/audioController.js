
const pool = require('../models/db');
const path = require('path');
const fs = require('fs');
const { processAudioInBackground } = require('../services/audioProcessor');

// Upload audio file
const uploadAudio = async (req, res) => {
  try {
    fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: called, user=' + (req.user && req.user.id) + ', role=' + (req.user && req.user.role) + '\n');
    if (!req.file) {
      fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: no file in req.file\n');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: file received, originalname=' + req.file.originalname + ', filename=' + req.file.filename + ', mimetype=' + req.file.mimetype + ', size=' + req.file.size + '\n');

    const { filename, originalname, size, mimetype, path: filePath } = req.file;
    const shouldProcess = req.body.processAudio === 'true'; // Check if processing requested
    const deleteOriginal = req.body.deleteOriginal === 'true'; // Check if original should be deleted
    
    // Admin can choose folder, regular users use their assigned folders
    let folder;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: admin/superadmin upload, query.folder=' + req.query.folder + ', body.folder=' + req.body.folder + '\n');
      // Folder comes from query parameter (since req.body is not reliably populated by multer at this point)
      folder = req.query.folder || req.body.folder;
      if (!folder) {
        fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: missing folder for admin/superadmin\n');
        return res.status(400).json({ error: 'Folder is required' });
      }
    } else {
      fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: user upload, query.folder=' + req.query.folder + '\n');
      // Get user's assigned folders from user_folders table
      folder = req.query.folder;
      if (folder) {
        // Validate user has access to this folder
        const accessCheck = await pool.query(
          'SELECT 1 FROM user_folders WHERE user_id = $1 AND folder_name = $2',
          [req.user.id, folder]
        );
        if (accessCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied to this folder' });
        }
      } else {
        // Use first assigned folder
        const userFolders = await pool.query(
          'SELECT folder_name FROM user_folders WHERE user_id = $1 ORDER BY folder_name LIMIT 1',
          [req.user.id]
        );
        folder = userFolders.rows[0]?.folder_name;
      }
      if (!folder) {
        fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: no folder assigned to user\n');
        return res.status(400).json({ error: 'No folder assigned to user' });
      }
      fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: saving file info to DB, folder=' + folder + ', filePath=' + filePath + '\n');
    }
    
    // Decode originalname from latin1 to utf-8 (multer encoding) and normalize
    const decodedOriginalName = Buffer.from(originalname, 'latin1').toString('utf8').normalize('NFC');

    // Use folder name as-is (matches disk_name in folders table)
    const dbFolder = folder;

    // Determine initial processing status
    const processingStatus = shouldProcess && mimetype === 'audio/wav' ? 'pending' : 'none';

    // Determine which user should own this file
    let effectiveUserId;
    
    if (req.query.impersonatedUserId) {
      // Impersonating - use impersonated user ID
      effectiveUserId = req.query.impersonatedUserId;
    } else if ((req.user.role === 'superadmin' || req.user.role === 'admin') && folder) {
      // Admin/Superadmin uploading to a user's folder - find the folder owner
      const folderOwnerResult = await pool.query(
        'SELECT id FROM users WHERE folder = $1 LIMIT 1',
        [folder]
      );
      
      if (folderOwnerResult.rows.length > 0) {
        // Use folder owner's ID
        effectiveUserId = folderOwnerResult.rows[0].id;
      } else {
        // No user found for this folder, use admin's ID
        effectiveUserId = req.user.id;
      }
    } else {
      // Regular upload - use actual user
      effectiveUserId = req.user.id;
    }

    // Save file info to database (med normaliserade sökvägar)
    const result = await pool.query(
      `INSERT INTO audio_files (user_id, filename, original_name, file_path, file_size, mime_type, folder, processing_status, delete_original_on_success)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [effectiveUserId, filename, decodedOriginalName, filePath, size, mimetype, dbFolder, processingStatus, deleteOriginal]
    );

    const fileId = result.rows[0].id;

    // If processing requested and file is WAV, start background processing
    if (shouldProcess && mimetype === 'audio/wav') {
      console.log(`Starting background processing for file ${fileId}`);
      processAudioInBackground(fileId);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(201).json({
      message: 'File uploaded successfully',
      file: result.rows[0]
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error uploading file' });
  }
}

// Get user's audio files
const getUserAudioFiles = async (req, res) => {
  try {
    // Get user's assigned folders
    const userFolders = await pool.query(
      'SELECT folder_name FROM user_folders WHERE user_id = $1 ORDER BY folder_name',
      [req.user.id]
    );
    const folderNames = userFolders.rows.map(r => r.folder_name);
    
    if (folderNames.length === 0) {
      return res.json([]); // Return empty array if no folders assigned
    }
    
    // Return files from all user's assigned folders
    const result = await pool.query(
      'SELECT * FROM audio_files WHERE user_id = $1 AND folder = ANY($2) ORDER BY uploaded_at DESC',
      [req.user.id, folderNames]
    );

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching files' });
  }
};

// Get all audio files (admin only)
const getAllAudioFiles = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT af.*, u.username, u.email
      FROM audio_files af
      JOIN users u ON af.user_id = u.id
      ORDER BY af.uploaded_at DESC
    `);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching files' });
  }
};

// Get audio files for a specific user (admin only)
const getUserFilesById = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get user's assigned folders
    const userFolders = await pool.query(
      'SELECT folder_name FROM user_folders WHERE user_id = $1 ORDER BY folder_name',
      [userId]
    );
    const folderNames = userFolders.rows.map(r => r.folder_name);
    
    if (folderNames.length === 0) {
      return res.json([]); // Return empty array if no folders assigned
    }
    
    // Return files from user's assigned folders
    const result = await pool.query(
      'SELECT af.*, u.username, u.email FROM audio_files af JOIN users u ON af.user_id = u.id WHERE af.user_id = $1 AND af.folder = ANY($2) ORDER BY af.uploaded_at DESC',
      [userId, folderNames]
    );

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching files' });
  }
};

// Stream audio file
const streamAudio = async (req, res) => {
  try {
    const fileId = req.params.id;

    // Get file info from database
    const result = await pool.query('SELECT * FROM audio_files WHERE id = $1', [fileId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Check if user owns the file or is admin
    if (file.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    const stat = fs.statSync(file.file_path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Parse Range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      // Create read stream with range
      const fileStream = fs.createReadStream(file.file_path, { start, end });

      // Set headers for partial content
      const encodedFilename = encodeURIComponent(file.original_name);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': file.mime_type,
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFilename}`
      });

      fileStream.pipe(res);
    } else {
      // No range request, send entire file
      const encodedFilename = encodeURIComponent(file.original_name);
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': file.mime_type,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFilename}`
      });

      const fileStream = fs.createReadStream(file.file_path);
      fileStream.pipe(res);
    }
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Error streaming file' });
  }
};

// Delete audio file
const deleteAudio = async (req, res) => {
  try {
    const fileId = req.params.id;

    // Get file info
    const result = await pool.query('SELECT * FROM audio_files WHERE id = $1', [fileId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Check if user owns the file or is admin
    if (file.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete file from filesystem (try both file_path and folder+filename, but never remove folder)
    let deleted = false;
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
      deleted = true;
    }
    if (!deleted) {
      // Try to construct path from folder and filename
      const altPath = file.folder
        ? path.join('/app/uploads', file.folder, file.filename)
        : path.join('/app/uploads', file.filename);
      if (fs.existsSync(altPath)) {
        fs.unlinkSync(altPath);
        deleted = true;
      }
    }

    // Delete from database
    await pool.query('DELETE FROM audio_files WHERE id = $1', [fileId]);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Error deleting file' });
  }
};

// Update broadcast time for a file
const updateBroadcastTime = async (req, res) => {
  try {
    const fileId = req.params.id;
    const { broadcastTime } = req.body;

    // Get file info
    const fileResult = await pool.query('SELECT * FROM audio_files WHERE id = $1', [fileId]);
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];

    // Check if user owns the file or is admin
    if (file.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update broadcast time (null to clear schedule)
    const result = await pool.query(
      'UPDATE audio_files SET broadcast_time = $1 WHERE id = $2 RETURNING *',
      [broadcastTime || null, fileId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update broadcast time error:', error);
    res.status(500).json({ error: 'Error updating broadcast time' });
  }
};

module.exports = {
  uploadAudio,
  getUserAudioFiles,
  getAllAudioFiles,
  getUserFilesById,
  streamAudio,
  deleteAudio,
  updateBroadcastTime
};
module.exports = {
  uploadAudio,
  getUserAudioFiles,
  getAllAudioFiles,
  getUserFilesById,
  streamAudio,
  deleteAudio,
  updateBroadcastTime
};
