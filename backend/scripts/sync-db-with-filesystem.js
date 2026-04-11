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

async function syncDbWithFilesystem(options = {}) {
  const dryRun = options.dryRun === true;
  const logPrefix = options.logPrefix ? `${options.logPrefix} ` : '';
  const uploadsRoot = resolveUploadsRoot();
  console.log(`${logPrefix}Uploads root: ${uploadsRoot}`);
  console.log(`${logPrefix}Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'DELETE MISSING DB ROWS AND DUPLICATES'}`);

  const result = await pool.query(
    'SELECT id, original_name, file_path, folder, uploaded_at FROM audio_files ORDER BY uploaded_at ASC'
  );

  console.log(`${logPrefix}Checked rows: ${result.rows.length}`);

  const missing = [];
  const duplicates = [];

  // Step 1: Find missing files and identify duplicates
  const filePathGroups = {};
  for (const row of result.rows) {
    const fileCheck = hasExistingFile(row.file_path, uploadsRoot);
    if (!fileCheck.exists) {
      missing.push({
        ...row,
        checked_paths: fileCheck.candidates
      });
    } else {
      // Group by file_path to find duplicates
      if (!filePathGroups[row.file_path]) {
        filePathGroups[row.file_path] = [];
      }
      filePathGroups[row.file_path].push(row);
    }
  }

  // Step 2: Find duplicate file_paths (multiple DB rows pointing to same file)
  for (const filePath in filePathGroups) {
    const group = filePathGroups[filePath];
    if (group.length > 1) {
      // Keep the latest (last in sorted array), remove all others
      const latest = group[group.length - 1];
      for (let i = 0; i < group.length - 1; i++) {
        duplicates.push(group[i]);
      }
    }
  }

  // Report findings
  console.log(`${logPrefix}Missing files: ${missing.length}`);
  console.log(`${logPrefix}Duplicate DB rows: ${duplicates.length}`);

  if (missing.length === 0 && duplicates.length === 0) {
    console.log(`${logPrefix}No issues found. Database is already in sync.`);
    return;
  }

  if (missing.length > 0) {
    console.log(`${logPrefix}Missing in filesystem:`);
    for (const entry of missing) {
      console.log(`${logPrefix}  - id=${entry.id} folder="${entry.folder || '-'}" original_name="${entry.original_name}"`);
    }
  }

  if (duplicates.length > 0) {
    console.log(`${logPrefix}Duplicate DB rows (keeping latest):`);
    for (const entry of duplicates) {
      console.log(`${logPrefix}  - id=${entry.id} uploaded_at=${entry.uploaded_at} file_path="${entry.file_path}"`);
    }
  }

  if (dryRun) {
    console.log(`${logPrefix}Dry run complete. No rows deleted.`);
    return;
  }

  const idsToDelete = [...missing, ...duplicates].map(item => item.id);

  if (idsToDelete.length === 0) {
    console.log(`${logPrefix}Nothing to delete.`);
    return;
  }

  await pool.query('BEGIN');
  try {
    const deleteResult = await pool.query(
      'DELETE FROM audio_files WHERE id = ANY($1::int[])',
      [idsToDelete]
    );

    await pool.query('COMMIT');
    console.log(`${logPrefix}Deleted ${deleteResult.rowCount} rows from audio_files (${missing.length} missing + ${duplicates.length} duplicates)`);
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  try {
    await syncDbWithFilesystem({ dryRun: process.argv.includes('--dry-run') });
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

module.exports = {
  syncDbWithFilesystem
};
