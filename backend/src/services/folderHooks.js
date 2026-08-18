const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const fsPromises = fs.promises;
const { ensureCurrentSeqTemplate } = require('../utils/currentSeq');
const HOOK_TIMEOUT_MS = 30_000;
const MAX_HOOK_BYTES = 64 * 1024;
const HOOK_NAMES = Object.freeze({
  upload: 'upload.sh',
  delete: 'delete.sh'
});
const UPLOAD_HOOK_TEMPLATE = `#!/bin/sh
# Körs efter att en aktiv ljudfil har sparats och registrerats.
#
# Tillgängliga miljövariabler:
# AUDIO_EVENT          Händelse, alltid "upload" i denna hook.
# AUDIO_FOLDER         Mappens disk-namn.
# AUDIO_FILE_ID        Filens ID i databasen.
# AUDIO_FILENAME       Sparat filnamn.
# AUDIO_ORIGINAL_NAME  Ursprungligt filnamn.
# AUDIO_ACTIVE_PATH    Full sökväg till den aktiva filen.
# AUDIO_ARCHIVE_PATH   Tom vid uppladdning.
# AUDIO_USER_ID        ID för användaren som utförde uppladdningen.
#
# Avsluta med exitkod 0 för att godkänna uppladdningen.
`;
const DELETE_HOOK_TEMPLATE = '#!/bin/sh\n';

function getUploadsRoot() {
  return fs.existsSync('/app/uploads')
    ? '/app/uploads'
    : path.resolve(__dirname, '../../uploads');
}

function getFolderPath(folderName) {
  if (!folderName || /[\\/]/.test(folderName) || folderName === '.' || folderName === '..') {
    throw new Error('Invalid folder name for hook execution');
  }

  const uploadsRoot = getUploadsRoot();
  const folderPath = path.resolve(uploadsRoot, folderName);
  if (!folderPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error('Invalid folder path for hook execution');
  }

  return folderPath;
}

async function ensureHookFile(folderPath, hookName) {
  const hookPath = path.join(folderPath, hookName);

  try {
    await fsPromises.access(hookPath, fs.constants.F_OK);
  } catch {
    const content = hookName === HOOK_NAMES.upload ? UPLOAD_HOOK_TEMPLATE : DELETE_HOOK_TEMPLATE;
    await fsPromises.writeFile(hookPath, content, { mode: 0o750 });
  }

  if (hookName === HOOK_NAMES.upload || hookName === HOOK_NAMES.delete) {
    const content = await fsPromises.readFile(hookPath, 'utf8');
    if (content.trim() === '') {
      await fsPromises.writeFile(
        hookPath,
        hookName === HOOK_NAMES.upload ? UPLOAD_HOOK_TEMPLATE : DELETE_HOOK_TEMPLATE
      );
    }
  }

  await fsPromises.access(hookPath, fs.constants.R_OK | fs.constants.X_OK);
  return hookPath;
}

async function ensureFolderAutomation(folderName) {
  const folderPath = getFolderPath(folderName);
  await fsPromises.mkdir(folderPath, { recursive: true });

  await Promise.all([
    ensureHookFile(folderPath, HOOK_NAMES.upload),
    ensureHookFile(folderPath, HOOK_NAMES.delete)
  ]);

  return { folderPath };
}

