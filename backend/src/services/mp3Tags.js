const NodeID3 = require('node-id3');
const fs = require('fs').promises;
const path = require('path');

function toLatin1TagField(value, length) {
  const input = (value || '').toString().normalize('NFC');
  const field = Buffer.alloc(length, 0x00);
  const encoded = Buffer.from(input, 'latin1');
  encoded.copy(field, 0, 0, Math.min(encoded.length, length));
  return field;
}

function readLatin1TagField(buffer, start, length) {
  return buffer
    .slice(start, start + length)
    .toString('latin1')
    .replace(/\x00+$/g, '')
    .trim();
}

async function writeId3v1Tag(filePath, tags) {
  const handle = await fs.open(filePath, 'r+');
  try {
    const stat = await handle.stat();
    const id3v1 = Buffer.alloc(128, 0x00);
    id3v1.write('TAG', 0, 3, 'ascii');
    toLatin1TagField(tags.title, 30).copy(id3v1, 3);
    toLatin1TagField(tags.artist, 30).copy(id3v1, 33);
    // Leave album/year/comment empty when only title and artist are used.
    id3v1[127] = 255; // Unknown genre

    let writeOffset = stat.size;
    if (stat.size >= 128) {
      const tail = Buffer.alloc(128);
      await handle.read(tail, 0, 128, stat.size - 128);
      if (tail.slice(0, 3).toString('ascii') === 'TAG') {
        writeOffset = stat.size - 128;
      }
    }

    await handle.write(id3v1, 0, 128, writeOffset);
  } finally {
    await handle.close();
  }
}

async function readId3v1Tag(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const stat = await handle.stat();
    if (stat.size < 128) {
      return { title: '', artist: '' };
    }

    const tail = Buffer.alloc(128);
    await handle.read(tail, 0, 128, stat.size - 128);
    if (tail.slice(0, 3).toString('ascii') !== 'TAG') {
      return { title: '', artist: '' };
    }

    return {
      title: readLatin1TagField(tail, 3, 30),
      artist: readLatin1TagField(tail, 33, 30)
    };
  } finally {
    await handle.close();
  }
}

/**
 * Read ID3 tags from an MP3 file
 * @param {string} filePath - Full path to the MP3 file
 * @returns {Promise<Object>} ID3 tags
 */
async function readTags(filePath) {
  try {
    const tags = await NodeID3.Promise.read(filePath);
    const id3v1Tags = await readId3v1Tag(filePath);
    return {
      success: true,
      tags: {
        title: tags.title || id3v1Tags.title || '',
        artist: tags.artist || id3v1Tags.artist || ''
      }
    };
  } catch (error) {
    console.error('Error reading MP3 tags:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Write ID3 tags to an MP3 file
 * @param {string} filePath - Full path to the MP3 file
 * @param {Object} tags - Tags to write
 * @returns {Promise<Object>} Result
 */
async function writeTags(filePath, tags) {
  try {
    // Only allow title and artist in this application.
    const id3Tags = {
      title: tags.title,
      artist: tags.artist
    };

    // Remove undefined values
    Object.keys(id3Tags).forEach(key => {
      if (id3Tags[key] === undefined || id3Tags[key] === '') {
        delete id3Tags[key];
      }
    });

    await NodeID3.Promise.write(id3Tags, filePath);
    await writeId3v1Tag(filePath, id3Tags);
    // If no error is thrown, consider it a success
    return {
      success: true,
      message: 'Tags updated successfully'
    };
  } catch (error) {
    console.error('Error writing MP3 tags:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Remove all ID3 tags from an MP3 file
 * @param {string} filePath - Full path to the MP3 file
 * @returns {Promise<Object>} Result
 */
async function removeTags(filePath) {
  try {
    const success = await NodeID3.Promise.removeTags(filePath);
    return {
      success,
      message: success ? 'Tags removed successfully' : 'Failed to remove tags'
    };
  } catch (error) {
    console.error('Error removing MP3 tags:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  readTags,
  writeTags,
  removeTags
};
