const fs = require('fs');
const path = require('path');

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

  fs.writeFileSync(namedTemplatePath, DEFAULT_CURRENT_TEMPLATE, 'utf-8');
  return namedTemplatePath;
}

function buildCurrentSeqContent(folderPath, filename, durationSeconds) {
  const templatePath = getTemplatePath(folderPath);
  const template = fs.readFileSync(templatePath, 'utf-8');
  const formattedLength = formatAudioLength(durationSeconds);
  const folderName = path.basename(folderPath);
  const lines = template.split(/\r?\n/);
  const resolvedLines = lines.map((line) => {
    if (!line.trim().toLowerCase().startsWith('file0=')) {
      return line;
    }

    const value = line.slice(line.indexOf('=') + 1);
    const resolvedValue = value
      .replace(/\{foldername\}/gi, folderName)
      .replace(/\{folder\}/gi, folderName)
      .replace(/\{filename\}/gi, filename);

    return `file0=${resolvedValue}`;
  });

  return resolvedLines.join('\n').replace(/\{length\}/gi, formattedLength);
}

function resolveSeqFilenameValue(filename, folderName, defaultSeqPath) {
  const cleanFilename = String(filename || '').trim();
  if (!defaultSeqPath || typeof defaultSeqPath !== 'string' || !defaultSeqPath.trim()) {
    return cleanFilename;
  }

  const resolved = defaultSeqPath
    .trim()
    .replace(/\{foldername\}/gi, folderName)
    .replace(/\{folder\}/gi, folderName)
    .replace(/\{filename\}/gi, cleanFilename);

  if (/\{filename\}/i.test(defaultSeqPath)) {
    return resolved;
  }

  const separator = resolved.includes('\\') ? '\\' : '/';
  return `${resolved.replace(/[\\/]+$/, '')}${separator}${cleanFilename}`;
}

function writeCurrentSeq(folderPath, filename, durationSeconds, options = {}) {
  const folderName = path.basename(folderPath);
  const legacyCurrentSeqPath = path.join(folderPath, 'current.seq');
  const currentSeqPath = path.join(folderPath, `${folderName}-seq.seq`);
  const seqFilenameValue = resolveSeqFilenameValue(filename, folderName, options.defaultSeqPath);
  const content = buildCurrentSeqContent(folderPath, seqFilenameValue, durationSeconds);

  fs.writeFileSync(currentSeqPath, content, 'utf-8');

  // Remove legacy current.seq and .seq.seq so only the new file name is used.
  if (fs.existsSync(legacyCurrentSeqPath)) {
    fs.unlinkSync(legacyCurrentSeqPath);
  }
  const oldSeqSeq = path.join(folderPath, `${folderName}.seq.seq`);
  if (fs.existsSync(oldSeqSeq)) {
    fs.unlinkSync(oldSeqSeq);
  }
}

module.exports = {
  writeCurrentSeq
};
