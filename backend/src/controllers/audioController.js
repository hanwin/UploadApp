
const pool = require('../models/db');
const path = require('path');
const fs = require('fs');
const { processAudioInBackground } = require('../services/audioProcessor');
const { getCanonicalAudioMimeType } = require('../utils/audioMime');
const { writeTags } = require('../services/mp3Tags');

// Upload audio file
const uploadAudio = async (req, res) => {
  try {
    fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: called, user=' + (req.user && req.user.id) + ', role=' + (req.user && req.user.role) + '\n');
    if (!req.file) {
      fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: no file in req.file\n');
      return res.status(400).json({ error: 'Ingen fil uppladdad' });
    }

    fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: file received, originalname=' + req.file.originalname + ', filename=' + req.file.filename + ', mimetype=' + req.file.mimetype + ', size=' + req.file.size + '\n');

    const { filename, originalname, size, path: filePath } = req.file;
    const overwriteRequested = req.headers['x-overwrite'] === 'true';
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
        return res.status(400).json({ error: 'Mapp krävs' });
      }
    } else {
      fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: user upload, query.folder=' + req.query.folder + '\n');
      // Get user's assigned folders from user_folders table
      folder = req.query.folder;
      if (folder) {
        const folderExists = await pool.query(
          'SELECT 1 FROM folders WHERE disk_name = $1 LIMIT 1',
          [folder]
        );
        if (folderExists.rows.length === 0) {
          return res.status(404).json({ error: 'Mappen finns inte' });
        }

        // Validate user has access to this folder
        const accessCheck = await pool.query(
          'SELECT 1 FROM user_folders WHERE user_id = $1 AND folder_name = $2',
          [req.user.id, folder]
        );
        if (accessCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Åtkomst nekad till denna mapp' });
        }
      } else {
        // Use first assigned folder
        const userFolders = await pool.query(
          `SELECT uf.folder_name
             FROM user_folders uf
             JOIN folders f ON f.disk_name = uf.folder_name
            WHERE uf.user_id = $1
            ORDER BY uf.folder_name
            LIMIT 1`,
          [req.user.id]
        );
        folder = userFolders.rows[0]?.folder_name;
      }
      if (!folder) {
        fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: no folder assigned to user\n');
        return res.status(400).json({ error: 'Ingen mapp tilldelad till användaren' });
      }
      fs.appendFileSync('/app/uploads/upload-debug.log', new Date().toISOString() + ' uploadAudio: saving file info to DB, folder=' + folder + ', filePath=' + filePath + '\n');
    }

    const folderCheck = await pool.query(
      'SELECT 1 FROM folders WHERE disk_name = $1 LIMIT 1',
      [folder]
    );
    if (folderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mappen finns inte' });
    }
    
    // Decode originalname from latin1 to utf-8 (multer encoding) and normalize
    const decodedOriginalName = Buffer.from(originalname, 'latin1').toString('utf8').normalize('NFC');
    const canonicalMimeType = getCanonicalAudioMimeType(decodedOriginalName) || getCanonicalAudioMimeType(filename);

    if (!canonicalMimeType) {
      return res.status(400).json({ error: 'Filtypen stöds inte' });
    }

    // Use folder name as-is (matches disk_name in folders table)
    const dbFolder = folder;

    // Determine initial processing status
    const processingStatus = shouldProcess && canonicalMimeType === 'audio/wav' ? 'pending' : 'none';

    // Determine which user should own this file
    let effectiveUserId;

    if (req.query.impersonatedUserId) {
      if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Endast administratörer kan utföra uppladdningar som annan användare' });
      }

      const impersonatedUserId = Number.parseInt(req.query.impersonatedUserId, 10);
      if (!Number.isInteger(impersonatedUserId) || impersonatedUserId <= 0) {
        return res.status(400).json({ error: 'Ogiltigt användar-ID' });
      }

      const impersonatedUserResult = await pool.query(
        'SELECT id FROM users WHERE id = $1 LIMIT 1',
        [impersonatedUserId]
      );

      if (impersonatedUserResult.rows.length === 0) {
        return res.status(404).json({ error: 'Användaren hittades inte' });
      }

      effectiveUserId = impersonatedUserId;
    } else if ((req.user.role === 'superadmin' || req.user.role === 'admin') && folder) {
      // Admin/Superadmin uploading to a managed folder - find one assigned owner
      const folderOwnerResult = await pool.query(
        'SELECT user_id FROM user_folders WHERE folder_name = $1 ORDER BY user_id ASC LIMIT 1',
        [folder]
      );

      if (folderOwnerResult.rows.length > 0) {
        effectiveUserId = folderOwnerResult.rows[0].user_id;
      } else {
        // No user assigned to this folder, keep the file under the admin's ownership
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
      [effectiveUserId, filename, decodedOriginalName, filePath, size, canonicalMimeType, dbFolder, processingStatus, deleteOriginal]
    );

    const fileId = result.rows[0].id;

    // If this upload overwrote an existing file on disk, remove stale DB rows for the same path.
    if (overwriteRequested) {
      await pool.query(
        'DELETE FROM audio_files WHERE id <> $1 AND file_path = $2',
        [fileId, filePath]
      );
    }

    // Auto-populate MP3 tags: title = filename (without extension), artist = full folder name.
    if (canonicalMimeType === 'audio/mpeg') {
      const folderNameResult = await pool.query(
        'SELECT original_name, disk_name FROM folders WHERE disk_name = $1 LIMIT 1',
        [dbFolder]
      );
      const fullFolderName = folderNameResult.rows[0]?.original_name || folderNameResult.rows[0]?.disk_name || dbFolder;
      const defaultTitle = path.parse(decodedOriginalName).name;

      const tagWriteResult = await writeTags(filePath, {
        title: defaultTitle,
        artist: fullFolderName
      });

      if (!tagWriteResult.success) {
        console.error('Auto MP3 tag write failed:', tagWriteResult.error);
      }
    }

    // If processing requested and file is WAV, start background processing
    if (shouldProcess && canonicalMimeType === 'audio/wav') {
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
    res.status(500).json({ error: 'Det gick inte att ladda upp filen' });
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
    res.status(500).json({ error: 'Det gick inte att hämta filer' });
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
    res.status(500).json({ error: 'Det gick inte att hämta filer' });
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
    res.status(500).json({ error: 'Det gick inte att hämta filer' });
  }
};

