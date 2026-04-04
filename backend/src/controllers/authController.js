const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../models/db');
const { sendPasswordResetEmail } = require('../services/emailService');

// Register new user
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Username: no spaces allowed
    if (/\s/.test(username)) {
      return res.status(400).json({ error: 'Användarnamn får inte innehålla mellanslag' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, hashedPassword, 'user']
    );

    res.status(201).json({ 
      message: 'User registered successfully',
      user: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get user by username (case-insensitive) OR email
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR email = $1', 
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user's folders
    const foldersResult = await pool.query(
      'SELECT folder_name FROM user_folders WHERE user_id = $1 ORDER BY folder_name',
      [user.id]
    );
    const folders = foldersResult.rows.map(r => r.folder_name);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name || '',
        email: user.email,
        role: user.role,
        folders
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const foldersResult = await pool.query(
      'SELECT folder_name FROM user_folders WHERE user_id = $1 ORDER BY folder_name',
      [result.rows[0].id]
    );
    const user = {
      ...result.rows[0],
      name: result.rows[0].name || '',
      folders: foldersResult.rows.map(r => r.folder_name)
    };

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Forgot password - send reset email
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'E-postadress krävs' });
    }

    // Check if user exists
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'Om e-postadressen finns i systemet har vi skickat återställningsinstruktioner' });
    }

    const user = result.rows[0];

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Delete any existing tokens for this user
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    // Save hashed token to database
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashedToken, expiresAt]
    );

    // Send email with plain token
    await sendPasswordResetEmail(email, resetToken);

    res.json({ message: 'Om e-postadressen finns i systemet har vi skickat återställningsinstruktioner' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Ett fel uppstod. Försök igen senare.' });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token och nytt lösenord krävs' });
    }

    if (password.length < 12) {
      return res.status(400).json({ error: 'Lösenordet måste vara minst 12 tecken långt' });
    }

    // Hash the provided token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid token
    const tokenResult = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()',
      [hashedToken]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Ogiltig eller utgången återställningslänk' });
    }

    const resetToken = tokenResult.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, resetToken.user_id]
    );

    // Delete used token
    await pool.query('DELETE FROM password_reset_tokens WHERE id = $1', [resetToken.id]);

    // Clean up expired tokens
    await pool.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');

    res.json({ message: 'Lösenordet har återställts. Du kan nu logga in med ditt nya lösenord.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Ett fel uppstod. Försök igen senare.' });
  }
};

module.exports = { register, login, getProfile, forgotPassword, resetPassword };
