const { spawn } = require('child_process');

async function getAudioDurationSeconds(filePath) {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ];

    const ffprobe = spawn('ffprobe', ffprobeArgs);
    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffprobe.on('error', (error) => {
      reject(error);
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(errorOutput.trim() || `ffprobe exited with code ${code}`));
      }

      const duration = parseFloat(output.trim());
      if (!Number.isFinite(duration)) {
        return reject(new Error('Unable to parse duration from ffprobe output'));
      }

      resolve(duration);
    });
  });
}

module.exports = {
  getAudioDurationSeconds
};