// Stream audio file
const streamAudio = async (req, res) => {
  try {
    const fileId = req.params.id;

    // Get file info from database
    const result = await pool.query('SELECT * FROM audio_files WHERE id = $1', [fileId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Filen hittades inte' });
    }

    const file = result.rows[0];

    // Check if user owns the file or is admin
    if (file.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Åtkomst nekad' });
    }

    // Check if file exists
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'Filen hittades inte på servern' });
    }

    const stat = fs.statSync(file.file_path);
    const fileSize = stat.size;
    const range = req.headers.range;
    const streamMimeType = getCanonicalAudioMimeType(file.original_name) || getCanonicalAudioMimeType(file.filename) || 'application/octet-stream';

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
        'Content-Type': streamMimeType,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFilename}`
      });

      fileStream.pipe(res);
    } else {
      // No range request, send entire file
      const encodedFilename = encodeURIComponent(file.original_name);
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': streamMimeType,
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFilename}`
      });

      const fileStream = fs.createReadStream(file.file_path);
      fileStream.pipe(res);
    }
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Det gick inte att strömma filen' });
  }
};

// Delete audio file
const deleteAudio = async (req, res) => {
  try {
    const fileId = req.params.id;

    // Get file info
    const result = await pool.query('SELECT * FROM audio_files WHERE id = $1', [fileId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Filen hittades inte' });
    }

    const file = result.rows[0];

    // Check if user owns the file or is admin
    if (file.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Åtkomst nekad' });
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
    res.status(500).json({ error: 'Det gick inte att ta bort filen' });
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
      return res.status(404).json({ error: 'Filen hittades inte' });
    }

    const file = fileResult.rows[0];

    // Check if user owns the file or is admin
    if (file.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Åtkomst nekad' });
    }

    // Update broadcast time (null to clear schedule)
    const result = await pool.query(
      'UPDATE audio_files SET broadcast_time = $1 WHERE id = $2 RETURNING *',
      [broadcastTime || null, fileId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update broadcast time error:', error);
    res.status(500).json({ error: 'Det gick inte att uppdatera sändningstiden' });
  }
};

// Cleanup partially uploaded file after client abort
const cleanupAbortedUpload = async (req, res) => {
  try {
    const { folder, filename } = req.body || {};

    if (!folder || !filename) {
      return res.status(400).json({ error: 'Mapp och filnamn krävs' });
    }

    if (typeof folder !== 'string' || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Ogiltiga parametrar' });
    }

    if (folder.includes('..') || folder.includes('/') || folder.includes('\\')) {
      return res.status(400).json({ error: 'Ogiltigt mappnamn' });
    }

    const safeFilename = path.basename(filename);
    if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
      return res.status(400).json({ error: 'Ogiltigt filnamn' });
    }

    const folderCheck = await pool.query(
      'SELECT 1 FROM folders WHERE disk_name = $1 LIMIT 1',
      [folder]
    );
    if (folderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mappen finns inte' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const accessCheck = await pool.query(
        'SELECT 1 FROM user_folders WHERE user_id = $1 AND folder_name = $2 LIMIT 1',
        [req.user.id, folder]
      );
      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Åtkomst nekad till denna mapp' });
      }
    }

    const targetPath = path.join('/app/uploads', folder, safeFilename);

    // Never remove files that are referenced by a DB row.
    const dbRef = await pool.query(
      'SELECT 1 FROM audio_files WHERE file_path = $1 LIMIT 1',
      [targetPath]
    );

    if (dbRef.rows.length > 0) {
      return res.json({ cleaned: false, reason: 'db-reference-exists' });
    }

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return res.json({ cleaned: true });
    }

    return res.json({ cleaned: false, reason: 'file-not-found' });
  } catch (error) {
    console.error('Cleanup aborted upload error:', error);
    return res.status(500).json({ error: 'Det gick inte att rensa avbruten uppladdning' });
  }
};

module.exports = {
  uploadAudio,
  getUserAudioFiles,
  getAllAudioFiles,
  getUserFilesById,
  streamAudio,
  deleteAudio,
  updateBroadcastTime,
  cleanupAbortedUpload
};
