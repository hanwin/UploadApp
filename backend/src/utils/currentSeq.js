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

function writeCurrentSeq(folderPath, filename, durationSeconds) {
  const currentSeqPath = path.join(folderPath, 'current.seq');
  const content = buildCurrentSeqContent(folderPath, filename, durationSeconds);
  fs.writeFileSync(currentSeqPath, content, 'utf-8');
}

module.exports = {
  writeCurrentSeq
};
