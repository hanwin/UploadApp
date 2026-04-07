const pool = require('./db');
const { validatePassword } = require('../utils/passwordValidator');

// Ensure all tables exist (idempotent, safe to call on every startup)
const ensureTables = async () => {
  // Create users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'user')),
      folder VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create folders table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS folders (
      id SERIAL PRIMARY KEY,
      original_name VARCHAR(255) NOT NULL,
      disk_name VARCHAR(255) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create password_reset_tokens table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create user_folders junction table (many-to-many: users <-> folders)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_folders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      folder_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, folder_name)
    )
  `);

  // Add name column if it doesn't exist
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)
  `);

  // Migrate existing data from users.folder to user_folders (idempotent)
  await pool.query(`
    INSERT INTO user_folders (user_id, folder_name)
    SELECT id, folder FROM users WHERE folder IS NOT NULL AND folder != ''
    ON CONFLICT (user_id, folder_name) DO NOTHING
  `);

  // Create audio_files table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audio_files (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      file_size BIGINT NOT NULL,
      mime_type VARCHAR(50) NOT NULL,
      duration FLOAT,
      folder VARCHAR(255),
      broadcast_time TIMESTAMP,
      processing_status VARCHAR(50) DEFAULT 'pending',
      delete_original_on_success BOOLEAN DEFAULT false,
      is_processed_version BOOLEAN DEFAULT false,
      processed_file_id INTEGER REFERENCES audio_files(id) ON DELETE SET NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE audio_files
    ALTER COLUMN file_size TYPE BIGINT
    USING file_size::BIGINT
  `);

  console.log('✓ Database tables created successfully');
};

// Create default superadmin if ADMIN_PASSWORD is set and user doesn't exist yet
const ensureSuperadmin = async () => {
  const bcrypt = require('bcryptjs');
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.log('⚠ No ADMIN_PASSWORD environment variable set. Skipping superadmin creation.');
    return;
  }
  const passwordError = validatePassword(adminPassword);
  if (passwordError) {
    console.log(`⚠ ADMIN_PASSWORD does not meet complexity requirements: ${passwordError} Skipping superadmin creation.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  try {
    await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
      ['superadmin', 'superadmin@example.com', hashedPassword, 'superadmin']
    );
    console.log('✓ Default superadmin user created (username: superadmin)');
    console.log('⚠ Change the password immediately after first login!');
  } catch (err) {
    if (err.code === '23505') {
      console.log('✓ Superadmin user already exists');
    } else {
      throw err;
    }
  }
};

// Full init (standalone script): create tables + seed superadmin, then exit
const initDb = async () => {
  try {
    await ensureTables();
    await ensureSuperadmin();
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  initDb();
}

module.exports = { ensureTables, ensureSuperadmin };
