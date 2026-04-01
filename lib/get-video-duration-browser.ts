/**
 * Read duration from a local video (or audio) file in the browser.
 * Returns null if metadata could not be read.
 */
export function probeVideoFileDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    const done = (seconds: number | null) => {
      URL.revokeObjectURL(url);
      resolve(seconds);
    };

    video.onloadedmetadata = () => {
      const d = video.duration;
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}
