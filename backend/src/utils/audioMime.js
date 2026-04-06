const path = require('path');

const AUDIO_MIME_BY_EXTENSION = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

const getCanonicalAudioMimeType = (filename) => {
  if (!filename) {
    return null;
  }

  const extension = path.extname(filename).toLowerCase();
  return AUDIO_MIME_BY_EXTENSION[extension] || null;
};

module.exports = {
  getCanonicalAudioMimeType
};