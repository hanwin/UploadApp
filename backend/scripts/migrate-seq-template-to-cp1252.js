const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');
const { encodeCp1252Strict } = require('../src/utils/cp1252');

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function parseArgs(argv) {
  const args = {
    dryRun: false,
    uploadsDir: path.join(__dirname, '../uploads')
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (value === '--uploads' && argv[i + 1]) {
      args.uploadsDir = path.resolve(argv[i + 1]);
      i += 1;
    }
  }

  return args;
}

function isTargetFile(fileName) {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.seq') || lower.endsWith('.tmpl');
}

function walkFiles(rootDir) {
  const output = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && isTargetFile(entry.name)) {
        output.push(fullPath);
      }
    }
  }

  return output.sort((a, b) => a.localeCompare(b));
}

function isValidUtf8(buffer) {
  try {
    UTF8_DECODER.decode(buffer);
    return true;
  } catch (error) {
    return false;
  }
}

function makeBackupPath(filePath) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `${filePath}.bak-utf8-${stamp}`;
}

function migrateFile(filePath, options) {
  const current = fs.readFileSync(filePath);

  if (!isValidUtf8(current)) {
    return {
      status: 'skipped-not-utf8',
      filePath
    };
  }

  const utf8Text = current.toString('utf8');
  const cp1252Buffer = encodeCp1252Strict(utf8Text, `migration ${filePath}`);

  if (Buffer.compare(current, cp1252Buffer) === 0) {
    return {
      status: 'skipped-unchanged',
      filePath
    };
  }

  const backupPath = makeBackupPath(filePath);

  if (!options.dryRun) {
    fs.copyFileSync(filePath, backupPath);
    fs.writeFileSync(filePath, cp1252Buffer);
  }

  return {
    status: options.dryRun ? 'dry-run-migrate' : 'migrated',
    filePath,
    backupPath: options.dryRun ? null : backupPath
  };
}

function printSummary(results) {
  const counts = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Migration summary');
  console.log(`- migrated: ${counts.migrated || 0}`);
  console.log(`- dry-run-migrate: ${counts['dry-run-migrate'] || 0}`);
  console.log(`- skipped-unchanged: ${counts['skipped-unchanged'] || 0}`);
  console.log(`- skipped-not-utf8: ${counts['skipped-not-utf8'] || 0}`);
  console.log(`- failed: ${counts.failed || 0}`);
}

function run() {
  const options = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(options.uploadsDir)) {
    throw new Error(`Uploads directory not found: ${options.uploadsDir}`);
  }

  const files = walkFiles(options.uploadsDir);
  const results = [];

  console.log(`Scanning ${files.length} seq/template files under ${options.uploadsDir}`);
  console.log(`Mode: ${options.dryRun ? 'dry-run' : 'write'}`);

  for (const filePath of files) {
    try {
      const result = migrateFile(filePath, options);
      results.push(result);

      if (result.status === 'migrated') {
        console.log(`MIGRATED ${filePath}`);
        console.log(`  backup: ${result.backupPath}`);
      } else if (result.status === 'dry-run-migrate') {
        console.log(`WOULD MIGRATE ${filePath}`);
      } else if (result.status === 'skipped-not-utf8') {
        console.log(`SKIP (not valid UTF-8): ${filePath}`);
      }
    } catch (error) {
      results.push({ status: 'failed', filePath, error: error.message });
      console.error(`FAILED ${filePath}`);
      console.error(`  ${error.message}`);
    }
  }

  printSummary(results);

  const failedCount = results.filter((result) => result.status === 'failed').length;
  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

run();
