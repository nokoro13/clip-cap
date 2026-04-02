import type { SubtitleMode, SubtitleStyle } from '@/remotion/Composition';

export const USER_SUBTITLE_PRESETS_STORAGE_KEY = 'clipcap-user-subtitle-presets-v1';

/** Max saved presets per browser (localStorage safety). */
export const MAX_USER_SUBTITLE_PRESETS = 24;

export type SavedSubtitlePresetRecord = {
  id: string;
  name: string;
  createdAt: number;
  preview: { bg: string; color: string; stroke?: string };
  style: SubtitleStyle;
  subtitleMode?: SubtitleMode;
  maxWordsPerSegment?: number;
  highlightColor?: string;
};

/** Preview chip for preset grid (matches built-in preset preview shape). */
export function previewFromSubtitleStyle(style: SubtitleStyle): SavedSubtitlePresetRecord['preview'] {
  const opacity = style.backgroundOpacity ?? 0;
  const transparentBg =
    opacity <= 0.001 ||
    style.backgroundColor === 'transparent' ||
    !style.backgroundColor;
  const bg = transparentBg ? 'transparent' : style.backgroundColor;
  const stroke = (style.strokeWidth ?? 0) > 0 ? style.strokeColor : undefined;
  return {
    bg,
    color: style.textColor,
    stroke,
  };
}

function isValidSavedRecord(x: unknown): x is SavedSubtitlePresetRecord {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.createdAt !== 'number')
    return false;
  if (!o.style || typeof o.style !== 'object') return false;
  const s = o.style as Record<string, unknown>;
  return typeof s.textColor === 'string' && typeof s.fontFamily === 'string';
}

export function loadUserSubtitlePresets(): SavedSubtitlePresetRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_SUBTITLE_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSavedRecord);
  } catch {
    return [];
  }
}

export function persistUserSubtitlePresets(presets: SavedSubtitlePresetRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_SUBTITLE_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn('[clipcap] Failed to persist subtitle presets', e);
  }
}

/**
 * When the account has no server presets but this browser has legacy local presets,
 * upload each to the API then clear local storage if all succeed.
 */
export async function migrateLocalSubtitlePresetsToServer(): Promise<
  SavedSubtitlePresetRecord[]
> {
  if (typeof window === 'undefined') return [];
  const local = loadUserSubtitlePresets();
  if (local.length === 0) return [];

  const migrated: SavedSubtitlePresetRecord[] = [];
  for (const p of local) {
    try {
      const res = await fetch('/api/subtitle-presets', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: p.name,
          style: p.style,
          subtitleMode: p.subtitleMode,
          maxWordsPerSegment: p.maxWordsPerSegment,
          highlightColor: p.highlightColor,
          preview: p.preview,
        }),
      });
      if (!res.ok) break;
      const data = (await res.json()) as { preset?: SavedSubtitlePresetRecord };
      if (data.preset) migrated.push(data.preset);
    } catch {
      break;
    }
  }

  if (migrated.length === local.length) {
    persistUserSubtitlePresets([]);
  }
  return migrated;
}

/** Same shape as built-in editor presets — used for apply + grid. */
export type SubtitlePresetForApply = {
  id: string;
  name: string;
  preview: { bg: string; color: string; stroke?: string };
  style: Partial<SubtitleStyle>;
  subtitleMode?: SubtitleMode;
  maxWordsPerSegment?: number;
  highlightColor?: string;
};

export function savedRecordToApplyPresetShape(record: SavedSubtitlePresetRecord): SubtitlePresetForApply {
  return {
    id: record.id,
    name: record.name,
    preview: record.preview,
    style: { ...record.style },
    subtitleMode: record.subtitleMode,
    maxWordsPerSegment: record.maxWordsPerSegment,
    highlightColor: record.highlightColor,
  };
}

export function isUserSavedPresetId(id: string): boolean {
  return id.startsWith('custom-');
}
