import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function ffprobeDurationSeconds(inputPath: string): Promise<number> {
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
    throw new Error('Could not read media duration');
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
  const t = file.type;
  if (t.includes('quicktime')) return '.mov';
  if (t.includes('mp4')) return '.mp4';
  if (t.includes('webm')) return '.webm';
  return '.bin';
}

/** Write file to a temp path and return duration in seconds via ffprobe. */
export async function getMediaDurationSecondsFromFile(file: File): Promise<number> {
  const tmp = path.join(
    os.tmpdir(),
    `clipcap-probe-${Date.now()}-${Math.random().toString(36).slice(2, 9)}${extensionForMediaFile(file)}`
  );
  try {
    fs.writeFileSync(tmp, Buffer.from(await file.arrayBuffer()));
    return await ffprobeDurationSeconds(tmp);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}
