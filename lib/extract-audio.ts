import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const WHISPER_MAX_SIZE = 25 * 1024 * 1024; // 25MB

const VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
];

function isVideoFile(file: File): boolean {
  return VIDEO_TYPES.some((t) => file.type === t || file.type.startsWith('video/'));
}

/**
 * Extract audio from a video file using ffmpeg.
 * Returns an MP3 file for Whisper. Files above ~24MB are transcribed in time-aligned
 * chunks in `transcribeWhisperVerboseWithChunking` (see lib/whisper-chunked.ts).
 * Caller must call cleanup() when done.
 */
export async function extractAudioFromVideo(
  file: File
): Promise<{ file: File; cleanup: () => void }> {
  const base = path.join(
    os.tmpdir(),
    `clipcap-audio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const inputPath = `${base}.input`;
  const outputPath = `${base}.mp3`;

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(inputPath, buffer);

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-i',
        inputPath,
        '-vn',
        '-acodec',
        'libmp3lame',
        '-b:a',
        '128k',
        '-ar',
        '44100',
        '-y',
        outputPath,
      ],
      { timeout: 300_000, maxBuffer: 50 * 1024 * 1024 }
    );
  } finally {
    try {
      fs.unlinkSync(inputPath);
    } catch {
      // ignore
    }
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error('ffmpeg did not produce an output file');
  }

  const audioBuffer = fs.readFileSync(outputPath);
  const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

  return {
    file: audioFile,
    cleanup: () => {
      try {
        fs.unlinkSync(outputPath);
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Returns the file to send to Whisper. If the input is a video file > 25MB,
 * extracts audio first. Otherwise returns the original file.
 */
export async function getFileForWhisper(
  file: File
): Promise<{ file: File; cleanup: () => void }> {
  const needsExtraction =
    isVideoFile(file) && file.size > WHISPER_MAX_SIZE;

  if (needsExtraction) {
    return extractAudioFromVideo(file);
  }

  return {
    file,
    cleanup: () => {},
  };
}
