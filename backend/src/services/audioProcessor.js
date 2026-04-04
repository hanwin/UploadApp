const { spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const pool = require('../models/db');

// Function to get io instance
function getIO() {
  const { io } = require('../server');
  return io;
}

/**
 * Process audio file for radio broadcast
 * - Loudness normalization (EBU R128 standard)
 * - Dynamic range compression
 * - Convert to MP3
 */
async function processAudioFile(fileId) {
  let client;
  const io = getIO();
  
  try {
    client = await pool.connect();
    
    // Get file info
    const fileResult = await client.query(
      'SELECT * FROM audio_files WHERE id = $1',
      [fileId]
    );
    
    if (fileResult.rows.length === 0) {
      throw new Error('File not found');
    }
    
    const file = fileResult.rows[0];
    // file_path is stored as relative path like "Radioprogram_1/filename.wav" or absolute "/app/uploads/..."
    // If it starts with /app, use it as is, otherwise build the path
    const inputPath = file.file_path.startsWith('/app') 
      ? file.file_path 
      : path.join(__dirname, '../../uploads', file.file_path);
    
    // Update status to processing
    await client.query(
      'UPDATE audio_files SET processing_status = $1 WHERE id = $2',
      ['processing', fileId]
    );
    
    // Emit status update via WebSocket
    io.emit('audioProcessing', { fileId, status: 'processing', originalName: file.original_name });
    
    console.log(`[AudioProcessor] Starting processing for file ${fileId}: ${file.original_name}`);
    
    // Generate output filename (replace extension with .mp3)
    const parsedPath = path.parse(file.filename);
    const outputFilename = `${parsedPath.name}_processed.mp3`;
    const outputPath = path.join(path.dirname(inputPath), outputFilename);
    
    // FFmpeg command for radio-quality audio processing:
    // 1. Loudness normalization to -16 LUFS (EBU R128 standard for radio)
    // 2. Dynamic range compression for consistent levels
    // 3. Limiter to prevent clipping
    // 4. Convert to MP3 @ 192kbps
    const ffmpegArgs = [
      '-i', inputPath,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,acompressor=threshold=-18dB:ratio=4:attack=5:release=50',
      '-codec:a', 'libmp3lame',
      '-b:a', '192k',
      '-progress', 'pipe:1',  // Output progress to stdout
      '-y',  // Overwrite output file
      outputPath
    ];
    
    console.log(`[AudioProcessor] Running ffmpeg...`);
    
    // Get input file duration first
    const ffprobeArgs = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ];
    
    const ffprobe = spawn('ffprobe', ffprobeArgs);
    let inputDuration = 0;
    
    ffprobe.stdout.on('data', (data) => {
      inputDuration = parseFloat(data.toString().trim());
    });
    
    await new Promise((resolve, reject) => {
      ffprobe.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Failed to get input duration'));
      });
    });
    
    console.log(`[AudioProcessor] Input duration: ${inputDuration}s`);
    
    // Run FFmpeg with progress tracking
    const ffmpeg = spawn('ffmpeg', ffmpegArgs);
    let lastProgress = 0;
    let progressBuffer = '';
    const startTime = Date.now();
    
    ffmpeg.stdout.on('data', (data) => {
      progressBuffer += data.toString();
      
      // Parse progress output
      const lines = progressBuffer.split('\n');
      progressBuffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('out_time_ms=')) {
          const timeMs = parseInt(line.split('=')[1]);
          const currentTime = timeMs / 1000000; // Convert microseconds to seconds
          
          if (inputDuration > 0) {
            const progress = Math.min(Math.round((currentTime / inputDuration) * 100), 99);
            
            // Only emit on significant progress changes (every 5%)
            if (progress >= lastProgress + 5) {
              lastProgress = progress;
              
              // Calculate time remaining based on elapsed time and progress
              const elapsedSeconds = (Date.now() - startTime) / 1000;
              const estimatedTotalSeconds = (elapsedSeconds / progress) * 100;
              const estimatedSecondsLeft = estimatedTotalSeconds - elapsedSeconds;
              
              io.emit('audioProcessingProgress', {
                fileId,
                progress,
                estimatedSecondsLeft: Math.max(0, Math.round(estimatedSecondsLeft))
              });
              
              console.log(`[AudioProcessor] Progress: ${progress}%, ~${Math.round(estimatedSecondsLeft)}s kvar`);
            }
          }
        }
      }
    });
    
    ffmpeg.stderr.on('data', (data) => {
      // FFmpeg outputs to stderr, but we can ignore it unless there's an error
    });
    
    await new Promise((resolve, reject) => {
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (err) => {
        reject(err);
      });
    });
    
    console.log(`[AudioProcessor] FFmpeg completed`);
    
    // Get processed file stats
    const stats = await fs.stat(outputPath);
    
    // Get audio duration of processed file
    const ffprobeArgs2 = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      outputPath
    ];
    
    const ffprobe2 = spawn('ffprobe', ffprobeArgs2);
    let duration = 0;
    
    ffprobe2.stdout.on('data', (data) => {
      duration = parseFloat(data.toString().trim());
    });
    
    await new Promise((resolve, reject) => {
      ffprobe2.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('Failed to get output duration'));
      });
    });
    
    console.log(`[AudioProcessor] Processing complete. Creating database entry...`);
    
    // Insert processed file as new audio_files entry
    const insertResult = await client.query(
      `INSERT INTO audio_files 
       (user_id, filename, original_name, file_path, file_size, mime_type, duration, folder, is_processed_version, processing_status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING id`,
      [
        file.user_id,
        outputFilename,
        file.original_name.replace(/\.(wav|WAV)$/, '_processed.mp3'),
        outputPath, // Use absolute path like original file
        stats.size,
        'audio/mpeg',
        duration,
        file.folder,
        true,
        'completed'  // Processing status for the new MP3 file
      ]
    );
    
    const processedFileId = insertResult.rows[0].id;
    
    // Update original file with reference to processed version
    await client.query(
      'UPDATE audio_files SET processing_status = $1, processed_file_id = $2 WHERE id = $3',
      ['completed', processedFileId, fileId]
    );
    
    console.log(`[AudioProcessor] Success! Original file ${fileId} -> Processed file ${processedFileId}`);
    
    // Emit completion event via WebSocket
    if (file.delete_original_on_success) {
      // If original will be deleted, emit event with only processed file
      io.emit('audioProcessingComplete', { 
        fileId: processedFileId,
        originalFileId: fileId,
        status: 'completed',
        originalDeleted: true,
        originalName: file.original_name
      });
    } else {
      // If original is kept, emit event with both files
      io.emit('audioProcessingComplete', { 
        fileId: processedFileId,
        originalFileId: fileId,
        status: 'completed',
        originalDeleted: false,
        originalName: file.original_name
      });
    }
    
    // Check if original file should be deleted
    if (file.delete_original_on_success) {
      console.log(`[AudioProcessor] Deleting original file ${fileId} as requested...`);
      
      try {
        // Delete physical file
        const fileExists = await fs.access(inputPath).then(() => true).catch(() => false);
        if (fileExists) {
          await fs.unlink(inputPath);
          console.log(`[AudioProcessor] Physical file deleted: ${inputPath}`);
        }
        
        // Delete database record
        await client.query('DELETE FROM audio_files WHERE id = $1', [fileId]);
        console.log(`[AudioProcessor] Database record deleted for file ${fileId}`);
      } catch (deleteError) {
        console.error(`[AudioProcessor] Error deleting original file ${fileId}:`, deleteError);
        // Don't throw error - processed file is still created successfully
      }
    }
    
    return processedFileId;
    
  } catch (error) {
    console.error(`[AudioProcessor] Error processing file ${fileId}:`, error);
    
    // Update status to failed
    if (client) {
      await client.query(
        'UPDATE audio_files SET processing_status = $1 WHERE id = $2',
        ['failed', fileId]
      );
      
      // Emit failure event via WebSocket
      const io = getIO();
      io.emit('audioProcessingFailed', { 
        fileId, 
        status: 'failed',
        error: error.message
      });
    }
    
    throw error;
  } finally {
    if (client) client.release();
  }
}

/**
 * Process audio file in background (non-blocking)
 */
function processAudioInBackground(fileId) {
  console.log(`[AudioProcessor] Queuing background processing for file ${fileId}`);
  
  // Process asynchronously without waiting
  processAudioFile(fileId)
    .then((processedFileId) => {
      console.log(`[AudioProcessor] Background processing complete: ${fileId} -> ${processedFileId}`);
    })
    .catch((error) => {
      console.error(`[AudioProcessor] Background processing failed for file ${fileId}:`, error.message);
    });
}

module.exports = {
  processAudioFile,
  processAudioInBackground
};
