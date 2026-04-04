const pool = require('../models/db');
const fs = require('fs');
const path = require('path');

// Get all folders
const getAllFolders = async (req, res) => {
  try {
    // Order by original_name for user display
    const result = await pool.query('SELECT * FROM folders ORDER BY original_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ error: 'Error fetching folders' });
  }
};

// Create folder (admin only)
const { normalizeFolderName } = require('../utils/normalizeFolderName');
const createFolder = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    // Validate folder name to prevent path traversal
    const trimmedName = name.trim();
    if (trimmedName.includes('..') || trimmedName.includes('/') || trimmedName.includes('\\')) {
      return res.status(400).json({ error: 'Invalid folder name: cannot contain .. / or \\' });
    }
    // Normalisera för disk och DB
    const safeFolderName = normalizeFolderName(trimmedName);
    const uploadsDir = path.join(__dirname, '../../uploads');
    const folderPath = path.join(uploadsDir, safeFolderName);
    // Verify the resolved path is still within uploads directory
    if (!folderPath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: 'Invalid folder path' });
    }
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    // Create database entry (save both original and normalized names)
    const result = await pool.query(
      'INSERT INTO folders (original_name, disk_name) VALUES ($1, $2) RETURNING *',
      [trimmedName, safeFolderName]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create folder error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Folder already exists' });
    }
    res.status(500).json({ error: 'Error creating folder' });
  }
};

// Delete folder (admin only)
const deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if folder has files
    const filesResult = await pool.query(
      'SELECT COUNT(*) FROM audio_files af JOIN folders f ON af.folder = f.disk_name WHERE f.id = $1',
      [id]
    );

    if (parseInt(filesResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete folder with files' });
    }

    // Get folder disk_name
    const folderResult = await pool.query('SELECT disk_name FROM folders WHERE id = $1', [id]);
    if (folderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const folderDiskName = folderResult.rows[0].disk_name;
    // Don't allow deleting Standard folder (normalized)
    if (folderDiskName === normalizeFolderName('Standard')) {
      return res.status(400).json({ error: 'Cannot delete Standard folder' });
    }
    // Delete from database
    await pool.query('DELETE FROM folders WHERE id = $1', [id]);
    // Delete physical folder if exists
    const uploadsDir = path.join(__dirname, '../../uploads');
    const folderPath = path.join(uploadsDir, folderDiskName);
    if (fs.existsSync(folderPath)) {
      // Only remove if empty
      if (fs.readdirSync(folderPath).length === 0) {
        fs.rmdirSync(folderPath);
      }
    }
    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Error deleting folder' });
  }
};

module.exports = {
  getAllFolders,
  createFolder,
  deleteFolder
};
