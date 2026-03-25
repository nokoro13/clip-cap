import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { OpenAiVerboseTranscription } from '@remotion/openai-whisper';
import { openai } from '@/lib/openai';

const execFileAsync = promisify(execFile);

/** OpenAI Whisper transcription API upload limit (bytes). */
export const WHISPER_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Chunk when the file is at or above this size so we stay under the API limit
 * after encoding / measurement jitter.
 */
const CHUNK_IF_FILE_AT_LEAST_BYTES = 24 * 1024 * 1024;

/**
 * Slice length in seconds. ~10 min at 128 kbps MP3 is ~9.6 MiB — safely under 25 MiB.
 */
const CHUNK_DURATION_SECONDS = 600;

export type WhisperVerboseTranscription = OpenAiVerboseTranscription;

export function whisperDurationToSeconds(duration: string | number): number {
  if (typeof duration === 'number' && Number.isFinite(duration)) return duration;
  const n = typeof duration === 'string' ? parseFloat(duration) : NaN;
  return Number.isFinite(n) ? n : 0;
}

async function ffprobeDurationSeconds(inputPath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputPath,
  ]);
  const d = parseFloat(String(stdout).trim());
  if (!Number.isFinite(d) || d <= 0) {
    throw new Error('Could not read audio duration with ffprobe');
  }
  return d;
}

function extensionForMediaFile(file: File): string {
  const n = file.name.toLowerCase();
  if (n.endsWith('.mp3')) return '.mp3';
  if (n.endsWith('.m4a')) return '.m4a';
  if (n.endsWith('.wav')) return '.wav';
  if (n.endsWith('.webm')) return '.webm';
  if (n.endsWith('.mp4')) return '.mp4';
  if (n.endsWith('.mov')) return '.mov';
  return '.bin';
}

/**
 * Single Whisper verbose_json call (word + segment timestamps).
 */
async function transcribeOneChunk(file: File): Promise<WhisperVerboseTranscription> {
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word', 'segment'],
  });
  const t = transcription as WhisperVerboseTranscription;
  return {
    ...t,
    language: t.language ?? 'en',
    duration: typeof t.duration === 'string' ? parseFloat(t.duration) || 0 : t.duration,
  };
}

/**
 * Transcribe audio with Whisper. If the file is large (over ~24 MiB), splits it into
 * time-aligned MP3 chunks, transcribes each, and merges words/segments with timeline offsets.
 */
export async function transcribeWhisperVerboseWithChunking(
  file: File
): Promise<WhisperVerboseTranscription> {
  if (file.size < CHUNK_IF_FILE_AT_LEAST_BYTES) {
    return transcribeOneChunk(file);
  }

  const tmpDir = path.join(
    os.tmpdir(),
    `clipcap-whisper-chunks-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  const inputPath = path.join(tmpDir, `source${extensionForMediaFile(file)}`);

  try {
    fs.writeFileSync(inputPath, Buffer.from(await file.arrayBuffer()));

    const totalDuration = await ffprobeDurationSeconds(inputPath);

    const merged: WhisperVerboseTranscription = {
      text: '',
      duration: totalDuration,
      language: 'en',
      task: 'transcribe',
      segments: [],
      words: [],
    };

    let timeOffset = 0;
    let partIndex = 0;

    while (timeOffset < totalDuration - 1e-3) {
      const sliceDuration = Math.min(CHUNK_DURATION_SECONDS, totalDuration - timeOffset);
      const chunkPath = path.join(tmpDir, `chunk-${partIndex}.mp3`);

      await execFileAsync(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          inputPath,
          '-ss',
          String(timeOffset),
          '-t',
          String(sliceDuration),
          '-vn',
          '-acodec',
          'libmp3lame',
          '-b:a',
          '128k',
          '-ar',
          '44100',
          '-y',
          chunkPath,
        ],
        { timeout: 300_000, maxBuffer: 50 * 1024 * 1024 }
      );

      if (!fs.existsSync(chunkPath)) {
        throw new Error(`ffmpeg did not produce chunk ${partIndex}`);
      }

      const chunkBuf = fs.readFileSync(chunkPath);
      const chunkFile = new File([chunkBuf], `chunk-${partIndex}.mp3`, {
        type: 'audio/mpeg',
      });

      if (chunkFile.size > WHISPER_MAX_UPLOAD_BYTES) {
        throw new Error(
          `Audio chunk ${partIndex} is ${chunkFile.size} bytes, above OpenAI Whisper limit (${WHISPER_MAX_UPLOAD_BYTES}). Reduce CHUNK_DURATION_SECONDS in whisper-chunked.ts.`
        );
      }

      const transcription = await transcribeOneChunk(chunkFile);

      if (transcription.language) {
        merged.language = transcription.language;
      }

      const tText = (transcription.text || '').trim();
      if (tText) {
        merged.text = merged.text ? `${merged.text} ${tText}` : tText;
      }

      for (const s of transcription.segments || []) {
        merged.segments!.push({
          ...s,
          start: s.start + timeOffset,
          end: s.end + timeOffset,
        });
      }

      for (const w of transcription.words || []) {
        merged.words!.push({
          word: w.word,
          start: w.start + timeOffset,
          end: w.end + timeOffset,
        });
      }

      timeOffset += sliceDuration;
      partIndex += 1;

      try {
        fs.unlinkSync(chunkPath);
      } catch {
        // ignore
      }
    }

    return merged;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
