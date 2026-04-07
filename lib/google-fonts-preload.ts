/**
 * Preload Google Fonts for editor UI (preset chips, font picker) so `font-family`
 * previews match before user interaction. Remotion player loads fonts separately.
 */

import { FONTS_LIST, SYSTEM_FONT } from "@/lib/google-fonts-list";

const inflight = new Map<string, Promise<void>>();

function cacheKey(family: string, weight: number): string {
  return `${family}\0${weight}`;
}

/**
 * Loads one weight of a Google font via @remotion/google-fonts (same path as picker).
 * Safe to call many times; deduped per family+weight.
 */
export function ensureGoogleFontWeightLoaded(
  fontFamily: string,
  fontWeight: number
): Promise<void> {
  if (!fontFamily || fontFamily === SYSTEM_FONT) {
    return Promise.resolve();
  }
  const entry = FONTS_LIST.find((f) => f.family === fontFamily);
  const loadFn = entry?.load;
  if (!loadFn) {
    return Promise.resolve();
  }
  const key = cacheKey(fontFamily, fontWeight);
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }
  const job = (async () => {
    try {
      const mod = await loadFn();
      const result = mod.loadFont?.("normal", {
        weights: [String(fontWeight)],
        subsets: ["latin"],
      });
      await result?.waitUntilDone?.();
    } catch {
      /* ignore — preview stays on fallback */
    }
  })();
  inflight.set(key, job);
  return job;
}

/** Preload fonts needed for subtitle preset preview chips (each preset’s actual weight). */
export function preloadGoogleFontsForSubtitlePresets(
  jobs: Array<{ fontFamily: string; fontWeight: number }>
): void {
  const seen = new Set<string>();
  for (const { fontFamily, fontWeight } of jobs) {
    const k = cacheKey(fontFamily, fontWeight);
    if (seen.has(k)) continue;
    seen.add(k);
    void ensureGoogleFontWeightLoaded(fontFamily, fontWeight);
  }
}

/**
 * Preload every listable Google font at 400 for the family dropdown previews.
 * Runs in small idle chunks to avoid blocking the main thread.
 */
export function preloadGoogleFontsForPickerList(): void {
  const families = FONTS_LIST.filter((f) => f.load != null).map((f) => f.family);
  let i = 0;
  const chunk = 4;
  const step = () => {
    const end = Math.min(i + chunk, families.length);
    for (; i < end; i++) {
      void ensureGoogleFontWeightLoaded(families[i]!, 400);
    }
    if (i < families.length) {
      const ric =
        typeof requestIdleCallback !== "undefined"
          ? requestIdleCallback
          : (cb: () => void) => setTimeout(cb, 32);
      ric(step);
    }
  };
  step();
}
