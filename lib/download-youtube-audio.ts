import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Download YouTube video audio to a temp file using yt-dlp.
 * Caller must call cleanup() when done (e.g. in a finally block) to delete the file.
 * Avoids long-lived streaming fetch that can hit "other side closed" on long videos.
 */
export async function downloadYouTubeAudioToFile(
  standardUrl: string
): Promise<{ filePath: string; cleanup: () => void }> {
  const base = path.join(
    os.tmpdir(),
    `clipcap-yt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const outTemplate = `${base}.%(ext)s`;

  await execFileAsync(
    'yt-dlp',
    [
      '-x',
      '--audio-format', 'mp3',
      '-f', 'bestaudio',
      '--no-warnings',
      '--no-check-certificate',
      '-o', outTemplate,
      standardUrl,
    ],
    { timeout: 600_000, maxBuffer: 50 * 1024 * 1024 }
  );

  const filePath = `${base}.mp3`;
  if (!fs.existsSync(filePath)) {
    throw new Error('yt-dlp did not produce an output file');
  }

  return {
    filePath,
    cleanup: () => {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    },
  };
}