async function hasUploadHook(folderName) {
  const hookPath = path.join(getFolderPath(folderName), HOOK_NAMES.upload);
  try {
    await fsPromises.access(hookPath, fs.constants.F_OK);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function ensureLegacyTemplate(folderName) {
  const folderPath = getFolderPath(folderName);
  await fsPromises.mkdir(folderPath, { recursive: true });
  return ensureCurrentSeqTemplate(folderPath);
}

function validateHookContent(content, hookName) {
  if (typeof content !== 'string') {
    throw new Error(`${hookName} must be text`);
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_HOOK_BYTES) {
    throw new Error(`${hookName} exceeds the ${MAX_HOOK_BYTES / 1024} KB size limit`);
  }

  if (!content.startsWith('#!')) {
    throw new Error(`${hookName} must start with a shebang`);
  }
}

async function writeHookFile(hookPath, content) {
  const temporaryPath = `${hookPath}.${process.pid}.${Date.now()}.tmp`;
  await fsPromises.writeFile(temporaryPath, content, { mode: 0o750 });
  await fsPromises.chmod(temporaryPath, 0o750);
  await fsPromises.rename(temporaryPath, hookPath);
}

async function readFolderHooks(folderName) {
  const { folderPath } = await ensureFolderAutomation(folderName);
  const [uploadScript, deleteScript] = await Promise.all([
    fsPromises.readFile(path.join(folderPath, HOOK_NAMES.upload), 'utf8'),
    fsPromises.readFile(path.join(folderPath, HOOK_NAMES.delete), 'utf8')
  ]);

  return { uploadScript, deleteScript };
}

async function updateFolderHooks({ folderName, uploadScript, deleteScript }) {
  validateHookContent(uploadScript, HOOK_NAMES.upload);
  validateHookContent(deleteScript, HOOK_NAMES.delete);

  const { folderPath } = await ensureFolderAutomation(folderName);
  await Promise.all([
    writeHookFile(path.join(folderPath, HOOK_NAMES.upload), uploadScript),
    writeHookFile(path.join(folderPath, HOOK_NAMES.delete), deleteScript)
  ]);
}

async function getArchivePath(folderPath, filename) {
  const archiveDirectory = path.join(folderPath, 'arkiv');
  const parsed = path.parse(path.basename(filename));
  await fsPromises.mkdir(archiveDirectory, { recursive: true });

  for (let sequence = 0; ; sequence += 1) {
    const archiveFilename = sequence === 0
      ? `${parsed.name}${parsed.ext}`
      : `${parsed.name} (${sequence})${parsed.ext}`;
    const archivePath = path.join(archiveDirectory, archiveFilename);

    try {
      await fsPromises.access(archivePath, fs.constants.F_OK);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { archiveDirectory, archivePath };
      }
      throw error;
    }
  }
}

function assertActiveFilePath(folderPath, activePath) {
  const resolvedPath = path.resolve(activePath);
  const archivePath = path.join(folderPath, 'arkiv');
  if (
    !resolvedPath.startsWith(`${folderPath}${path.sep}`) ||
    resolvedPath.startsWith(`${archivePath}${path.sep}`)
  ) {
    throw new Error('File path is outside the active folder');
  }

  return resolvedPath;
}

async function archiveFile({ folderName, activePath, filename }) {
  const folderPath = getFolderPath(folderName);
  const sourcePath = assertActiveFilePath(folderPath, activePath);
  await fsPromises.access(sourcePath, fs.constants.F_OK);

  const { archivePath } = await getArchivePath(
    folderPath,
    filename || path.basename(sourcePath)
  );
  await fsPromises.rename(sourcePath, archivePath);

  return { folderPath, sourcePath, archivePath };
}

async function restoreArchivedFile({ sourcePath, archivePath }) {
  await fsPromises.access(archivePath, fs.constants.F_OK);

  try {
    await fsPromises.access(sourcePath, fs.constants.F_OK);
    throw new Error(`Cannot restore archived file because active path exists: ${sourcePath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fsPromises.rename(archivePath, sourcePath);
}

function runFolderHook({ folderPath, hookName, context }) {
  const hookPath = path.join(folderPath, hookName);
  const environment = {
    ...process.env,
    AUDIO_EVENT: context.event,
    AUDIO_FOLDER: context.folderName,
    AUDIO_FILE_ID: context.fileId ? String(context.fileId) : '',
    AUDIO_FILENAME: context.filename || '',
    AUDIO_ORIGINAL_NAME: context.originalName || '',
    AUDIO_ACTIVE_PATH: context.activePath || '',
    AUDIO_ARCHIVE_PATH: context.archivePath || '',
    AUDIO_USER_ID: context.userId ? String(context.userId) : ''
  };

  return new Promise((resolve, reject) => {
    const child = spawn(hookPath, [], {
      cwd: folderPath,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, HOOK_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-16_384);
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-16_384);
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`${hookName} timed out after ${HOOK_TIMEOUT_MS / 1000} seconds`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${hookName} exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }
      resolve({ hookPath, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function runUploadHook(context) {
  const folderPath = getFolderPath(context.folderName);
  return runFolderHook({
    folderPath,
    hookName: HOOK_NAMES.upload,
    context: { ...context, event: 'upload' }
  });
}

async function archiveAndRunDeleteHook(context) {
  const archived = await archiveFile(context);

  try {
    const hook = await runFolderHook({
      folderPath: archived.folderPath,
      hookName: HOOK_NAMES.delete,
      context: {
        ...context,
        event: 'delete',
        activePath: archived.sourcePath,
        archivePath: archived.archivePath
      }
    });
    return { ...archived, hook };
  } catch (error) {
    try {
      await restoreArchivedFile(archived);
    } catch (restoreError) {
      error.rollbackError = restoreError.message;
    }
    throw error;
  }
}

module.exports = {
  archiveAndRunDeleteHook,
  archiveFile,
  ensureFolderAutomation,
  getUploadsRoot,
  hasUploadHook,
  ensureLegacyTemplate,
  readFolderHooks,
  restoreArchivedFile,
  runUploadHook,
  updateFolderHooks
};
