/**
 * Convert frames to pixels based on zoom level
 */
export function framesToPixels(
  frames: number,
  fps: number,
  zoom: number
): number {
  const seconds = frames / fps;
  return seconds * zoom;
}

/**
 * Convert pixels to frames based on zoom level
 */
export function pixelsToFrames(
  pixels: number,
  fps: number,
  zoom: number
): number {
  const seconds = pixels / zoom;
  return Math.round(seconds * fps);
}

/**
 * Format time as MM:SS.f
 */
export function formatTime(frames: number, fps: number): string {
  const seconds = frames / fps;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const fraction = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, "0")}.${fraction}`;
}

/**
 * Calculate timeline width based on video duration, fps, and zoom
 */
export function calculateTimelineWidth(
  videoDuration: number,
  fps: number,
  zoom: number
): number {
  return framesToPixels(videoDuration, fps, zoom);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate zoom to fit entire video in viewport
 */
export function calculateZoomToFit(
  videoDuration: number,
  fps: number,
  containerWidth: number
): number {
  const videoSeconds = videoDuration / fps;
  return containerWidth / videoSeconds;
}
