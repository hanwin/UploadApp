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

function getDiskFolders(uploadsRoot) {
  if (!fs.existsSync(uploadsRoot)) {
    return [];
  }

  const entries = fs.readdirSync(uploadsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'sv'));
}

async function syncDbWithFilesystem(options = {}) {
  const dryRun = options.dryRun === true;
  const logPrefix = options.logPrefix ? `${options.logPrefix} ` : '';
  const uploadsRoot = resolveUploadsRoot();
  console.log(`${logPrefix}Uploads root: ${uploadsRoot}`);
  console.log(`${logPrefix}Mode: ${dryRun ? 'DRY RUN (no database changes)' : 'SYNC FILES + FOLDERS'}`);

  const summary = {
    checkedRows: 0,
    missingFiles: 0,
    duplicateFileRows: 0,
    deletedFileRows: 0,
    diskFolders: 0,
    dbFolders: 0,
    insertedFolders: 0,
    deletedFolders: 0,
    skippedFolderDeletes: 0,
    deletedOrphanUserFolders: 0,
    missingFolderNames: [],
    insertedFolderNames: [],
    deletedFolderNames: [],
    skippedFolderDeleteNames: []
  };

  const result = await pool.query(
    'SELECT id, original_name, file_path, folder, uploaded_at FROM audio_files ORDER BY uploaded_at ASC'
  );

  summary.checkedRows = result.rows.length;
  console.log(`${logPrefix}Checked rows: ${summary.checkedRows}`);

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
  summary.missingFiles = missing.length;
  summary.duplicateFileRows = duplicates.length;
  console.log(`${logPrefix}Missing files: ${summary.missingFiles}`);
  console.log(`${logPrefix}Duplicate DB rows: ${summary.duplicateFileRows}`);

  if (missing.length === 0 && duplicates.length === 0) {
    console.log(`${logPrefix}No file issues found. Continuing with folder sync.`);
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
    console.log(`${logPrefix}Dry run file sync complete. No file rows deleted.`);
  } else {
    const idsToDelete = [...missing, ...duplicates].map(item => item.id);

    if (idsToDelete.length === 0) {
      console.log(`${logPrefix}No file rows to delete.`);
    } else {
      await pool.query('BEGIN');
      try {
        const deleteResult = await pool.query(
          'DELETE FROM audio_files WHERE id = ANY($1::int[])',
          [idsToDelete]
        );

        await pool.query('COMMIT');
        summary.deletedFileRows = deleteResult.rowCount;
        console.log(`${logPrefix}Deleted ${deleteResult.rowCount} rows from audio_files (${missing.length} missing + ${duplicates.length} duplicates)`);
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
      }
    }
  }

  // Folder synchronization: make DB folder list match disk folders.
  const diskFolderNames = getDiskFolders(uploadsRoot);
  const dbFoldersResult = await pool.query(
    'SELECT id, original_name, disk_name FROM folders ORDER BY id ASC'
  );

  const dbFolders = dbFoldersResult.rows;
  const dbFolderByDiskName = new Map(dbFolders.map((folder) => [folder.disk_name, folder]));
  const diskFolderSet = new Set(diskFolderNames);

  summary.diskFolders = diskFolderNames.length;
  summary.dbFolders = dbFolders.length;

  const missingFoldersInDb = diskFolderNames.filter((folderName) => !dbFolderByDiskName.has(folderName));
  const missingFoldersOnDisk = dbFolders.filter((folder) => !diskFolderSet.has(folder.disk_name));

  if (missingFoldersInDb.length > 0) {
    console.log(`${logPrefix}Folders on disk but missing in DB: ${missingFoldersInDb.length}`);
    for (const folderName of missingFoldersInDb) {
      console.log(`${logPrefix}  + ${folderName}`);
    }
  }

  if (missingFoldersOnDisk.length > 0) {
    console.log(`${logPrefix}Folders in DB but missing on disk: ${missingFoldersOnDisk.length}`);
    for (const folder of missingFoldersOnDisk) {
      console.log(`${logPrefix}  - ${folder.disk_name}`);
    }
  }

  summary.missingFolderNames = missingFoldersOnDisk.map((folder) => folder.disk_name);
  summary.insertedFolderNames = missingFoldersInDb;

  if (!dryRun) {
    await pool.query('BEGIN');
    try {
      for (const folderName of missingFoldersInDb) {
        await pool.query(
          `INSERT INTO folders (original_name, disk_name, default_mp3_title, default_mp3_artist, default_seq_path)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (disk_name) DO NOTHING`,
          [folderName, folderName, null, null, null]
        );
        summary.insertedFolders += 1;
      }

      for (const folder of missingFoldersOnDisk) {
        const fileRefs = await pool.query(
          'SELECT COUNT(*)::int AS count FROM audio_files WHERE folder = $1',
          [folder.disk_name]
        );
        const references = fileRefs.rows[0]?.count || 0;

        if (references > 0) {
          summary.skippedFolderDeletes += 1;
          summary.skippedFolderDeleteNames.push(folder.disk_name);
          continue;
        }

        const orphanDeleteResult = await pool.query(
          'DELETE FROM user_folders WHERE folder_name = $1',
          [folder.disk_name]
        );
        summary.deletedOrphanUserFolders += orphanDeleteResult.rowCount;

        await pool.query(
          'UPDATE users SET folder = NULL WHERE folder = $1',
          [folder.disk_name]
        );

        const deletedFolderResult = await pool.query(
          'DELETE FROM folders WHERE id = $1',
          [folder.id]
        );

        if (deletedFolderResult.rowCount > 0) {
          summary.deletedFolders += 1;
          summary.deletedFolderNames.push(folder.disk_name);
        }
      }

      // Cleanup stale user-folder relations regardless of source.
      const orphanLinksResult = await pool.query(
        `DELETE FROM user_folders uf
         WHERE NOT EXISTS (
           SELECT 1 FROM folders f WHERE f.disk_name = uf.folder_name
         )`
      );
      summary.deletedOrphanUserFolders += orphanLinksResult.rowCount;

      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  if (dryRun) {
    console.log(`${logPrefix}Dry run complete. No folder changes written.`);
  } else {
    console.log(`${logPrefix}Folder sync summary: inserted=${summary.insertedFolders}, deleted=${summary.deletedFolders}, skipped=${summary.skippedFolderDeletes}, orphan_user_folders_deleted=${summary.deletedOrphanUserFolders}`);
  }

  return summary;
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
