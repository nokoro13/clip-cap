import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ClipSegmentInput = {
  id: string;
  startMs: number;
  endMs: number;
};

function s3SafeSegment(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_]/g, '_');
}

/**
 * Trim a segment from a local video file and return MP4 bytes (H.264 + AAC, faststart).
 */
export async function extractClipSegmentToBuffer(
  inputPath: string,
  startMs: number,
  endMs: number
): Promise<Buffer> {
  const startSec = startMs / 1000;
  const durationSec = Math.max(0.1, (endMs - startMs) / 1000);
  const outPath = path.join(
    os.tmpdir(),
    `clipcap-seg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.mp4`
  );

  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-ss',
        String(startSec),
        '-i',
        inputPath,
        '-t',
        String(durationSec),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outPath,
      ],
      { timeout: 600_000, maxBuffer: 20 * 1024 * 1024 }
    );

    if (!fs.existsSync(outPath)) {
      throw new Error('ffmpeg did not produce clip output');
    }
    return fs.readFileSync(outPath);
  } finally {
    try {
      fs.unlinkSync(outPath);
    } catch {
      // ignore
    }
  }
}

export async function putClipMp4ToUploadsBucket(
  bucket: string,
  region: string,
  projectId: string,
  clipId: string,
  body: Buffer
): Promise<{ s3Key: string; videoUrl: string }> {
  const s3Key = `uploads/clips/${s3SafeSegment(projectId)}/${s3SafeSegment(clipId)}.mp4`;
  const client = new S3Client({ region });
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: body,
      ContentType: 'video/mp4',
    })
  );
  const videoUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
  return { s3Key, videoUrl };
}

/**
 * For each viral clip, extract the time range from the full video and upload a standalone MP4.
 * Clips that fail extraction are returned unchanged (caller can fall back to parent trim).
 */
export type BulkClipProgress = (completed: number, total: number) => void | Promise<void>;

export async function extractAndUploadBulkClips<T extends ClipSegmentInput>(
  fullVideoPath: string,
  projectId: string,
  clips: T[],
  bucket: string,
  region: string,
  onProgress?: BulkClipProgress
): Promise<Array<T & { s3Key?: string; videoUrl?: string }>> {
  const out: Array<T & { s3Key?: string; videoUrl?: string }> = [];
  const total = clips.length;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]!;
    try {
      const buf = await extractClipSegmentToBuffer(
        fullVideoPath,
        clip.startMs,
        clip.endMs
      );
      const { s3Key, videoUrl } = await putClipMp4ToUploadsBucket(
        bucket,
        region,
        projectId,
        clip.id,
        buf
      );
      out.push({ ...clip, s3Key, videoUrl });
    } catch (err) {
      console.error(
        '[bulk-clip-s3] Failed to extract/upload clip',
        projectId,
        clip.id,
        err
      );
      out.push({ ...clip });
    }
    await onProgress?.(i + 1, total);
  }

  return out;
}
