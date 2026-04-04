const pool = require('../models/db');
const bcrypt = require('bcryptjs');

// Get all users (superadmin only)
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, username, name, email, role, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);

    // Get folders for all users in one query
    const foldersResult = await pool.query(
      'SELECT user_id, folder_name FROM user_folders ORDER BY folder_name'
    );
    const foldersByUser = {};
    for (const row of foldersResult.rows) {
      if (!foldersByUser[row.user_id]) foldersByUser[row.user_id] = [];
      foldersByUser[row.user_id].push(row.folder_name);
    }

    const users = result.rows.map(u => ({
      ...u,
      name: u.name || '',
      folders: foldersByUser[u.id] || []
    }));

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
};

// Create user (superadmin only)
const createUser = async (req, res) => {
  try {
    const { username, name, email, password, role, folders } = req.body;

    // Validation
    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Username: no spaces allowed
    if (/\s/.test(username)) {
      return res.status(400).json({ error: 'Användarnamn får inte innehålla mellanslag' });
    }

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be user or admin' });
    }

    if (password.length < 12) {
      return res.status(400).json({ error: 'Lösenordet måste vara minst 12 tecken långt' });
    }

    // Check if username (case-insensitive) or email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Användarnamn eller e-post finns redan' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Folders are required (accept both 'folders' array and legacy 'folder' string)
    const folderList = folders || (req.body.folder ? [req.body.folder] : []);
    if (folderList.length === 0) {
      return res.status(400).json({ error: 'At least one folder is required' });
    }

    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, name, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, name, email, role, created_at',
      [username, name || '', email, hashedPassword, role]
    );

    const newUser = result.rows[0];

    // Insert folder assignments (always normalized)
    const { normalizeFolderName } = require('../utils/normalizeFolderName');
    for (const folderName of folderList) {
      const safeFolderName = normalizeFolderName(folderName);
      await pool.query(
        'INSERT INTO user_folders (user_id, folder_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newUser.id, safeFolderName]
      );
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(201).json({
      message: 'User created successfully',
      user: { ...newUser, name: newUser.name || '', folders: folderList }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
};

// Delete user (superadmin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await pool.query('SELECT role FROM users WHERE id = $1', [id]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting superadmin users
    if (user.rows[0].role === 'superadmin') {
      return res.status(403).json({ error: 'Cannot delete superadmin users' });
    }

    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error deleting user' });
  }
};

// Update user role (superadmin only)
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, folders, name } = req.body;

    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be user or admin' });
    }

    // Check if user exists
    const user = await pool.query('SELECT role FROM users WHERE id = $1', [id]);

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent changing superadmin role
    if (user.rows[0].role === 'superadmin') {
      return res.status(403).json({ error: 'Cannot change superadmin role' });
    }

    // Build dynamic update query for user table
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (role) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (updates.length > 0) {
      values.push(id);
      const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, name, email, role, created_at`;
      await pool.query(query, values);
    }

    // Update folders if provided (accept both 'folders' array and legacy 'folder' string)
    const folderList = folders || (req.body.folder !== undefined ? [req.body.folder] : null);
    if (folderList !== null) {
      // Replace all folder assignments
      await pool.query('DELETE FROM user_folders WHERE user_id = $1', [id]);
      const { normalizeFolderName } = require('../utils/normalizeFolderName');
      for (const folderName of folderList) {
        if (folderName) {
          const safeFolderName = normalizeFolderName(folderName);
          await pool.query(
            'INSERT INTO user_folders (user_id, folder_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, safeFolderName]
          );
        }
      }
    }

    // Fetch updated user with folders
    const updatedUser = await pool.query(
      'SELECT id, username, name, email, role, created_at FROM users WHERE id = $1',
      [id]
    );
    const updatedFolders = await pool.query(
      'SELECT folder_name FROM user_folders WHERE user_id = $1 ORDER BY folder_name',
      [id]
    );

    res.json({
      message: 'User updated successfully',
      user: {
        ...updatedUser.rows[0],
        name: updatedUser.rows[0].name || '',
        folders: updatedFolders.rows.map(r => r.folder_name)
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
};

// Update own profile (email and/or password)
const updateOwnProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, currentPassword, newPassword } = req.body;

    // Get current user
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Update email if provided
    if (email) {
      // Check if email already exists for another user
      const existingEmail = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: 'E-postadressen används redan' });
      }
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Nuvarande lösenord krävs för att byta lösenord' });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password);
      if (!isValid) {
        return res.status(401).json({ error: 'Felaktigt nuvarande lösenord' });
      }

      if (newPassword.length < 12) {
        return res.status(400).json({ error: 'Lösenordet måste vara minst 12 tecken långt' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updates.push(`password = $${paramCount++}`);
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Inga ändringar att spara' });
    }

    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, name, email, role`;
    const result = await pool.query(query, values);

    // Get folders for updated user
    const foldersResult = await pool.query(
      'SELECT folder_name FROM user_folders WHERE user_id = $1 ORDER BY folder_name',
      [userId]
    );

    res.json({
      message: 'Profilen uppdaterad',
      user: {
        ...result.rows[0],
        folders: foldersResult.rows.map(r => r.folder_name)
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Error updating profile' });
  }
};

// Update user profile (superadmin only - can update any user)
const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, password, name } = req.body;

    // Check user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Update name if provided
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    // Update email if provided
    if (email) {
      // Check if email already exists for another user
      const existingEmail = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      if (existingEmail.rows.length > 0) {
        return res.status(400).json({ error: 'E-postadressen används redan' });
      }
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    // Update password if provided
    if (password) {
      if (password.length < 12) {
        return res.status(400).json({ error: 'Lösenordet måste vara minst 12 tecken långt' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password = $${paramCount++}`);
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Inga ändringar att spara' });
    }

    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, name, email, role`;
    const result = await pool.query(query, values);

    // Get folders for updated user
    const foldersResult = await pool.query(
      'SELECT folder_name FROM user_folders WHERE user_id = $1 ORDER BY folder_name',
      [userId]
    );

    res.json({
      message: 'Användaren uppdaterad',
      user: {
        ...result.rows[0],
        folders: foldersResult.rows.map(r => r.folder_name)
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Error updating user profile' });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  deleteUser,
  updateUserRole,
  updateOwnProfile,
  updateUserProfile
};
