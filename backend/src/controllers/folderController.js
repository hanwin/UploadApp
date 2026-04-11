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
    res.status(500).json({ error: 'Det gick inte att hämta mappar' });
  }
};

// Create folder (admin only)
const { normalizeFolderName } = require('../utils/normalizeFolderName');
const createFolder = async (req, res) => {
  try {
    const { name, defaultMp3Title, defaultMp3Artist, standardTagTitle, standardTagArtist } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Mappnamn krävs' });
    }
    // Validate folder name to prevent path traversal
    const trimmedName = name.trim();
    if (trimmedName.includes('..') || trimmedName.includes('/') || trimmedName.includes('\\')) {
      return res.status(400).json({ error: 'Ogiltigt mappnamn: får inte innehålla .. / eller \\' });
    }
    // Normalisera för disk och DB
    const safeFolderName = normalizeFolderName(trimmedName);
    const uploadsDir = path.join(__dirname, '../../uploads');
    const folderPath = path.join(uploadsDir, safeFolderName);
    // Verify the resolved path is still within uploads directory
    if (!folderPath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: 'Ogiltig mappsökväg' });
    }
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    const incomingTitle = standardTagTitle !== undefined ? standardTagTitle : defaultMp3Title;
    const incomingArtist = standardTagArtist !== undefined ? standardTagArtist : defaultMp3Artist;
    const normalizedTitle = typeof incomingTitle === 'string' ? incomingTitle.trim() : null;
    const normalizedArtist = typeof incomingArtist === 'string' ? incomingArtist.trim() : null;

    // Create database entry (save both original and normalized names)
    const result = await pool.query(
      `INSERT INTO folders (original_name, disk_name, default_mp3_title, default_mp3_artist)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [trimmedName, safeFolderName, normalizedTitle || null, normalizedArtist || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create folder error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Mappen finns redan' });
    }
    res.status(500).json({ error: 'Det gick inte att skapa mappen' });
  }
};

// Update folder metadata (admin only)
const updateFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, defaultMp3Title, defaultMp3Artist, standardTagTitle, standardTagArtist } = req.body;

    const folderResult = await pool.query('SELECT * FROM folders WHERE id = $1', [id]);
    if (folderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mappen hittades inte' });
    }

    const current = folderResult.rows[0];
    const trimmedName = typeof name === 'string' ? name.trim() : current.original_name;
    if (!trimmedName) {
      return res.status(400).json({ error: 'Mappnamn krävs' });
    }

    const incomingTitle = standardTagTitle !== undefined ? standardTagTitle : defaultMp3Title;
    const incomingArtist = standardTagArtist !== undefined ? standardTagArtist : defaultMp3Artist;
    const normalizedTitle = typeof incomingTitle === 'string' ? incomingTitle.trim() : (current.default_mp3_title || null);
    const normalizedArtist = typeof incomingArtist === 'string' ? incomingArtist.trim() : (current.default_mp3_artist || null);

    const result = await pool.query(
      `UPDATE folders
          SET original_name = $1,
              default_mp3_title = $2,
              default_mp3_artist = $3
        WHERE id = $4
      RETURNING *`,
      [trimmedName, normalizedTitle || null, normalizedArtist || null, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Det gick inte att uppdatera mappen' });
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
      return res.status(400).json({ error: 'Det går inte att ta bort en mapp som innehåller filer' });
    }

    // Get folder disk_name
    const folderResult = await pool.query('SELECT disk_name FROM folders WHERE id = $1', [id]);
    if (folderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mappen hittades inte' });
    }

    const folderDiskName = folderResult.rows[0].disk_name;
    // Don't allow deleting Standard folder (normalized)
    if (folderDiskName === normalizeFolderName('Standard')) {
      return res.status(400).json({ error: 'Det går inte att ta bort standardmappen' });
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
    res.status(500).json({ error: 'Det gick inte att ta bort mappen' });
  }
};

module.exports = {
  getAllFolders,
  createFolder,
  updateFolder,
  deleteFolder
};
