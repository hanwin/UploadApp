const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'audiodb',
  user: process.env.DB_USER || 'audiouser',
  password: process.env.DB_PASSWORD || 'audiopass',
  // Ensure UTF-8 encoding
  client_encoding: 'UTF8'
});

// Test connection
pool.on('connect', () => {
  console.log('✓ Database connected');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
