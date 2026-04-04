// Migration script to backfill original_name for folders
// Run this with: node scripts/migrate-folder-original-names.js

const pool = require('../src/models/db');

async function migrate() {
  try {
    // Set original_name to disk_name where original_name is NULL
    const result = await pool.query(
      `UPDATE folders SET original_name = disk_name WHERE original_name IS NULL`
    );
    console.log(`Updated ${result.rowCount} folders.`);
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
