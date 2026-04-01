import type { CustomTextStyle, BannerStyle } from '@/components/timeline/types';

/** Subset of subtitle style needed for drag bounds (avoids circular import with Composition). */
export type SubtitleLayoutForDrag = {
  fontSize: number;
  lineHeight?: number;
  paddingY: number;
  paddingX: number;
  containerMarginX?: number;
  position: 'top' | 'center' | 'bottom';
  positionY?: number;
};

export type DragBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const COMPOSITION_WIDTH = 1080;
const COMPOSITION_HEIGHT = 1920;

function estimateTextLines(text: string, maxTextWidth: number, charWidth: number): number {
  const approxCharsPerLine = Math.max(8, Math.floor(maxTextWidth / charWidth));
  return Math.max(1, Math.ceil(text.length / approxCharsPerLine));
}

/** Default hit box + position when left/top are not set yet (subtitle uses global SubtitleStyle). */
export function getSubtitleDragBounds(
  text: string,
  style: SubtitleLayoutForDrag,
  compositionWidth = COMPOSITION_WIDTH,
  compositionHeight = COMPOSITION_HEIGHT
): DragBounds {
  const marginX = style.containerMarginX ?? 40;
  const maxTextWidth = compositionWidth - 2 * marginX;
  const charW = style.fontSize * 0.55;
  const lines = estimateTextLines(text, maxTextWidth, charW);
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.2);
  const height = Math.max(
    style.fontSize * 1.5,
    Math.round(lines * lineHeight + 2 * style.paddingY)
  );
  const width = maxTextWidth;

  const positionY = style.positionY ?? null;
  let left = marginX;
  let top: number;

  if (positionY != null) {
    top = Math.round((compositionHeight * positionY) / 100 - height / 2);
  } else if (style.position === 'top') {
    top = 80;
  } else if (style.position === 'center') {
    top = Math.round(compositionHeight / 2 - height / 2);
  } else {
    top = Math.round(compositionHeight - 80 - height);
  }

  left = Math.round(clamp(left, 0, compositionWidth - width));
  top = Math.round(clamp(top, 0, compositionHeight - height));

  return { left, top, width, height };
}

/** Default hit box for custom text segment. */
export function getCustomTextDragBounds(
  text: string,
  style: CustomTextStyle,
  compositionWidth = COMPOSITION_WIDTH,
  compositionHeight = COMPOSITION_HEIGHT
): DragBounds {
  const marginX = style.containerMarginX ?? 40;
  const maxTextWidth = compositionWidth - 2 * marginX;
  const charW = style.fontSize * 0.55;
  const lines = estimateTextLines(text, maxTextWidth, charW);
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.2);
  const height = Math.max(
    style.fontSize * 1.5,
    Math.round(lines * lineHeight + 2 * style.paddingY)
  );
  const width = maxTextWidth;

  const positionY = style.positionY ?? null;
  let left = marginX;
  let top: number;

  if (positionY != null) {
    top = Math.round((compositionHeight * positionY) / 100 - height / 2);
  } else if (style.position === 'top') {
    top = 80;
  } else if (style.position === 'center') {
    top = Math.round(compositionHeight / 2 - height / 2);
  } else {
    top = Math.round(compositionHeight - 80 - height);
  }

  left = Math.round(clamp(left, 0, compositionWidth - width));
  top = Math.round(clamp(top, 0, compositionHeight - height));

  return { left, top, width, height };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Default hit box for banner: full composition width, vertical band only. */
export function getBannerDragBounds(
  _text: string,
  style: BannerStyle,
  _logoUrl: string,
  compositionWidth = COMPOSITION_WIDTH,
  compositionHeight = COMPOSITION_HEIGHT
): DragBounds {
  const innerH =
    Math.max(style.logoHeight, style.fontSize * 1.3) + 2 * style.paddingY;

  const height = Math.max(56, innerH);
  const positionY = style.positionY ?? 90;
  const top = Math.round((compositionHeight * positionY) / 100 - height / 2);

  return {
    left: 0,
    top: clamp(top, 0, compositionHeight - height),
    width: compositionWidth,
    height,
  };
}
