const NodeID3 = require('node-id3');
const fs = require('fs').promises;
const path = require('path');

/**
 * Read ID3 tags from an MP3 file
 * @param {string} filePath - Full path to the MP3 file
 * @returns {Promise<Object>} ID3 tags
 */
async function readTags(filePath) {
  try {
    const tags = await NodeID3.Promise.read(filePath);
    return {
      success: true,
      tags: {
        title: tags.title || '',
        artist: tags.artist || '',
        album: tags.album || '',
        year: tags.year || '',
        comment: tags.comment?.text || '',
        genre: tags.genre || '',
        trackNumber: tags.trackNumber || '',
        bpm: tags.bpm || '',
        composer: tags.composer || '',
        copyright: tags.copyright || '',
        encodingSettings: tags.encodingSettings || '',
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
    // Prepare tags object for node-id3
    const id3Tags = {
      title: tags.title,
      artist: tags.artist,
      album: tags.album,
      year: tags.year,
      comment: {
        language: 'swe',
        text: tags.comment || ''
      },
      genre: tags.genre,
      trackNumber: tags.trackNumber,
      bpm: tags.bpm,
      composer: tags.composer,
      copyright: tags.copyright,
      encodingSettings: tags.encodingSettings,
    };

    // Remove undefined values
    Object.keys(id3Tags).forEach(key => {
      if (id3Tags[key] === undefined || id3Tags[key] === '') {
        delete id3Tags[key];
      }
    });

    await NodeID3.Promise.write(id3Tags, filePath);
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
