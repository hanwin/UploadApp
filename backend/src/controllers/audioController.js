const pool = require('../models/db');
const path = require('path');
const fs = require('fs');
const { processAudioInBackground } = require('../services/audioProcessor');
const { getCanonicalAudioMimeType } = require('../utils/audioMime');
const { writeTags } = require('../services/mp3Tags');
const { logActivity, getClientIp } = require('../utils/activityLogger');
const {
  archiveAndRunDeleteHook,
  archiveFile,
  hasUploadHook,
  restoreArchivedFile,
  runUploadHook
} = require('../services/folderHooks');
const { getAudioDurationSeconds } = require('../utils/audioDuration');
const { writeCurrentSeq, removeSeqReferenceForFile, clearCurrentSeqFile } = require('../utils/currentSeq');
const { getDefaultSeqPathTemplate } = require('./settingsController');

const applyTagTemplate = (template, context) => {
  if (!template || typeof template !== 'string') {
    return '';
  }

  return template
    .replace(/\{filename\}/gi, context.filename || '')
    .replace(/\{folder\}/gi, context.folder || '')
    .trim();
};

// Upload audio file
const uploadAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ingen fil uppladdad' });
    }

    const { filename, originalname, size, path: filePath } = req.file;
    const shouldProcess = req.body.processAudio === 'true'; // Check if processing requested
    const deleteOriginal = req.body.deleteOriginal === 'true'; // Check if original should be deleted
    
    // Admin can choose folder, regular users use their assigned folders
    let folder;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      // Folder comes from query parameter (since req.body is not reliably populated by multer at this point)
      folder = req.query.folder || req.body.folder;
      if (!folder) {
        return res.status(400).json({ error: 'Mapp krävs' });
      }
    } else {
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
        return res.status(400).json({ error: 'Ingen mapp tilldelad till användaren' });
      }
    }

    const folderCheck = await pool.query(
      'SELECT original_name, disk_name, default_mp3_title, default_mp3_artist FROM folders WHERE disk_name = $1 LIMIT 1',
      [folder]
    );
    if (folderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mappen finns inte' });
    }
    const folderMeta = folderCheck.rows[0];
    
    // Decode originalname from latin1 to utf-8 (multer encoding) and normalize
    const decodedOriginalName = Buffer.from(originalname, 'latin1').toString('utf8').normalize('NFC');
    const canonicalMimeType = getCanonicalAudioMimeType(decodedOriginalName) || getCanonicalAudioMimeType(filename);

    if (!canonicalMimeType) {
      return res.status(400).json({ error: 'Filtypen stöds inte' });
    }

    // Use folder name as-is (matches disk_name in folders table)
    const dbFolder = folder;

    // Determine initial processing status
    const isWavProcessing = shouldProcess && canonicalMimeType === 'audio/wav';
    const processingStatus = isWavProcessing ? 'pending' : 'none';

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

    // Auto-populate MP3 tags: title = filename (without extension), artist = full folder name.
    if (canonicalMimeType === 'audio/mpeg') {
      const fullFolderName = folderMeta.original_name || folderMeta.disk_name || dbFolder;
      const fileBaseName = path.parse(decodedOriginalName).name;

      const configuredTitle = applyTagTemplate(folderMeta.default_mp3_title, {
        filename: fileBaseName,
        folder: fullFolderName
      });
      const configuredArtist = applyTagTemplate(folderMeta.default_mp3_artist, {
        filename: fileBaseName,
        folder: fullFolderName
      });

      const resolvedTitle = configuredTitle || fileBaseName;
      const resolvedArtist = configuredArtist || fullFolderName;

      const tagWriteResult = await writeTags(filePath, {
        title: resolvedTitle,
        artist: resolvedArtist
      });

      if (!tagWriteResult.success) {
        console.error('Auto MP3 tag write failed:', tagWriteResult.error);
      }
    }

    const usesHook = await hasUploadHook(dbFolder);
    let uploadHook;
    if (!isWavProcessing && usesHook) {
      try {
        uploadHook = await runUploadHook({
          folderName: dbFolder,
          fileId,
          filename,
          originalName: decodedOriginalName,
          activePath: filePath,
          userId: req.user.id
        });
      } catch (hookError) {
        let archived;
        try {
          archived = await archiveFile({
            folderName: dbFolder,
            activePath: filePath,
            filename
          });
          await pool.query('DELETE FROM audio_files WHERE id = $1', [fileId]);
        } catch (rollbackError) {
          if (archived) {
            try {
              await restoreArchivedFile(archived);
            } catch (restoreError) {
              rollbackError.restoreError = restoreError.message;
            }
          }
          console.error('Failed to roll back upload after hook failure:', rollbackError);
        }

        await logActivity({
          eventType: 'upload_hook_failure',
          userId: req.user?.id,
          username: req.user?.username,
          ipAddress: getClientIp(req),
          details: {
            file_id: fileId,
            filename: decodedOriginalName,
            folder: dbFolder,
            error: hookError.message,
            archived_path: archived?.archivePath || null
          }
        });
        return res.status(500).json({ error: 'Uppladdningen återställdes eftersom upload.sh misslyckades' });
      }
    }

    if (!isWavProcessing && !usesHook) {
      try {
        const duration = await getAudioDurationSeconds(filePath);
        const defaultSeqPath = await getDefaultSeqPathTemplate();
        writeCurrentSeq(path.dirname(filePath), decodedOriginalName, duration, { defaultSeqPath });
      } catch (seqError) {
        if (seqError.code === 'CP1252_ENCODING_ERROR') throw seqError;
        console.error('Failed to write legacy seq:', seqError);
      }
    }

    // If processing requested and file is WAV, start background processing
    if (isWavProcessing) {
      console.log(`Starting background processing for file ${fileId}`);
      processAudioInBackground(fileId);
    }

    await logActivity({
      eventType: 'upload_success',
      userId: req.user?.id,
      username: req.user?.username,
      ipAddress: getClientIp(req),
      details: {
        filename: req.file?.originalname,
        stored_filename: req.file?.filename,
        folder: dbFolder,
        file_size: req.file?.size,
        mime_type: canonicalMimeType,
        hook_deferred_for_processing: isWavProcessing,
        legacy_seq_flow: !usesHook,
        hook_stdout: uploadHook?.stdout || null,
        hook_stderr: uploadHook?.stderr || null
      }
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(201).json({
      message: 'Fil uppladdad',
      file: result.rows[0]
    });
  } catch (error) {
    console.error('Upload error:', error);
    await logActivity({ eventType: 'upload_failure', userId: req.user?.id, username: req.user?.username, ipAddress: getClientIp(req), details: { filename: req.file?.originalname, folder: req.body?.folder, error: error.message } });
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
    
    // Return all files in user's assigned folders (regardless of uploader)
    const result = await pool.query(
      'SELECT * FROM audio_files WHERE folder = ANY($1) ORDER BY uploaded_at DESC',
      [folderNames]
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

    // Check access: owner, admin/superadmin, or user assigned to the file's folder.
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const isOwner = file.user_id === req.user.id;
    let hasFolderAccess = false;

    if (!isAdmin && !isOwner && file.folder) {
      const folderAccessResult = await pool.query(
        'SELECT 1 FROM user_folders WHERE user_id = $1 AND folder_name = $2 LIMIT 1',
        [req.user.id, file.folder]
      );
      hasFolderAccess = folderAccessResult.rows.length > 0;
    }

    if (!isAdmin && !isOwner && !hasFolderAccess) {
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

    const streamFile = (fileStream, statusCode, headers) => {
      let cleanedUp = false;

      const cleanup = () => {
        if (cleanedUp) {
          return;
        }
        cleanedUp = true;
        fileStream.destroy();
      };

      fileStream.on('error', (streamError) => {
        console.error('Audio stream error:', streamError);
        cleanup();
        if (!res.headersSent) {
          res.status(500).json({ error: 'Det gick inte att strömma filen' });
        } else {
          res.destroy(streamError);
        }
      });

      res.on('close', cleanup);
      res.on('finish', cleanup);
      req.on('aborted', cleanup);

      res.writeHead(statusCode, headers);
      fileStream.pipe(res);
    };

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
      streamFile(fileStream, 206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': streamMimeType,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFilename}`
      });
    } else {
      // No range request, send entire file
      const encodedFilename = encodeURIComponent(file.original_name);
      const fileStream = fs.createReadStream(file.file_path);
      streamFile(fileStream, 200, {
        'Content-Length': fileSize,
        'Content-Type': streamMimeType,
        'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `inline; filename*=UTF-8''${encodedFilename}`
      });
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

    // Check access: owner, admin/superadmin, or user assigned to the file's folder.
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
    const isOwner = file.user_id === req.user.id;
    let hasFolderAccess = false;

    if (!isAdmin && !isOwner && file.folder) {
      const folderAccessResult = await pool.query(
        'SELECT 1 FROM user_folders WHERE user_id = $1 AND folder_name = $2 LIMIT 1',
        [req.user.id, file.folder]
      );
      hasFolderAccess = folderAccessResult.rows.length > 0;
    }

    if (!isAdmin && !isOwner && !hasFolderAccess) {
      return res.status(403).json({ error: 'Åtkomst nekad' });
    }

    if (!file.folder) {
      return res.status(400).json({ error: 'Filen saknar en giltig mapp för arkivering' });
    }

    const usesHook = await hasUploadHook(file.folder);
    const archived = usesHook
      ? await archiveAndRunDeleteHook({
        folderName: file.folder,
        fileId: file.id,
        filename: file.filename,
        originalName: file.original_name,
        activePath: file.file_path,
        userId: req.user.id
      })
      : await archiveFile({
        folderName: file.folder,
        activePath: file.file_path,
        filename: file.filename
      });

    try {
      await pool.query('DELETE FROM audio_files WHERE id = $1', [fileId]);
    } catch (databaseError) {
      try {
        await restoreArchivedFile(archived);
      } catch (restoreError) {
        databaseError.restoreError = restoreError.message;
      }

      throw databaseError;
    }

    try {
      const folderPath = path.dirname(file.file_path);
      const seqChanged = removeSeqReferenceForFile(folderPath, file.original_name || file.filename);
      if (!usesHook && seqChanged) {
        const fallback = await pool.query(
          `SELECT original_name, filename, duration FROM audio_files
           WHERE folder IS NOT DISTINCT FROM $1 ORDER BY uploaded_at DESC, id DESC LIMIT 1`,
          [file.folder]
        );
        if (fallback.rows[0]) {
          writeCurrentSeq(
            folderPath,
            fallback.rows[0].original_name || fallback.rows[0].filename,
            fallback.rows[0].duration,
            { defaultSeqPath: await getDefaultSeqPathTemplate() }
          );
        } else {
          clearCurrentSeqFile(folderPath);
        }
      }
    } catch (seqError) {
      console.error('Failed to update seq after archive:', seqError);
    }

    await logActivity({
      eventType: 'file_archived',
      userId: req.user?.id,
      username: req.user?.username,
      ipAddress: getClientIp(req),
      details: {
        file_id: file.id,
        filename: file.filename,
        original_name: file.original_name,
        folder: file.folder,
        archive_path: archived.archivePath,
        hook_stdout: archived.hook?.stdout || null,
        hook_stderr: archived.hook?.stderr || null,
        legacy_seq_flow: !usesHook
      }
    });
    res.json({ message: 'Filen har arkiverats' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Det gick inte att arkivera filen' });
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
      const archived = await archiveFile({
        folderName: folder,
        activePath: targetPath,
        filename: safeFilename
      });
      return res.json({ cleaned: true, archivePath: archived.archivePath });
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
