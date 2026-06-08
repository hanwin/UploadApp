const fs = require('fs');
const path = require('path');
const { encodeCp1252Strict, decodeCp1252 } = require('./cp1252');

const DEFAULT_CURRENT_TEMPLATE = [
  '[playlist]',
  'file0=Y:\\audio_upload\\{foldername}\\{filename}',
  'length0={length}',
  'numberofentries=1',
  'nextindex=0',
  ''
].join('\n');

function formatAudioLength(durationSeconds) {
  if (!Number.isFinite(durationSeconds)) {
    return '';
  }

  return String(Math.max(0, Math.round(durationSeconds * 1000)));
}

function normalizePathSeparators(value) {
  const input = String(value || '');
  const uncPrefixMatch = input.match(/^(\\\\|\/\/)/);
  const uncPrefix = uncPrefixMatch ? uncPrefixMatch[0] : '';
  const body = uncPrefix ? input.slice(uncPrefix.length) : input;

  return `${uncPrefix}${body.replace(/[\\/]{2,}/g, (match) => match[0])}`;
}

function stripTrailingFilenamePlaceholder(value) {
  return String(value || '').replace(/[\\/]?\{filename[\}\]]\s*$/i, '');
}

function replaceFolderPlaceholders(value, folderName) {
  return String(value || '')
    .replace(/\{foldername[\}\]]/gi, folderName)
    .replace(/\{folder[\}\]]/gi, folderName);
}

function replaceFilenamePlaceholders(value, filename) {
  return String(value || '').replace(/\{filename[\}\]]/gi, filename);
}

function getTemplatePath(folderPath) {
  const folderName = path.basename(folderPath);
  const namedTemplatePath = path.join(folderPath, `${folderName}-tmpl.tmpl`);
  const legacyTemplatePath = path.join(folderPath, 'current.tmpl');
  const oldNamedTemplatePath = path.join(folderPath, `${folderName}.tmpl`);

  if (fs.existsSync(namedTemplatePath)) {
    return namedTemplatePath;
  }
  if (fs.existsSync(oldNamedTemplatePath)) {
    return oldNamedTemplatePath;
  }
  if (fs.existsSync(legacyTemplatePath)) {
    return legacyTemplatePath;
  }

  fs.writeFileSync(
    namedTemplatePath,
    encodeCp1252Strict(DEFAULT_CURRENT_TEMPLATE, `template ${namedTemplatePath}`)
  );
  return namedTemplatePath;
}

function buildCurrentSeqContent(folderPath, filename, durationSeconds) {
  const templatePath = getTemplatePath(folderPath);
  const template = decodeCp1252(fs.readFileSync(templatePath));
  const formattedLength = formatAudioLength(durationSeconds);
  const folderName = path.basename(folderPath);
  const filenameAsString = String(filename || '');
  const lines = template.split(/\r?\n/);
  const resolvedLines = lines.map((line) => {
    const lineWithFolder = replaceFolderPlaceholders(line, folderName);

    if (!/^\s*file\d+\s*=/i.test(lineWithFolder)) {
      return replaceFilenamePlaceholders(lineWithFolder, filenameAsString);
    }

    const separatorIndex = lineWithFolder.indexOf('=');
    const key = lineWithFolder.slice(0, separatorIndex).trim();
    const value = lineWithFolder.slice(separatorIndex + 1);
    const hasFolderPlaceholders = /\{foldername[\}\]]|\{folder[\}\]]/i.test(line);
    const filenameHasPath = /[\\/]/.test(filenameAsString);
    const normalizedFilename = filenameAsString.replace(/\\\\/g, '\\');
    const filenameValue = (hasFolderPlaceholders && filenameHasPath)
      ? path.win32.basename(normalizedFilename)
      : normalizedFilename;

    const resolvedValue = replaceFilenamePlaceholders(value, filenameValue);

    return `${key}=${normalizePathSeparators(resolvedValue)}`;
  });

  return resolvedLines.join('\n').replace(/\{length\}/gi, formattedLength);
}

