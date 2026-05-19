const fs = require('fs');
const path = require('path');

const DEFAULT_CURRENT_TEMPLATE = [
  '[playlist]',
  'file0={filename}',
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

function buildCurrentSeqContent(folderPath, filename, durationSeconds) {
  const templatePath = path.join(folderPath, 'current.tmpl');

  if (!fs.existsSync(templatePath)) {
    fs.writeFileSync(templatePath, DEFAULT_CURRENT_TEMPLATE, 'utf-8');
  }

  const template = fs.readFileSync(templatePath, 'utf-8');
  const formattedLength = formatAudioLength(durationSeconds);
  return template
    .replace(/\{filename\}/gi, filename)
    .replace(/\{length\}/gi, formattedLength);
}

function resolveSeqFilenameValue(filename, defaultSeqPath) {
  const cleanFilename = String(filename || '').trim();
  if (!defaultSeqPath || typeof defaultSeqPath !== 'string' || !defaultSeqPath.trim()) {
    return cleanFilename;
  }

  const cleanBasePath = defaultSeqPath.trim().replace(/[\\/]+$/, '');
  return `${cleanBasePath}/${cleanFilename}`;
}

function writeCurrentSeq(folderPath, filename, durationSeconds, options = {}) {
  const folderName = path.basename(folderPath);
  const legacyCurrentSeqPath = path.join(folderPath, 'current.seq');
  const currentSeqPath = path.join(folderPath, `${folderName}.seq.seq`);
  const seqFilenameValue = resolveSeqFilenameValue(filename, options.defaultSeqPath);
  const content = buildCurrentSeqContent(folderPath, seqFilenameValue, durationSeconds);

  fs.writeFileSync(currentSeqPath, content, 'utf-8');

  // Remove legacy current.seq so only the new file name is used.
  if (fs.existsSync(legacyCurrentSeqPath)) {
    fs.unlinkSync(legacyCurrentSeqPath);
  }
}

module.exports = {
  writeCurrentSeq
};
