const fs = require('fs');
const path = require('path');
const { decodeCp1252, encodeCp1252Strict } = require('./cp1252');

const DEFAULT_TEMPLATE = [
  '[playlist]',
  'file0=Y:\\audio_upload\\{foldername}\\{filename}',
  'length0={length}',
  'numberofentries=1',
  'nextindex=0',
  ''
].join('\n');

function templatePath(folderPath) {
  const name = path.basename(folderPath);
  return [
    path.join(folderPath, `${name}-tmpl.tmpl`),
    path.join(folderPath, `${name}.tmpl`),
    path.join(folderPath, 'current.tmpl')
  ].find(fs.existsSync) || path.join(folderPath, `${name}-tmpl.tmpl`);
}

function ensureCurrentSeqTemplate(folderPath) {
  const selectedTemplate = templatePath(folderPath);
  if (!fs.existsSync(selectedTemplate)) {
    fs.writeFileSync(selectedTemplate, encodeCp1252Strict(DEFAULT_TEMPLATE, selectedTemplate));
  }
  return selectedTemplate;
}

function normaliseSeparators(value) {
  return String(value || '').replace(/[\\/]{2,}/g, (match) => match[0]);
}

function filenameForSeq(filename, folderName, defaultSeqPath) {
  const clean = String(filename || '').trim();
  if (!defaultSeqPath) return clean;
  const base = String(defaultSeqPath).replace(/[\\/]?\{filename\}\s*$/i, '').trim();
  const folder = base
    .replace(/\{foldername\}/gi, folderName)
    .replace(/\{folder\}/gi, folderName);
  return normaliseSeparators(`${folder.replace(/[\\/]+$/, '')}${folder.includes('\\') ? '\\' : '/'}${clean}`);
}

function writeCurrentSeq(folderPath, filename, durationSeconds, { defaultSeqPath } = {}) {
  const folderName = path.basename(folderPath);
  const selectedTemplate = ensureCurrentSeqTemplate(folderPath);
  const sequenceFilename = filenameForSeq(filename, folderName, defaultSeqPath);
  const length = Number.isFinite(durationSeconds) ? String(Math.max(0, Math.round(durationSeconds * 1000))) : '';
  const content = decodeCp1252(fs.readFileSync(selectedTemplate))
    .split(/\r?\n/)
    .map((line) => line
      .replace(/\{foldername\}/gi, folderName)
      .replace(/\{folder\}/gi, folderName)
      .replace(/\{filename\}/gi, sequenceFilename)
      .replace(/\{length\}/gi, length))
    .join('\n');
  const seqPath = path.join(folderPath, `${folderName}-seq.seq`);
  fs.writeFileSync(seqPath, encodeCp1252Strict(content, seqPath));
}

function removeSeqReferenceForFile(folderPath, filename) {
  const seqPath = path.join(folderPath, `${path.basename(folderPath)}-seq.seq`);
  if (!fs.existsSync(seqPath)) return false;
  const target = path.win32.basename(String(filename || '')).toLowerCase();
  const lines = decodeCp1252(fs.readFileSync(seqPath)).split(/\r?\n/);
  const indexes = new Set(lines
    .map((line) => line.match(/^\s*file(\d+)\s*=(.*)$/i))
    .filter(Boolean)
    .filter((match) => path.win32.basename(match[2].trim()).toLowerCase() === target)
    .map((match) => match[1]));
  if (!indexes.size) return false;
  const next = lines.map((line) => {
    const match = line.match(/^\s*(file|length)(\d+)\s*=/i);
    return match && indexes.has(match[2]) ? `${match[1]}${match[2]}=` : line;
  });
  fs.writeFileSync(seqPath, encodeCp1252Strict(next.join('\n'), seqPath));
  return true;
}

function clearCurrentSeqFile(folderPath) {
  const seqPath = path.join(folderPath, `${path.basename(folderPath)}-seq.seq`);
  if (!fs.existsSync(seqPath)) return false;
  const next = decodeCp1252(fs.readFileSync(seqPath)).split(/\r?\n/).map((line) => {
    if (/^\s*(file|length)\d+\s*=/i.test(line)) return `${line.split('=')[0]}=`;
    if (/^\s*numberofentries=/i.test(line)) return 'numberofentries=0';
    if (/^\s*nextindex=/i.test(line)) return 'nextindex=0';
    return line;
  });
  fs.writeFileSync(seqPath, encodeCp1252Strict(next.join('\n'), seqPath));
  return true;
}

module.exports = {
  writeCurrentSeq,
  removeSeqReferenceForFile,
  clearCurrentSeqFile,
  ensureCurrentSeqTemplate
};
