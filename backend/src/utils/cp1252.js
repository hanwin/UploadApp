const iconv = require('iconv-lite');

function encodeCp1252Strict(input, context = 'text') {
  const text = String(input || '');
  const encoded = iconv.encode(text, 'windows-1252');
  if (iconv.decode(encoded, 'windows-1252') !== text) {
    const error = new Error(`CP1252 cannot represent text in ${context}`);
    error.code = 'CP1252_ENCODING_ERROR';
    error.userMessage = 'Filnamn eller sökväg innehåller tecken som inte stöds av CP1252.';
    throw error;
  }
  return encoded;
}

module.exports = {
  encodeCp1252Strict,
  decodeCp1252: (buffer) => iconv.decode(buffer, 'windows-1252')
};
