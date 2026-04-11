const fs = require('fs');
const path = require('path');
const pool = require('../src/models/db');

function resolveUploadsRoot() {
  const containerUploads = '/app/uploads';
  if (fs.existsSync(containerUploads)) {
    return containerUploads;
  }
  return path.resolve(__dirname, '../uploads');
}

function buildPathCandidates(filePath, uploadsRoot) {
  const candidates = [];
  const normalized = String(filePath || '').trim();
  if (!normalized) {
    return candidates;
  }

  if (path.isAbsolute(normalized)) {
    candidates.push(normalized);

    // Handle paths stored as /app/uploads/... when running outside container.
    if (normalized.startsWith('/app/uploads/')) {
      const suffix = normalized.slice('/app/uploads/'.length);
      candidates.push(path.join(uploadsRoot, suffix));
    }
  } else {
    candidates.push(path.resolve(__dirname, '..', normalized));
    candidates.push(path.join(uploadsRoot, normalized));
  }

  // Also try current process cwd for edge cases.
  candidates.push(path.resolve(process.cwd(), normalized));

  return Array.from(new Set(candidates));
}

function hasExistingFile(filePath, uploadsRoot) {
  const candidates = buildPathCandidates(filePath, uploadsRoot);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return { exists: true, resolvedPath: candidate, candidates };
      }
    } catch (error) {
      // Ignore candidate errors and continue with next.
    }
  }

  return { exists: false, resolvedPath: null, candidates };
}

async function syncDbWithFilesystem() {
  const dryRun = process.argv.includes('--dry-run');
  const uploadsRoot = resolveUploadsRoot();
  console.log(`Uploads root: ${uploadsRoot}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'DELETE MISSING DB ROWS'}`);

  const result = await pool.query(
    'SELECT id, original_name, file_path, folder, uploaded_at FROM audio_files ORDER BY id ASC'
  );

  console.log(`Checked rows: ${result.rows.length}`);

  const missing = [];

  for (const row of result.rows) {
    const fileCheck = hasExistingFile(row.file_path, uploadsRoot);
    if (!fileCheck.exists) {
      missing.push({
        ...row,
        checked_paths: fileCheck.candidates
      });
    }
  }

  if (missing.length === 0) {
    console.log('No missing files found. Database is already in sync.');
    return;
  }

  console.log(`Missing files in filesystem: ${missing.length}`);
  for (const entry of missing) {
    console.log(`- id=${entry.id} folder=${entry.folder || '-'} original_name="${entry.original_name}" file_path="${entry.file_path}"`);
  }

  if (dryRun) {
    console.log('Dry run complete. No rows deleted.');
    return;
  }

  const ids = missing.map(item => item.id);

  await pool.query('BEGIN');
  try {
    const deleteResult = await pool.query(
      'DELETE FROM audio_files WHERE id = ANY($1::int[])',
      [ids]
    );

    await pool.query('COMMIT');
    console.log(`Deleted rows from audio_files: ${deleteResult.rowCount}`);
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  try {
    await syncDbWithFilesystem();
    process.exit(0);
  } catch (error) {
    console.error('Sync failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}