function resolveSeqFilenameValue(filename, folderName, defaultSeqPath) {
  const cleanFilename = String(filename || '').trim();
  if (!defaultSeqPath || typeof defaultSeqPath !== 'string' || !defaultSeqPath.trim()) {
    return cleanFilename;
  }

  const sanitizedDefaultSeqPath = stripTrailingFilenamePlaceholder(defaultSeqPath);

  const resolved = sanitizedDefaultSeqPath
    .trim()
    .replace(/\{foldername[\}\]]/gi, folderName)
    .replace(/\{folder[\}\]]/gi, folderName)
    .replace(/\{filename[\}\]]/gi, cleanFilename);

  if (/\{filename[\}\]]/i.test(sanitizedDefaultSeqPath)) {
    return normalizePathSeparators(resolved);
  }

  const separator = resolved.includes('\\') ? '\\' : '/';
  return normalizePathSeparators(`${resolved.replace(/[\\/]+$/, '')}${separator}${cleanFilename}`);
}

function writeCurrentSeq(folderPath, filename, durationSeconds, options = {}) {
  const folderName = path.basename(folderPath);
  const legacyCurrentSeqPath = path.join(folderPath, 'current.seq');
  const currentSeqPath = path.join(folderPath, `${folderName}-seq.seq`);
  const seqFilenameValue = resolveSeqFilenameValue(filename, folderName, options.defaultSeqPath);
  const content = buildCurrentSeqContent(folderPath, seqFilenameValue, durationSeconds);

  fs.writeFileSync(
    currentSeqPath,
    encodeCp1252Strict(content, `seq ${currentSeqPath}`)
  );

  // Remove legacy current.seq and .seq.seq so only the new file name is used.
  if (fs.existsSync(legacyCurrentSeqPath)) {
    fs.unlinkSync(legacyCurrentSeqPath);
  }
  const oldSeqSeq = path.join(folderPath, `${folderName}.seq.seq`);
  if (fs.existsSync(oldSeqSeq)) {
    fs.unlinkSync(oldSeqSeq);
  }
}

function removeSeqReferenceForFile(folderPath, filename) {
  const folderName = path.basename(folderPath);
  const currentSeqPath = path.join(folderPath, `${folderName}-seq.seq`);

  if (!fs.existsSync(currentSeqPath)) {
    return false;
  }

  const targetName = path.win32.basename(String(filename || '')).toLowerCase();
  if (!targetName) {
    return false;
  }

  const content = decodeCp1252(fs.readFileSync(currentSeqPath));
  const lines = content.split(/\r?\n/);
  let changed = false;

  const nextLines = lines.map((line) => {
    if (line.toLowerCase().startsWith('file0=')) {
      const currentValue = line.slice(line.indexOf('=') + 1).trim();
      const currentBasename = path.win32.basename(currentValue).toLowerCase();
      if (currentBasename === targetName) {
        changed = true;
        return 'file0=';
      }
    }

    if (line.toLowerCase().startsWith('length0=') && changed) {
      return 'length0=';
    }

    if (line.toLowerCase().startsWith('numberofentries=') && changed) {
      return 'numberofentries=0';
    }

    if (line.toLowerCase().startsWith('nextindex=') && changed) {
      return 'nextindex=0';
    }

    return line;
  });

  if (changed) {
    fs.writeFileSync(
      currentSeqPath,
      encodeCp1252Strict(nextLines.join('\n'), `seq ${currentSeqPath}`)
    );
  }

  return changed;
}

function clearCurrentSeqFile(folderPath) {
  const folderName = path.basename(folderPath);
  const currentSeqPath = path.join(folderPath, `${folderName}-seq.seq`);

  if (!fs.existsSync(currentSeqPath)) {
    return false;
  }

  const content = decodeCp1252(fs.readFileSync(currentSeqPath));
  const lines = content.split(/\r?\n/);

  const nextLines = lines.map((line) => {
    if (line.toLowerCase().startsWith('file0=')) {
      return 'file0=';
    }
    if (line.toLowerCase().startsWith('length0=')) {
      return 'length0=';
    }
    if (line.toLowerCase().startsWith('numberofentries=')) {
      return 'numberofentries=0';
    }
    if (line.toLowerCase().startsWith('nextindex=')) {
      return 'nextindex=0';
    }

    return line;
  });

  fs.writeFileSync(
    currentSeqPath,
    encodeCp1252Strict(nextLines.join('\n'), `seq ${currentSeqPath}`)
  );

  return true;
}

module.exports = {
  writeCurrentSeq,
  removeSeqReferenceForFile,
  clearCurrentSeqFile
};
