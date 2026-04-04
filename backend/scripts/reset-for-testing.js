const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generatePassword(length = 16) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'audiouser',
  password: process.env.DB_PASSWORD || 'audiopass',
  database: process.env.DB_NAME || 'audiodb',
});

// Clean uploads directory
function cleanUploadsDirectory() {
  const uploadsDir = path.join(__dirname, '../uploads');
  
  console.log('🗑️  Cleaning uploads directory...');
  
  try {
    if (fs.existsSync(uploadsDir)) {
      // Remove all subdirectories and files
      const items = fs.readdirSync(uploadsDir);
      items.forEach(item => {
        const itemPath = path.join(uploadsDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          fs.rmSync(itemPath, { recursive: true, force: true });
        } else if (item !== '.gitkeep') {
          fs.unlinkSync(itemPath);
        }
      });
      console.log('✅ Uploads directory cleaned');
    }
  } catch (error) {
    console.error('❌ Error cleaning uploads directory:', error.message);
  }
}

// Reset database
async function resetDatabase() {
  console.log('🗑️  Deleting all data from database...');
  
  try {
    // Delete in correct order (respecting foreign keys)
    await pool.query('DELETE FROM password_reset_tokens');
    await pool.query('DELETE FROM audio_files');
    await pool.query('DELETE FROM user_folders');
    await pool.query('DELETE FROM folders');
    await pool.query('DELETE FROM users');
    
    console.log('✅ Database cleared');
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    throw error;
  }
}

// Create users and folders
async function createTestData() {
  console.log('\n📝 Creating test data...\n');
  
  try {
    // Generate random passwords
    const superadminPass = generatePassword();
    const adminPass = generatePassword();
    const userPass = generatePassword();
    const superadminPassword = await bcrypt.hash(superadminPass, 10);
    const adminPassword = await bcrypt.hash(adminPass, 10);
    const userPassword = await bcrypt.hash(userPass, 10);
    
    // Create superadmin
    console.log('👤 Creating superadmin...');
    await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
      ['superadmin', 'superadmin@linkopingsnarradio.se', superadminPassword, 'superadmin']
    );
    console.log('   Username: superadmin');
    console.log(`   Password: ${superadminPass}`);
    console.log('   Email: superadmin@linkopingsnarradio.se');
    
    // Create admin
    console.log('\n👤 Creating admin...');
    await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
      ['admin', 'admin@linkopingsnarradio.se', adminPassword, 'admin']
    );
    console.log('   Username: admin');
    console.log(`   Password: ${adminPass}`);
    console.log('   Email: admin@linkopingsnarradio.se');
    
    // Create folders (use normalizeFolderName for disk names)
    const { normalizeFolderName } = require('../src/utils/normalizeFolderName');
    console.log('\n📁 Creating folders...');
    const folderNames = ['Radioprogram Ett', 'Radioprogram Tva', 'Radioprogram Tre'];
    const folders = folderNames.map(name => ({
      original_name: name,
      disk_name: normalizeFolderName(name)
    }));
    for (const folder of folders) {
      await pool.query('INSERT INTO folders (original_name, disk_name) VALUES ($1, $2)', [folder.original_name, folder.disk_name]);
      // Create physical folder
      const folderPath = path.join(__dirname, '../uploads', folder.disk_name);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      console.log(`   ✓ ${folder.original_name} → ${folder.disk_name}`);
    }
    
    // Create regular users
    console.log('\n👥 Creating regular users...');
    
    const users = [
      { name: 'Radioprogram 1', username: 'radioprogram1', folderOriginal: 'Radioprogram Ett' },
      { name: 'Radioprogram 2', username: 'radioprogram2', folderOriginal: 'Radioprogram Tva' },
      { name: 'Radioprogram 3', username: 'radioprogram3', folderOriginal: 'Radioprogram Tre' }
    ];
    
    for (const user of users) {
      const diskName = normalizeFolderName(user.folderOriginal);
      const userResult = await pool.query(
        'INSERT INTO users (username, email, password, role, folder) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [
          user.username,
          `${user.username}@linkopingsnarradio.se`,
          userPassword,
          'user',
          diskName
        ]
      );
      // Also populate user_folders table
      await pool.query(
        'INSERT INTO user_folders (user_id, folder_name) VALUES ($1, $2)',
        [userResult.rows[0].id, diskName]
      );
      console.log(`\n   ${user.name}:`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Password: ${userPass}`);
      console.log(`   Email: ${user.username}@linkopingsnarradio.se`);
      console.log(`   Folder: ${diskName}`);
    }
    
    console.log('\n✅ Test data created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating test data:', error.message);
    throw error;
  }
}

// Main function
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  🧪 Audio Upload App - Test Data Reset');
  console.log('═══════════════════════════════════════════════\n');
  
  try {
    // Clean uploads directory
    cleanUploadsDirectory();
    
    // Reset database
    await resetDatabase();
    
    // Create test data
    await createTestData();
    
    console.log('\n═══════════════════════════════════════════════');
    console.log('  ✅ Reset complete! Ready for testing.');
    console.log('═══════════════════════════════════════════════\n');
    
    console.log('🔐 Login credentials shown above during creation.\n');
    
  } catch (error) {
    console.error('\n❌ Reset failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
