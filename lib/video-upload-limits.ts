/** Max duration for Generate Subtitles (file uploads). */
export const GENERATE_SUBTITLES_MAX_DURATION_SEC = 5 * 60;

/** Max duration for Bulk Generate (file + YouTube + async analysis). */
export const BULK_GENERATE_MAX_DURATION_SEC = 120 * 60;

export function describeMaxVideoDuration(maxSeconds: number): string {
  if (maxSeconds >= 3600 && maxSeconds % 3600 === 0) {
    const h = maxSeconds / 3600;
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  if (maxSeconds % 60 === 0) {
    const m = maxSeconds / 60;
    return `${m} minute${m === 1 ? '' : 's'}`;
  }
  return `${maxSeconds} seconds`;
}
