const iconv = require('iconv-lite');

function createCp1252Error(input, context) {
  const text = String(input || '');
  const encoded = iconv.encode(text, 'windows-1252');
  const decoded = iconv.decode(encoded, 'windows-1252');

  const originalChars = Array.from(text);
  const decodedChars = Array.from(decoded);
  const maxLen = Math.max(originalChars.length, decodedChars.length);

  let mismatchIndex = -1;
  for (let i = 0; i < maxLen; i += 1) {
    if (originalChars[i] !== decodedChars[i]) {
      mismatchIndex = i;
      break;
    }
  }

  const badChar = mismatchIndex >= 0 ? originalChars[mismatchIndex] : '';
  const codePoint = badChar ? badChar.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') : 'UNKNOWN';

  const error = new Error(
    `CP1252 cannot represent character ${badChar ? `'${badChar}'` : '<unknown>'} (U+${codePoint}) in ${context}`
  );
  error.code = 'CP1252_ENCODING_ERROR';
  error.context = context;
  error.character = badChar;
  error.codePoint = `U+${codePoint}`;
  error.userMessage = 'Filnamn eller sökväg innehåller tecken som inte stöds av CP1252.';
  return error;
}

function encodeCp1252Strict(input, context = 'text') {
  const text = String(input || '');
  const encoded = iconv.encode(text, 'windows-1252');
  const decoded = iconv.decode(encoded, 'windows-1252');

  if (decoded !== text) {
    throw createCp1252Error(text, context);
  }

  return encoded;
}

function decodeCp1252(buffer) {
  return iconv.decode(buffer, 'windows-1252');
}

module.exports = {
  encodeCp1252Strict,
  decodeCp1252
};