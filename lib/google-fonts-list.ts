/**
 * Font list for the font picker. Uses @remotion/google-fonts for loadable fonts.
 * @see https://www.remotion.dev/docs/font-picker
 */

import type { GoogleFont } from '@remotion/google-fonts';

export type FontEntry = {
  family: string;
  /** If set, loads from @remotion/google-fonts; otherwise custom (fontFamily only). */
  load?: () => Promise<GoogleFont>;
};

/** User's font list in order. Google Fonts have load(); custom fonts only set fontFamily. */
export const FONTS_LIST: FontEntry[] = [
  { family: 'Arial-Pro', load: undefined },
  { family: 'Nunito', load: () => import('@remotion/google-fonts/Nunito') as Promise<GoogleFont> },
  { family: 'Poppins', load: () => import('@remotion/google-fonts/Poppins') as Promise<GoogleFont> },
  { family: 'Montserrat', load: () => import('@remotion/google-fonts/Montserrat') as Promise<GoogleFont> },
  { family: 'Roboto', load: () => import('@remotion/google-fonts/Roboto') as Promise<GoogleFont> },
  { family: 'Raleway', load: () => import('@remotion/google-fonts/Raleway') as Promise<GoogleFont> },
  { family: 'TheBold', load: undefined },
  { family: 'Circular', load: undefined },
  { family: 'Eurostile', load: undefined },
  { family: 'Bangers', load: () => import('@remotion/google-fonts/Bangers') as Promise<GoogleFont> },
  { family: 'Cairo', load: () => import('@remotion/google-fonts/Cairo') as Promise<GoogleFont> },
  { family: 'Rubik', load: () => import('@remotion/google-fonts/Rubik') as Promise<GoogleFont> },
  { family: 'TTfors', load: undefined },
  { family: 'TTNorms', load: undefined },
  { family: 'Komika', load: undefined },
  { family: 'Opinion', load: undefined },
  { family: 'Noto Sans', load: () => import('@remotion/google-fonts/NotoSans') as Promise<GoogleFont> },
  { family: 'Fira Sans Condensed', load: () => import('@remotion/google-fonts/FiraSansCondensed') as Promise<GoogleFont> },
  { family: 'Gabarito', load: () => import('@remotion/google-fonts/Gabarito') as Promise<GoogleFont> },
  { family: 'DM Serif Display', load: () => import('@remotion/google-fonts/DMSerifDisplay') as Promise<GoogleFont> },
  { family: 'Anton', load: () => import('@remotion/google-fonts/Anton') as Promise<GoogleFont> },
  { family: 'Insolent', load: undefined },
  { family: 'Metropolis', load: undefined },
  { family: 'IMFell', load: () => import('@remotion/google-fonts/IMFellEnglish') as Promise<GoogleFont> },
  { family: 'Fraunces', load: () => import('@remotion/google-fonts/Fraunces') as Promise<GoogleFont> },
  { family: 'Rouge Script', load: () => import('@remotion/google-fonts/RougeScript') as Promise<GoogleFont> },
  { family: 'Dancing Script', load: () => import('@remotion/google-fonts/DancingScript') as Promise<GoogleFont> },
  { family: 'Barlow', load: () => import('@remotion/google-fonts/Barlow') as Promise<GoogleFont> },
  { family: 'Noto Sans Hebrew', load: () => import('@remotion/google-fonts/NotoSansHebrew') as Promise<GoogleFont> },
  { family: 'Heebo', load: () => import('@remotion/google-fonts/Heebo') as Promise<GoogleFont> },
  { family: 'Alef', load: () => import('@remotion/google-fonts/Alef') as Promise<GoogleFont> },
  { family: 'Noto Sans Arabic', load: () => import('@remotion/google-fonts/NotoSansArabic') as Promise<GoogleFont> },
  { family: 'Chapaza', load: undefined },
  { family: 'EB Garamond', load: () => import('@remotion/google-fonts/EBGaramond') as Promise<GoogleFont> },
  { family: 'Saira', load: () => import('@remotion/google-fonts/Saira') as Promise<GoogleFont> },
  { family: 'Garamond', load: undefined },
  { family: 'ItcGaramond', load: undefined },
];

export const SYSTEM_FONT = 'system-ui, sans-serif';

/** Entries that have load() for Remotion composition. */
export const GOOGLE_FONTS_LIST: FontEntry[] = FONTS_LIST.filter((f) => f.load != null);

export function getFontDisplayName(fontFamily: string): string {
  if (!fontFamily || fontFamily === SYSTEM_FONT) return 'System';
  return fontFamily;
}

export function isGoogleFont(fontFamily: string): boolean {
  if (!fontFamily || fontFamily === SYSTEM_FONT) return false;
  const entry = FONTS_LIST.find((f) => f.family === fontFamily);
  return entry != null && entry.load != null;
}

export const FONT_WEIGHTS = [
  { value: 100, label: '100' },
  { value: 200, label: '200' },
  { value: 300, label: '300' },
  { value: 400, label: '400' },
  { value: 500, label: '500' },
  { value: 600, label: '600' },
  { value: 700, label: '700' },
  { value: 800, label: '800' },
  { value: 900, label: '900' },
] as const;

/** All weights 100–900 for system/custom fonts. */
export const ALL_FONT_WEIGHTS: number[] = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * Extract available font weights from a loaded Google Font's getInfo().
 * Use this to show only supported weights in the weight picker.
 */
export function getWeightsFromFontInfo(info: { fonts: Record<string, Record<string, unknown>> }): number[] {
  const weights = new Set<number>();
  const fonts = info.fonts as Record<string, Record<string, unknown>>;
  for (const _style of Object.keys(fonts)) {
    for (const w of Object.keys(fonts[_style] ?? {})) {
      const n = Number(w);
      if (!Number.isNaN(n)) weights.add(n);
    }
  }
  return [...weights].sort((a, b) => a - b);
}
