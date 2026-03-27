/** Serializable usage payload for the experience UI (safe for client components). */
export type UserUsageStats = {
  accessLevel: 'basic' | 'premium';
  generateSubtitles: { used: number; limit: number };
  bulkGenerate: { used: number; limit: number };
  periodStart: string;
  periodResetsAt: string;
};
