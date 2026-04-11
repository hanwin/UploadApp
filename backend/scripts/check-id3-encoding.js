const fs = require('fs');
const path = require('path');

function readSynchsafeInt(bytes) {
  return ((bytes[0] & 0x7f) << 21)
    | ((bytes[1] & 0x7f) << 14)
    | ((bytes[2] & 0x7f) << 7)
    | (bytes[3] & 0x7f);
}

function decodeFrameText(data, encodingByte) {
  const payload = data.subarray(1);

  if (encodingByte === 0) {
    // ID3 defines ISO-8859-1; many players effectively treat it as CP1252.
    return payload.toString('latin1').replace(/\u0000/g, '');
  }

  if (encodingByte === 1) {
    if (payload.length >= 2) {
      const bom = payload.subarray(0, 2);
      if (bom[0] === 0xff && bom[1] === 0xfe) {
        return payload.subarray(2).toString('utf16le').replace(/\u0000/g, '');
      }
      if (bom[0] === 0xfe && bom[1] === 0xff) {
        const swapped = Buffer.from(payload.subarray(2));
        swapped.swap16();
        return swapped.toString('utf16le').replace(/\u0000/g, '');
      }
    }
    return payload.toString('utf16le').replace(/\u0000/g, '');
  }

  if (encodingByte === 2) {
    const swapped = Buffer.from(payload);
    if (swapped.length % 2 === 0) {
      swapped.swap16();
    }
    return swapped.toString('utf16le').replace(/\u0000/g, '');
  }

  if (encodingByte === 3) {
    return payload.toString('utf8').replace(/\u0000/g, '');
  }

  return '<unknown encoding>';
}

function encodingLabel(byte) {
  const labels = {
    0: 'ISO-8859-1 (often interpreted as CP1252)',
    1: 'UTF-16',
    2: 'UTF-16BE',
    3: 'UTF-8'
  };
  return labels[byte] || `Unknown (${byte})`;
}

function inspectMp3(filePath) {
  const file = fs.readFileSync(filePath);
  if (file.length < 10 || file.toString('ascii', 0, 3) !== 'ID3') {
    throw new Error('No ID3v2 tag found at file start');
  }

  const majorVersion = file[3];
  const flags = file[5];
  const tagSize = readSynchsafeInt(file.subarray(6, 10));
  const tagStart = 10;
  const tagEnd = tagStart + tagSize;

  if (majorVersion !== 3 && majorVersion !== 4) {
    throw new Error(`Unsupported ID3 version 2.${majorVersion}.x (expected 2.3 or 2.4)`);
  }

  let offset = tagStart;

  if ((flags & 0x40) !== 0) {
    if (majorVersion === 3) {
      const extSize = file.readUInt32BE(offset);
      offset += extSize;
    } else {
      const extSize = readSynchsafeInt(file.subarray(offset, offset + 4));
      offset += extSize;
    }
  }

  const rows = [];

  while (offset + 10 <= tagEnd) {
    const frameId = file.toString('ascii', offset, offset + 4);
    const frameHeader = file.subarray(offset, offset + 10);

    if (!/^[A-Z0-9]{4}$/.test(frameId)) {
      break;
    }

    const frameSize = majorVersion === 4
      ? readSynchsafeInt(frameHeader.subarray(4, 8))
      : frameHeader.readUInt32BE(4);

    if (frameSize <= 0) {
      break;
    }

    const dataStart = offset + 10;
    const dataEnd = dataStart + frameSize;
    if (dataEnd > tagEnd) {
      break;
    }

    if (frameId.startsWith('T')) {
      const frameData = file.subarray(dataStart, dataEnd);
      if (frameData.length > 0) {
        const encByte = frameData[0];
        const decoded = decodeFrameText(frameData, encByte);
        rows.push({
          frameId,
          encodingByte: encByte,
          encoding: encodingLabel(encByte),
          textPreview: decoded.slice(0, 120)
        });
      }
    }

    offset = dataEnd;
  }

  return {
    majorVersion,
    rows
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/check-id3-encoding.js <path-to-mp3>');
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  try {
    const result = inspectMp3(resolved);
    console.log(`File: ${resolved}`);
    console.log(`ID3 version: 2.${result.majorVersion}.x`);

    if (result.rows.length === 0) {
      console.log('No text frames found.');
      return;
    }

    for (const row of result.rows) {
      console.log(`${row.frameId}: enc=${row.encodingByte} (${row.encoding}) | ${row.textPreview}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
