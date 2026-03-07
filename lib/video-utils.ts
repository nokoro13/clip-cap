import type { Caption } from '@remotion/captions';

export type Subtitle = {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
};

export type ViralClip = {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  viralityScore: number;
  transcript: string;
  thumbnailUrl?: string;
};

export type ProjectData = {
  id: string;
  videoUrl: string;
  title: string;
  duration: number;
  captions: Caption[];
  clips: ViralClip[];
  status: 'processing' | 'completed' | 'error';
  createdAt: number;
};

/**
 * Convert milliseconds to frame number
 */
export function msToFrame(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

/**
 * Convert frame number to milliseconds
 */
export function frameToMs(frame: number, fps: number): number {
  return Math.round((frame / fps) * 1000);
}

/**
 * Convert Remotion Caption[] to Subtitle[] format (frame-based)
 */
export function captionsToSubtitles(captions: Caption[], fps: number): Subtitle[] {
  return captions.map((caption, index) => ({
    id: `subtitle-${index}-${caption.startMs}`,
    text: caption.text.trim(),
    startFrame: msToFrame(caption.startMs, fps),
    endFrame: msToFrame(caption.endMs, fps),
  }));
}

/**
 * Convert Subtitle[] back to Caption[] format
 */
export function subtitlesToCaptions(subtitles: Subtitle[], fps: number): Caption[] {
  return subtitles.map((subtitle) => ({
    text: subtitle.text,
    startMs: frameToMs(subtitle.startFrame, fps),
    endMs: frameToMs(subtitle.endFrame, fps),
    timestampMs: null,
    confidence: null,
  }));
}

/**
 * Format milliseconds to readable time string (MM:SS)
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format milliseconds to detailed time string (MM:SS.ms)
 */
export function formatTimeDetailed(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds % 1) * 10);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds}`;
}

/**
 * Calculate total duration in frames from video duration in seconds
 */
export function durationToFrames(durationSeconds: number, fps: number): number {
  return Math.ceil(durationSeconds * fps);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parse YouTube URL to get video ID
 */
export function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if URL is a valid YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return parseYouTubeUrl(url) !== null;
}
