/** Rolling ~30-day window per user (aligned with “monthly” in product copy). */
export const USAGE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export const LIMITS = {
  basic: {
    generateSubtitles: 50,
    bulkGenerate: 0,
  },
  premium: {
    generateSubtitles: 75,
    bulkGenerate: 15,
  },
} as const;

export type AccessLevel = keyof typeof LIMITS;

export function subtitlesLimitForAccess(level: AccessLevel): number {
  return LIMITS[level].generateSubtitles;
}

export function bulkLimitForAccess(level: AccessLevel): number {
  return LIMITS[level].bulkGenerate;
}
