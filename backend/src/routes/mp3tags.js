
const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const { authMiddleware } = require('../middleware/auth');
const mp3Tags = require('../services/mp3Tags');
const path = require('path');


/**
 * GET /api/mp3tags/:fileId
 * Read MP3 tags from a file
 */
router.get('/:fileId', authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get file info from database
    const fileQuery = await pool.query(
      'SELECT * FROM audio_files WHERE id = $1',
      [fileId]
    );

    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];

    // Check permissions
    if (userRole !== 'admin' && userRole !== 'superadmin' && file.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file is MP3
    if (!file.filename.toLowerCase().endsWith('.mp3')) {
      return res.status(400).json({ error: 'File is not an MP3' });
    }

    // Build full file path including folder
    const filePath = file.folder 
      ? path.join('/app/uploads', file.folder, file.filename)
      : path.join('/app/uploads', file.filename);
    const result = await mp3Tags.readTags(filePath);

    if (result.success) {
      res.json({
        fileId: file.id,
        filename: file.original_name,
        tags: result.tags
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error reading MP3 tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/mp3tags/:fileId
 * Write MP3 tags to a file
 */
router.put('/:fileId', authMiddleware, async (req, res) => {
      // Log incoming request body for debugging
      console.log('MP3TAG PUT BODY', {
        fileId: req.params.fileId,
        body: req.body
      });
  try {
    const { fileId } = req.params;
    console.log('MP3TAG REQUEST', {
      method: req.method,
      fileId,
      body: req.body
    });
    const userId = req.user.id;
    const userRole = req.user.role;
    const tags = req.body;

    // Get file info from database
    const fileQuery = await pool.query(
      'SELECT * FROM audio_files WHERE id = $1',
      [fileId]
    );

    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];

    // Check permissions
    if (userRole !== 'admin' && userRole !== 'superadmin' && file.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file is MP3
    if (!file.filename.toLowerCase().endsWith('.mp3')) {
      return res.status(400).json({ error: 'File is not an MP3' });
    }

    // Build full file path including folder
    const filePath = file.folder 
      ? path.join('/app/uploads', file.folder, file.filename)
      : path.join('/app/uploads', file.filename);
    console.log('MP3 TAGS DEBUG:', {
      filePath,
      tags
    });
    const result = await mp3Tags.writeTags(filePath, tags);

    if (result.success) {
      res.json({
        message: 'Tags updated successfully',
        fileId: file.id
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error writing MP3 tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/mp3tags/:fileId
 * Remove all MP3 tags from a file
 */
router.delete('/:fileId', authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get file info from database
    const fileQuery = await pool.query(
      'SELECT * FROM audio_files WHERE id = $1',
      [fileId]
    );

    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];

    // Check permissions
    if (userRole !== 'admin' && userRole !== 'superadmin' && file.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file is MP3
    if (!file.filename.toLowerCase().endsWith('.mp3')) {
      return res.status(400).json({ error: 'File is not an MP3' });
    }

    // Build full file path including folder
    const filePath = file.folder 
      ? path.join('/app/uploads', file.folder, file.filename)
      : path.join('/app/uploads', file.filename);
    const result = await mp3Tags.removeTags(filePath);

    if (result.success) {
      res.json({
        message: 'Tags removed successfully',
        fileId: file.id
      });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error removing MP3 tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
