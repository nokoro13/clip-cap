import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  OffthreadVideo,
  Easing,
  useDelayRender,
} from 'remotion';
import { FONTS_LIST, isGoogleFont } from '@/lib/google-fonts-list';
import type {
  CustomTextSegment,
  CustomTextStyle,
  CustomTextTrack,
  BannerSegment,
  BannerTrack,
  SplitScreenConfig,
  DraggablePosition,
} from '@/components/timeline/types';
import { BannerOverlay } from './BannerOverlay';
import { SortedOverlays } from './SortedOverlays';
import {
  getSubtitleDragBounds,
  getCustomTextDragBounds,
  getBannerDragBounds,
} from './drag-bounds';
import type { DragBounds } from './drag-bounds';

// ============ STYLE TYPES ============

export type SubtitleStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  /** Font style: normal or italic */
  fontStyle?: 'normal' | 'italic';
  /** Line height as unitless multiplier (e.g. 1.2) */
  lineHeight?: number;
  /** Word spacing in pixels */
  wordSpacing?: number;
  /** Display all subtitle text in uppercase */
  uppercase?: boolean;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  /** Shadow opacity 0–1. When 0, shadow is effectively off. */
  shadowOpacity?: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  position: 'top' | 'center' | 'bottom';
  /** Vertical position as percentage from top (0 = top, 100 = bottom). Used when positionY is set. */
  positionY?: number;
  animation: 'none' | 'fade' | 'pop' | 'slide' | 'typewriter';
  borderRadius: number;
  paddingX: number;
  paddingY: number;
  /** Left/right margin (px) of the subtitle container. Larger = narrower text area = more wrapping to two lines. */
  containerMarginX?: number;
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 56,
  fontWeight: 700,
  fontStyle: 'normal',
  lineHeight: 1.2,
  wordSpacing: 0,
  uppercase: false,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.6,
  strokeColor: '#000000',
  strokeWidth: 0,
  shadowColor: '#000000',
  shadowBlur: 8,
  shadowOpacity: 1,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  position: 'bottom',
  positionY: 85,
  animation: 'pop',
  borderRadius: 8,
  paddingX: 24,
  paddingY: 12,
  containerMarginX: 40,
};

export const STYLE_PRESETS: Record<string, Partial<SubtitleStyle>> = {
  tiktok: {
    fontSize: 64,
    fontWeight: 900,
    textColor: '#ffffff',
    backgroundColor: 'transparent',
    backgroundOpacity: 0,
    strokeColor: '#000000',
    strokeWidth: 4,
    shadowBlur: 0,
    animation: 'pop',
  },
  youtube: {
    fontSize: 48,
    fontWeight: 400,
    textColor: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 0.75,
    strokeWidth: 0,
    borderRadius: 4,
    paddingX: 16,
    paddingY: 8,
    animation: 'fade',
  },
  minimal: {
    fontSize: 42,
    fontWeight: 500,
    textColor: '#ffffff',
    backgroundColor: 'transparent',
    backgroundOpacity: 0,
    strokeWidth: 0,
    shadowBlur: 12,
    shadowColor: '#000000',
    animation: 'fade',
  },
  bold: {
    fontSize: 72,
    fontWeight: 900,
    textColor: '#ffff00',
    backgroundColor: '#ff0000',
    backgroundOpacity: 1,
    strokeColor: '#000000',
    strokeWidth: 3,
    borderRadius: 0,
    animation: 'pop',
  },
};

// ============ SUBTITLE TYPES ============

export type WordTiming = {
  text: string;
  startMs: number;
  endMs: number;
};

export type Subtitle = {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
  words?: WordTiming[]; // Optional word timings for highlighting
  /** When set, positions subtitle in composition pixels (overrides global style position). */
  left?: number;
  top?: number;
  isDragging?: boolean;
};

export type SubtitleMode = 'word' | 'segment' | 'segment-highlight' | 'segment-background-highlight';

export type VideoTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type VideoSegment = {
  id: string;
  startFrame: number;
  endFrame: number;
  sourceStartFrame: number;
  sourceEndFrame: number;
  sourceVideoUrl: string;
  transform?: VideoTransform;
  splitScreen?: SplitScreenConfig;
};

export type EnhancedSubtitle = Subtitle & {
  isDeleted?: boolean;
};

export type SubtitleCompositionProps = {
  videoUrl: string | null;
  /** When provided, renders multiple video segments instead of single video */
  videoSegments?: VideoSegment[];
  subtitles: (Subtitle | EnhancedSubtitle)[];
  style: SubtitleStyle;
  videoStartFrom?: number;
  subtitleMode?: SubtitleMode; // How to display subtitles
  highlightColor?: string; // Color for highlighted words
  videoTransform?: VideoTransform; // Pan/zoom for 16:9 or 9:16 video in 9:16 canvas
  videoAspectRatio?: number; // width/height. 9/16 for portrait, 16/9 for landscape
  /** Custom text overlay segments (from text tracks) */
  customTextSegments?: CustomTextSegment[];
  /** Custom text tracks (for visibility filtering) */
  customTextTracks?: CustomTextTrack[];
  /** Banner segments */
  bannerSegments?: BannerSegment[];
  /** Banner tracks (for visibility filtering) */
  bannerTracks?: BannerTrack[];
  /** Global split-screen. When a segment defines `splitScreen`, that overrides for that segment. */
  splitScreenConfig?: SplitScreenConfig | null;
  /** Player drag & drop: selected overlay id (`sub:id`, `ctext:id`, `banner:id`). */
  selectedItemId?: string | null;
  setSelectedItemId?: (id: string | null) => void;
  onSubtitlePositionChange?: (
    id: string,
    updater: (pos: DraggablePosition) => DraggablePosition
  ) => void;
  onCustomTextPositionChange?: (
    id: string,
    updater: (pos: DraggablePosition) => DraggablePosition
  ) => void;
  onBannerPositionChange?: (
    id: string,
    updater: (pos: DraggablePosition) => DraggablePosition
  ) => void;
};

// ============ POSITION HELPER ============

function getSubtitlePositionStyles(
  style: SubtitleStyle,
  scale: number
): React.CSSProperties {
  const marginX = style.containerMarginX ?? 40;
  const base: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    padding: `0 ${marginX}px`,
  };
  const positionY = style.positionY ?? null;
  if (positionY != null) {
    base.top = `${positionY}%`;
    base.transform = `translateY(-50%) scale(${scale})`;
    return base;
  }
  if (style.position === 'top') {
    base.top = 80;
  } else if (style.position === 'center') {
    base.top = '50%';
    base.transform = `translateY(-50%) scale(${scale})`;
  } else {
    base.bottom = 80;
  }
  return base;
}

/** True when the outer div handles scale (positionY or center). */
function isPositionWithOuterScale(style: SubtitleStyle): boolean {
  return style.positionY != null || style.position === 'center';
}

/** Position styles for custom text overlay (uses CustomTextStyle) */
function getCustomTextPositionStyles(
  style: CustomTextStyle,
  scale: number
): React.CSSProperties {
  const marginX = style.containerMarginX ?? 40;
  const base: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    padding: `0 ${marginX}px`,
  };
  const positionY = style.positionY ?? null;
  if (positionY != null) {
    base.top = `${positionY}%`;
    base.transform = `translateY(-50%) scale(${scale})`;
    return base;
  }
  if (style.position === 'top') {
    base.top = 80;
  } else if (style.position === 'center') {
    base.top = '50%';
    base.transform = `translateY(-50%) scale(${scale})`;
  } else {
    base.bottom = 80;
  }
  return base;
}

function isCustomTextPositionWithOuterScale(style: CustomTextStyle): boolean {
  return style.positionY != null || style.position === 'center';
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ============ SUBTITLE DISPLAY COMPONENT ============

// Word-highlighted subtitle display for segment-highlight mode
const HighlightedSubtitleDisplay: React.FC<{
  words: WordTiming[];
  style: SubtitleStyle;
  segmentStartMs: number;
  highlightColor: string;
  absoluteLayout?: DragBounds;
}> = ({ words, style, segmentStartMs, highlightColor, absoluteLayout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate current time in ms relative to segment start
  const currentMs = segmentStartMs + (frame / fps) * 1000;

  let opacity = 1;
  let scale = 1;
  let translateY = 0;

  const animationFrames = Math.min(fps * 0.2, 6);

  switch (style.animation) {
    case 'fade':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      break;
    case 'pop':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      scale = interpolate(frame, [0, animationFrames], [0.5, 1], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.back(1.5)),
      });
      break;
    case 'slide':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      translateY = interpolate(frame, [0, animationFrames], [30, 0], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
      break;
  }

  const positionStyles: React.CSSProperties = absoluteLayout
    ? {
        position: 'absolute',
        left: absoluteLayout.left,
        top: absoluteLayout.top,
        width: absoluteLayout.width,
        height: absoluteLayout.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }
    : getSubtitlePositionStyles(style, scale);
  const useOuterScale = !absoluteLayout && isPositionWithOuterScale(style);

  const textShadows: string[] = [];
  if (style.strokeWidth > 0) {
    const sw = style.strokeWidth;
    const sc = style.strokeColor;
    textShadows.push(
      `${sw}px 0 0 ${sc}`,
      `-${sw}px 0 0 ${sc}`,
      `0 ${sw}px 0 ${sc}`,
      `0 -${sw}px 0 ${sc}`,
      `${sw}px ${sw}px 0 ${sc}`,
      `-${sw}px ${sw}px 0 ${sc}`,
      `${sw}px -${sw}px 0 ${sc}`,
      `-${sw}px -${sw}px 0 ${sc}`
    );
  }
  const shadowOpacity = style.shadowOpacity ?? 1;
  if (style.shadowBlur > 0 && shadowOpacity > 0) {
    textShadows.push(
      `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${hexToRgba(style.shadowColor, shadowOpacity)}`
    );
  }

  const bgColor = style.backgroundColor;
  const bgOpacity = style.backgroundOpacity;
  let backgroundColor = 'transparent';
  if (bgOpacity > 0 && bgColor !== 'transparent') {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    backgroundColor = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  }

  return (
    <div style={positionStyles}>
      <span
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          opacity,
          transform: !useOuterScale
            ? `scale(${scale}) translateY(${translateY}px)`
            : translateY !== 0
              ? `translateY(${translateY}px)`
              : undefined,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontFamily: style.fontFamily,
          fontStyle: style.fontStyle ?? 'normal',
          lineHeight: style.lineHeight ?? 1.2,
          wordSpacing: style.wordSpacing != null ? `${style.wordSpacing}px` : undefined,
          textShadow: textShadows.length > 0 ? textShadows.join(', ') : 'none',
          backgroundColor,
          padding: `${style.paddingY}px ${style.paddingX}px`,
          borderRadius: style.borderRadius,
          whiteSpace: 'pre-wrap',
          textTransform: style.uppercase ? 'uppercase' : undefined,
        }}
      >
        {words.map((word, index) => {
          const isActive = currentMs >= word.startMs && currentMs < word.endMs;
          return (
            <span
              key={`${word.text}-${index}`}
              style={{
                color: isActive ? highlightColor : style.textColor,
                transition: 'color 0.1s ease-out',
                display: 'inline-block',
              }}
            >
              {word.text.trim()}
              {index < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </span>
    </div>
  );
};

// Darken a hex color for border (e.g. background highlight border)
function darkenHex(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = Math.max(0, Math.floor(parseInt(h.slice(0, 2), 16) * (1 - factor)));
  const g = Math.max(0, Math.floor(parseInt(h.slice(2, 4), 16) * (1 - factor)));
  const b = Math.max(0, Math.floor(parseInt(h.slice(4, 6), 16) * (1 - factor)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Sentence + background highlight: active word gets a solid background box (with border)
const BackgroundHighlightedSubtitleDisplay: React.FC<{
  words: WordTiming[];
  style: SubtitleStyle;
  segmentStartMs: number;
  highlightColor: string;
  absoluteLayout?: DragBounds;
}> = ({ words, style, segmentStartMs, highlightColor, absoluteLayout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentMs = segmentStartMs + (frame / fps) * 1000;

  let opacity = 1;
  let scale = 1;
  let translateY = 0;

  const animationFrames = Math.min(fps * 0.2, 6);

  switch (style.animation) {
    case 'fade':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      break;
    case 'pop':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      scale = interpolate(frame, [0, animationFrames], [0.5, 1], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.back(1.5)),
      });
      break;
    case 'slide':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      translateY = interpolate(frame, [0, animationFrames], [30, 0], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
      break;
  }

  const positionStyles: React.CSSProperties = absoluteLayout
    ? {
        position: 'absolute',
        left: absoluteLayout.left,
        top: absoluteLayout.top,
        width: absoluteLayout.width,
        height: absoluteLayout.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }
    : getSubtitlePositionStyles(style, scale);
  const useOuterScale = !absoluteLayout && isPositionWithOuterScale(style);

  const textShadows: string[] = [];
  if (style.strokeWidth > 0) {
    const sw = style.strokeWidth;
    const sc = style.strokeColor;
    textShadows.push(
      `${sw}px 0 0 ${sc}`,
      `-${sw}px 0 0 ${sc}`,
      `0 ${sw}px 0 ${sc}`,
      `0 -${sw}px 0 ${sc}`,
      `${sw}px ${sw}px 0 ${sc}`,
      `-${sw}px ${sw}px 0 ${sc}`,
      `${sw}px -${sw}px 0 ${sc}`,
      `-${sw}px -${sw}px 0 ${sc}`
    );
  }
  const shadowOpacity = style.shadowOpacity ?? 1;
  if (style.shadowBlur > 0 && shadowOpacity > 0) {
    textShadows.push(
      `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${hexToRgba(style.shadowColor, shadowOpacity)}`
    );
  }

  const bgColor = style.backgroundColor;
  const bgOpacity = style.backgroundOpacity;
  let backgroundColor = 'transparent';
  if (bgOpacity > 0 && bgColor !== 'transparent') {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    backgroundColor = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  }

  return (
    <div style={positionStyles}>
      <span
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          opacity,
          transform: !useOuterScale
            ? `scale(${scale}) translateY(${translateY}px)`
            : translateY !== 0
              ? `translateY(${translateY}px)`
              : undefined,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontFamily: style.fontFamily,
          fontStyle: style.fontStyle ?? 'normal',
          lineHeight: style.lineHeight ?? 1.2,
          wordSpacing: style.wordSpacing != null ? `${style.wordSpacing}px` : undefined,
          textShadow: textShadows.length > 0 ? textShadows.join(', ') : 'none',
          backgroundColor,
          padding: `${style.paddingY}px ${style.paddingX}px`,
          borderRadius: style.borderRadius,
          whiteSpace: 'pre-wrap',
          textTransform: style.uppercase ? 'uppercase' : undefined,
        }}
      >
        {words.map((word, index) => {
          const isActive = currentMs >= word.startMs && currentMs < word.endMs;
          return (
            <React.Fragment key={`${word.text}-${index}`}>
              <span
                style={{
                  color: style.textColor,
                  transition: 'background-color 0.1s ease-out',
                  display: 'inline',
                  ...(isActive
                    ? {
                        backgroundColor: highlightColor,
                        borderRadius: 4,
                        padding: '2px 6px',
                      }
                    : {}),
                }}
              >
                {word.text.trim()}
              </span>
              {index < words.length - 1 ? ' ' : null}
            </React.Fragment>
          );
        })}
      </span>
    </div>
  );
};

const SubtitleDisplay: React.FC<{
  text: string;
  style: SubtitleStyle;
  absoluteLayout?: DragBounds;
}> = ({ text, style, absoluteLayout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let opacity = 1;
  let scale = 1;
  let translateY = 0;
  let displayText = text;

  const animationFrames = Math.min(fps * 0.2, 6);

  switch (style.animation) {
    case 'fade':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      break;
    case 'pop':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      scale = interpolate(frame, [0, animationFrames], [0.5, 1], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.back(1.5)),
      });
      break;
    case 'slide':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      translateY = interpolate(frame, [0, animationFrames], [30, 0], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
      break;
    case 'typewriter':
      const charsToShow = Math.floor(
        interpolate(frame, [0, fps * 0.5], [0, text.length], {
          extrapolateRight: 'clamp',
        })
      );
      displayText = text.slice(0, charsToShow);
      break;
  }

  const positionStyles: React.CSSProperties = absoluteLayout
    ? {
        position: 'absolute',
        left: absoluteLayout.left,
        top: absoluteLayout.top,
        width: absoluteLayout.width,
        height: absoluteLayout.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }
    : getSubtitlePositionStyles(style, scale);
  const useOuterScale = !absoluteLayout && isPositionWithOuterScale(style);

  const textShadows: string[] = [];

  if (style.strokeWidth > 0) {
    const sw = style.strokeWidth;
    const sc = style.strokeColor;
    textShadows.push(
      `${sw}px 0 0 ${sc}`,
      `-${sw}px 0 0 ${sc}`,
      `0 ${sw}px 0 ${sc}`,
      `0 -${sw}px 0 ${sc}`,
      `${sw}px ${sw}px 0 ${sc}`,
      `-${sw}px ${sw}px 0 ${sc}`,
      `${sw}px -${sw}px 0 ${sc}`,
      `-${sw}px -${sw}px 0 ${sc}`
    );
  }

  const shadowOpacity = style.shadowOpacity ?? 1;
  if (style.shadowBlur > 0 && shadowOpacity > 0) {
    textShadows.push(
      `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${hexToRgba(style.shadowColor, shadowOpacity)}`
    );
  }

  const bgColor = style.backgroundColor;
  const bgOpacity = style.backgroundOpacity;
  let backgroundColor = 'transparent';
  if (bgOpacity > 0 && bgColor !== 'transparent') {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    backgroundColor = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  }

  return (
    <div style={positionStyles}>
      <span
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          opacity,
          transform: !useOuterScale
            ? `scale(${scale}) translateY(${translateY}px)`
            : translateY !== 0
              ? `translateY(${translateY}px)`
              : undefined,
          color: style.textColor,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontFamily: style.fontFamily,
          fontStyle: style.fontStyle ?? 'normal',
          lineHeight: style.lineHeight ?? 1.2,
          wordSpacing: style.wordSpacing != null ? `${style.wordSpacing}px` : undefined,
          textShadow: textShadows.length > 0 ? textShadows.join(', ') : 'none',
          backgroundColor,
          padding: `${style.paddingY}px ${style.paddingX}px`,
          borderRadius: style.borderRadius,
          whiteSpace: 'pre-wrap',
          textTransform: style.uppercase ? 'uppercase' : undefined,
        }}
      >
        {displayText}
      </span>
    </div>
  );
};

// ============ CUSTOM TEXT OVERLAY ============

const CustomTextOverlay: React.FC<{
  text: string;
  style: CustomTextStyle;
  absoluteLayout?: DragBounds;
}> = ({ text, style, absoluteLayout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let opacity = 1;
  let scale = 1;
  let translateY = 0;
  let displayText = text;

  const animationFrames = Math.min(fps * 0.2, 6);

  switch (style.animation) {
    case 'fade':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      break;
    case 'pop':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      scale = interpolate(frame, [0, animationFrames], [0.5, 1], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.back(1.5)),
      });
      break;
    case 'slide':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      translateY = interpolate(frame, [0, animationFrames], [30, 0], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
      break;
    case 'typewriter':
      const charsToShow = Math.floor(
        interpolate(frame, [0, fps * 0.5], [0, text.length], {
          extrapolateRight: 'clamp',
        })
      );
      displayText = text.slice(0, charsToShow);
      break;
  }

  const positionStyles: React.CSSProperties = absoluteLayout
    ? {
        position: 'absolute',
        left: absoluteLayout.left,
        top: absoluteLayout.top,
        width: absoluteLayout.width,
        height: absoluteLayout.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }
    : getCustomTextPositionStyles(style, scale);
  const useOuterScaleCustom = !absoluteLayout && isCustomTextPositionWithOuterScale(style);

  const textShadows: string[] = [];
  if (style.strokeWidth > 0) {
    const sw = style.strokeWidth;
    const sc = style.strokeColor;
    textShadows.push(
      `${sw}px 0 0 ${sc}`,
      `-${sw}px 0 0 ${sc}`,
      `0 ${sw}px 0 ${sc}`,
      `0 -${sw}px 0 ${sc}`,
      `${sw}px ${sw}px 0 ${sc}`,
      `-${sw}px ${sw}px 0 ${sc}`,
      `${sw}px -${sw}px 0 ${sc}`,
      `-${sw}px -${sw}px 0 ${sc}`
    );
  }
  const shadowOpacity = style.shadowOpacity ?? 1;
  if (style.shadowBlur > 0 && shadowOpacity > 0) {
    textShadows.push(
      `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${hexToRgba(style.shadowColor, shadowOpacity)}`
    );
  }

  const bgColor = style.backgroundColor;
  const bgOpacity = style.backgroundOpacity;
  let backgroundColor = 'transparent';
  if (bgOpacity > 0 && bgColor !== 'transparent') {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    backgroundColor = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  }

  return (
    <div style={positionStyles}>
      <span
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          opacity,
          transform: !useOuterScaleCustom
            ? `scale(${scale}) translateY(${translateY}px)`
            : translateY !== 0
              ? `translateY(${translateY}px)`
              : undefined,
          color: style.textColor,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontFamily: `${style.fontFamily}, system-ui, sans-serif`,
          fontStyle: style.fontStyle ?? 'normal',
          lineHeight: style.lineHeight ?? 1.2,
          textShadow: textShadows.length > 0 ? textShadows.join(', ') : 'none',
          backgroundColor,
          padding: `${style.paddingY}px ${style.paddingX}px`,
          borderRadius: style.borderRadius,
          whiteSpace: 'pre-wrap',
          textTransform: style.uppercase ? 'uppercase' : undefined,
        }}
      >
        {displayText}
      </span>
    </div>
  );
};

// ============ GOOGLE FONT LOADER ============
// Loads the selected Google Font during render so preview and export use it.

const GoogleFontLoader: React.FC<{
  style: SubtitleStyle;
  children: React.ReactNode;
}> = ({ style, children }) => {
  const needLoad = isGoogleFont(style.fontFamily);
  const [loaded, setLoaded] = useState(!needLoad);
  const handleRef = useRef<number | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();

  if (needLoad && !loaded && handleRef.current === null) {
    handleRef.current = delayRender('Loading Google Font');
  }

  useEffect(() => {
    if (!needLoad || loaded) return;
    const entry = FONTS_LIST.find((f) => f.family === style.fontFamily && f.load);
    if (!entry || !entry.load) {
      if (handleRef.current !== null) {
        continueRender(handleRef.current);
        handleRef.current = null;
      }
      setLoaded(true);
      return;
    }
    let cancelled = false;
    entry
      .load()
      .then((mod) => {
        if (cancelled) return;
        const weight = String(style.fontWeight);
        const result = mod.loadFont?.('normal', {
          weights: [weight],
          subsets: ['latin'],
        });
        return result?.waitUntilDone?.() ?? Promise.resolve();
      })
      .then(() => {
        if (cancelled) return;
        if (handleRef.current !== null) {
          continueRender(handleRef.current);
          handleRef.current = null;
        }
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) cancelRender(err);
      });
    return () => {
      cancelled = true;
    };
  }, [needLoad, loaded, style.fontFamily, style.fontWeight, continueRender, cancelRender]);

  if (needLoad && !loaded) return null;
  return <>{children}</>;
};

// ============ VIDEO VIEWPORT HELPERS (split + full canvas) ============

const COMPOSITION_WIDTH = 1080;
const COMPOSITION_HEIGHT = 1920;

/** Blurred, scaled cover layer behind sharp `object-fit: contain` video (fills letterbox bars). */
const LETTERBOX_BLUR_BACKDROP_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  filter: 'blur(52px) brightness(0.48)',
  transform: 'scale(1.14)',
};

type OffthreadVideoProps = React.ComponentProps<typeof OffthreadVideo>;

/**
 * When letterboxBlur is true, draws the same footage full-bleed blurred behind the sharp contain layer.
 */
function LetterboxVideoWithBlurredBackdrop(
  props: OffthreadVideoProps & {
    letterboxBlur: boolean;
    sharpStyle: React.CSSProperties;
  }
) {
  const { letterboxBlur, sharpStyle, style: _s, ...videoProps } = props;

  if (!letterboxBlur) {
    return <OffthreadVideo {...videoProps} style={sharpStyle} />;
  }

  // Backdrop must stay muted: two decodes already cost CPU/GPU (esp. mobile); a second audio track causes echo.
  const backdropProps = { ...videoProps, volume: 0 as const };

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <OffthreadVideo {...backdropProps} style={LETTERBOX_BLUR_BACKDROP_STYLE} />
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        }}
      >
        <OffthreadVideo {...videoProps} style={sharpStyle} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function getCoverDimensions(
  compositionWidth: number,
  compositionHeight: number,
  videoAspectRatio: number
) {
  const coverWidth =
    compositionHeight * videoAspectRatio > compositionWidth
      ? compositionHeight * videoAspectRatio
      : compositionWidth;
  const coverHeight =
    compositionHeight * videoAspectRatio > compositionWidth
      ? compositionHeight
      : compositionWidth / videoAspectRatio;
  return { coverWidth, coverHeight };
}

function hasCustomVideoTransform(
  t: VideoTransform | undefined
): t is VideoTransform {
  return Boolean(
    t && (t.scale !== 1 || t.offsetX !== 0 || t.offsetY !== 0)
  );
}

function getVideoWrapperStyleForViewport(
  t: VideoTransform,
  compositionWidth: number,
  compositionHeight: number,
  videoAspectRatio: number
): React.CSSProperties {
  const { coverWidth, coverHeight } = getCoverDimensions(
    compositionWidth,
    compositionHeight,
    videoAspectRatio
  );
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: coverWidth * t.scale,
    height: coverHeight * t.scale,
    transform: `translate(calc(-50% + ${t.offsetX}px), calc(-50% + ${t.offsetY}px))`,
  };
}

function getIntrinsicMediaSize(source: CanvasImageSource): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) {
    return { w: source.videoWidth, h: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { w: source.naturalWidth, h: source.naturalHeight };
  }
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { w: source.width, h: source.height };
  }
  if (
    'width' in source &&
    'height' in source &&
    typeof (source as { width: unknown }).width === 'number'
  ) {
    const src = source as { width: number; height: number };
    return { w: src.width, h: src.height };
  }
  return { w: 0, h: 0 };
}

/** Paint one split half to match `<OffthreadVideo>` + wrapper + object-fit in `SplitScreenVideoHalves`. */
function paintSplitHalfToCanvas(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  vw: number,
  vh: number,
  t: VideoTransform,
  videoAspectRatio: number,
  isPortrait: boolean
) {
  const { w: vidW, h: vidH } = getIntrinsicMediaSize(source);
  if (vidW <= 0 || vidH <= 0) {
    return;
  }

  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, vw, vh);
  ctx.beginPath();
  ctx.rect(0, 0, vw, vh);
  ctx.clip();

  const custom = hasCustomVideoTransform(t);
  if (custom) {
    const { coverWidth, coverHeight } = getCoverDimensions(vw, vh, videoAspectRatio);
    const boxW = coverWidth * t.scale;
    const boxH = coverHeight * t.scale;
    const cx = vw / 2 + t.offsetX;
    const cy = vh / 2 + t.offsetY;
    ctx.translate(cx - boxW / 2, cy - boxH / 2);
    const s = Math.max(boxW / vidW, boxH / vidH);
    const dw = vidW * s;
    const dh = vidH * s;
    const dx = (boxW - dw) / 2;
    const dy = (boxH - dh) / 2;
    ctx.drawImage(source, 0, 0, vidW, vidH, dx, dy, dw, dh);
  } else {
    const useCover = isPortrait;
    const s = useCover
      ? Math.max(vw / vidW, vh / vidH)
      : Math.min(vw / vidW, vh / vidH);
    const dw = vidW * s;
    const dh = vidH * s;
    const dx = (vw - dw) / 2;
    const dy = (vh - dh) / 2;
    ctx.drawImage(source, 0, 0, vidW, vidH, dx, dy, dw, dh);
  }
  ctx.restore();
}

function resolveEffectiveSplit(
  segment: VideoSegment | undefined,
  globalSplit: SplitScreenConfig | null | undefined
): SplitScreenConfig | null {
  if (segment?.splitScreen?.enabled) {
    return segment.splitScreen;
  }
  if (globalSplit?.enabled) {
    return globalSplit;
  }
  return null;
}

/**
 * Two stacked halves (1080×960 each) from a single decode: one hidden `<OffthreadVideo>` drives
 * audio + timeline; `onVideoFrame` mirrors the same frame onto two canvases with independent
 * crops so preview and export stay aligned without dual HTML5 clocks.
 */
function SplitScreenVideoHalves({
  src,
  videoStartFrame,
  trimBefore,
  trimAfter,
  useTrim,
  topTransform,
  bottomTransform,
  videoAspectRatio,
  isPortrait,
}: {
  src: string;
  videoStartFrame: number;
  trimBefore: number;
  trimAfter: number;
  useTrim: boolean;
  topTransform: VideoTransform;
  bottomTransform: VideoTransform;
  videoAspectRatio: number;
  isPortrait: boolean;
}) {
  const halfH = COMPOSITION_HEIGHT / 2;
  const canvasTopRef = useRef<HTMLCanvasElement>(null);
  const canvasBottomRef = useRef<HTMLCanvasElement>(null);
  const splitPaintRef = useRef({
    topTransform,
    bottomTransform,
    videoAspectRatio,
    isPortrait,
    halfH,
  });
  splitPaintRef.current = {
    topTransform,
    bottomTransform,
    videoAspectRatio,
    isPortrait,
    halfH,
  };

  const onVideoFrame = useCallback((frame: CanvasImageSource) => {
    const canvasTop = canvasTopRef.current;
    const canvasBottom = canvasBottomRef.current;
    if (!canvasTop || !canvasBottom) {
      return;
    }
    const ctxTop = canvasTop.getContext('2d');
    const ctxBottom = canvasBottom.getContext('2d');
    if (!ctxTop || !ctxBottom) {
      return;
    }
    const { topTransform: tt, bottomTransform: bt, videoAspectRatio: ar, isPortrait: ip, halfH: hh } =
      splitPaintRef.current;
    paintSplitHalfToCanvas(ctxTop, frame, COMPOSITION_WIDTH, hh, tt, ar, ip);
    paintSplitHalfToCanvas(ctxBottom, frame, COMPOSITION_WIDTH, hh, bt, ar, ip);
  }, []);

  const hiddenVideoStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 4,
    height: 4,
    opacity: 0,
    pointerEvents: 'none',
  };

  const videoEl = useTrim ? (
    <OffthreadVideo
      src={src}
      trimBefore={trimBefore}
      trimAfter={trimAfter}
      style={hiddenVideoStyle}
      volume={1}
      pauseWhenBuffering
      onVideoFrame={onVideoFrame}
      showInTimeline={false}
    />
  ) : (
    <OffthreadVideo
      src={src}
      startFrom={videoStartFrame}
      style={hiddenVideoStyle}
      volume={1}
      pauseWhenBuffering
      onVideoFrame={onVideoFrame}
      showInTimeline={false}
    />
  );

  return (
    <>
      {videoEl}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: COMPOSITION_WIDTH,
          height: halfH,
          backgroundColor: '#000',
        }}
      >
        <canvas
          ref={canvasTopRef}
          width={COMPOSITION_WIDTH}
          height={halfH}
          style={{ display: 'block', width: COMPOSITION_WIDTH, height: halfH }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: halfH,
          width: COMPOSITION_WIDTH,
          height: halfH,
          backgroundColor: '#000',
        }}
      >
        <canvas
          ref={canvasBottomRef}
          width={COMPOSITION_WIDTH}
          height={halfH}
          style={{ display: 'block', width: COMPOSITION_WIDTH, height: halfH }}
        />
      </div>
    </>
  );
}

// ============ MAIN COMPOSITION ============

function getDragAbsoluteLayout(
  left: number | undefined,
  top: number | undefined,
  bounds: DragBounds
): DragBounds | undefined {
  if (left == null || top == null) {
    return undefined;
  }
  return { left, top, width: bounds.width, height: bounds.height };
}

export const SubtitleComposition: React.FC<SubtitleCompositionProps> = ({
  videoUrl,
  videoSegments = [],
  subtitles,
  style,
  videoStartFrom = 0,
  subtitleMode = 'word',
  highlightColor = '#facc15', // Yellow by default
  videoTransform,
  videoAspectRatio = 16 / 9,
  customTextSegments = [],
  customTextTracks = [],
  bannerSegments = [],
  bannerTracks = [],
  splitScreenConfig = null,
  selectedItemId = null,
  setSelectedItemId,
  onSubtitlePositionChange,
  onCustomTextPositionChange,
  onBannerPositionChange,
}) => {
  const { fps } = useVideoConfig();
  const videoStartFrame = Math.round((videoStartFrom / 1000) * fps);

  const isPortrait = videoAspectRatio < 0.7;

  const coverWidth =
    COMPOSITION_HEIGHT * videoAspectRatio > COMPOSITION_WIDTH
      ? COMPOSITION_HEIGHT * videoAspectRatio
      : COMPOSITION_WIDTH;
  const coverHeight =
    COMPOSITION_HEIGHT * videoAspectRatio > COMPOSITION_WIDTH
      ? COMPOSITION_HEIGHT
      : COMPOSITION_WIDTH / videoAspectRatio;

  const getVideoWrapperStyleFull = (t: VideoTransform) =>
    hasCustomVideoTransform(t)
      ? {
          position: 'absolute' as const,
          left: '50%',
          top: '50%',
          width: coverWidth * t.scale,
          height: coverHeight * t.scale,
          transform: `translate(calc(-50% + ${t.offsetX}px), calc(-50% + ${t.offsetY}px))`,
        }
      : null;

  // For single-video mode (no segments): use global videoTransform
  const globalHasTransform = hasCustomVideoTransform(videoTransform);
  const globalVideoWrapperStyle =
    globalHasTransform && videoTransform
      ? getVideoWrapperStyleFull(videoTransform)
      : null;

  const videoStyle: React.CSSProperties =
    isPortrait || globalHasTransform
      ? { width: '100%', height: '100%', objectFit: 'cover' }
      : { width: '100%', height: '100%', objectFit: 'contain' };

  const visibleSubtitles = subtitles.filter(
    (s): s is Subtitle => !('isDeleted' in s) || !(s as EnhancedSubtitle).isDeleted
  );

  const useVideoSegments = videoSegments.length > 0;

  const visibleTrackIds = new Set(
    customTextTracks.filter((t) => t.visible).map((t) => t.id)
  );
  const visibleCustomTextSegments = customTextSegments.filter(
    (s) => visibleTrackIds.has(s.trackId) && s.endFrame > s.startFrame
  );

  const visibleBannerTrackIds = new Set(
    bannerTracks.filter((t) => t.visible).map((t) => t.id)
  );
  const visibleBannerSegments = bannerSegments.filter(
    (s) =>
      visibleBannerTrackIds.has(s.trackId) && s.endFrame > s.startFrame
  );

  const globalSplitOn = Boolean(splitScreenConfig?.enabled);

  const interactionEnabled = Boolean(
    onSubtitlePositionChange ?? onCustomTextPositionChange ?? onBannerPositionChange
  );

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!setSelectedItemId) {
        return;
      }
      if (e.button !== 0) {
        return;
      }
      setSelectedItemId(null);
    },
    [setSelectedItemId]
  );

  return (
    <GoogleFontLoader style={style}>
      <AbsoluteFill
        style={{
          backgroundColor: '#000',
          overflow: interactionEnabled ? 'visible' : 'hidden',
        }}
        onPointerDown={
          interactionEnabled && setSelectedItemId ? handleCanvasPointerDown : undefined
        }
      >
        <AbsoluteFill style={{ overflow: 'hidden' }}>
        {useVideoSegments ? (
          videoSegments.map((segment) => {
            const durationFrames = segment.endFrame - segment.startFrame;
            // Guard against zero- or negative-length segments that can be created
            // by edge-case trims. Skip them so Remotion never receives 0 duration.
            if (durationFrames <= 0) {
              return null;
            }
            const effectiveSplit = resolveEffectiveSplit(segment, splitScreenConfig);
            const useSplit = effectiveSplit != null;

            if (useSplit && effectiveSplit) {
              return (
                <Sequence
                  key={segment.id}
                  from={segment.startFrame}
                  durationInFrames={durationFrames}
                  premountFor={Math.min(2 * fps, durationFrames)}
                >
                  <SplitScreenVideoHalves
                    src={segment.sourceVideoUrl}
                    videoStartFrame={videoStartFrame}
                    trimBefore={segment.sourceStartFrame}
                    trimAfter={segment.sourceEndFrame}
                    useTrim
                    topTransform={effectiveSplit.topTransform}
                    bottomTransform={effectiveSplit.bottomTransform}
                    videoAspectRatio={videoAspectRatio}
                    isPortrait={isPortrait}
                  />
                </Sequence>
              );
            }

            const segTransform = segment.transform ?? videoTransform;
            const segHasTransform = hasCustomVideoTransform(segTransform);
            const letterboxBlurSeg = !isPortrait && !segHasTransform;
            const segWrapperStyle =
              segHasTransform && segTransform
                ? getVideoWrapperStyleFull(segTransform)
                : null;
            const segVideoStyle: React.CSSProperties =
              isPortrait || segHasTransform
                ? { width: '100%', height: '100%', objectFit: 'cover' }
                : { width: '100%', height: '100%', objectFit: 'contain' };
            const VideoContent =
              segHasTransform && segWrapperStyle ? (
                <div style={segWrapperStyle}>
                  <OffthreadVideo
                    src={segment.sourceVideoUrl}
                    trimBefore={segment.sourceStartFrame}
                    trimAfter={segment.sourceEndFrame}
                    style={segVideoStyle}
                    pauseWhenBuffering
                  />
                </div>
              ) : (
                <LetterboxVideoWithBlurredBackdrop
                  letterboxBlur={letterboxBlurSeg}
                  sharpStyle={segVideoStyle}
                  src={segment.sourceVideoUrl}
                  trimBefore={segment.sourceStartFrame}
                  trimAfter={segment.sourceEndFrame}
                  pauseWhenBuffering
                />
              );
            return (
              <Sequence
                key={segment.id}
                from={segment.startFrame}
                durationInFrames={durationFrames}
                premountFor={Math.min(2 * fps, durationFrames)}
              >
                {VideoContent}
              </Sequence>
            );
          })
        ) : videoUrl && globalSplitOn && splitScreenConfig ? (
          <SplitScreenVideoHalves
            src={videoUrl}
            videoStartFrame={videoStartFrame}
            trimBefore={0}
            trimAfter={0}
            useTrim={false}
            topTransform={splitScreenConfig.topTransform}
            bottomTransform={splitScreenConfig.bottomTransform}
            videoAspectRatio={videoAspectRatio}
            isPortrait={isPortrait}
          />
        ) : videoUrl ? (
          globalHasTransform && globalVideoWrapperStyle ? (
            <div style={globalVideoWrapperStyle}>
              <OffthreadVideo
                src={videoUrl}
                startFrom={videoStartFrame}
                style={videoStyle}
              />
            </div>
          ) : (
            <LetterboxVideoWithBlurredBackdrop
              letterboxBlur={!isPortrait && !globalHasTransform}
              sharpStyle={videoStyle}
              src={videoUrl}
              startFrom={videoStartFrame}
            />
          )
        ) : null}

        {!videoUrl && !useVideoSegments && (
          <AbsoluteFill
            style={{
              backgroundColor: '#1a1a2e',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div style={{ color: '#444', fontSize: 32, fontFamily: 'system-ui' }}>
              Your video will appear here
            </div>
          </AbsoluteFill>
        )}

        {visibleSubtitles
          .filter((subtitle) => subtitle.endFrame > subtitle.startFrame)
          .map((subtitle) => {
            const subBounds = getSubtitleDragBounds(subtitle.text, style);
            const subtitleAbs = getDragAbsoluteLayout(
              subtitle.left,
              subtitle.top,
              subBounds
            );
            return (
            <Sequence
              key={subtitle.id}
              from={subtitle.startFrame}
              durationInFrames={Math.max(1, subtitle.endFrame - subtitle.startFrame)}
            >
              {subtitleMode === 'segment-background-highlight' && subtitle.words && subtitle.words.length > 0 ? (
                <BackgroundHighlightedSubtitleDisplay
                  words={subtitle.words}
                  style={style}
                  segmentStartMs={subtitle.startFrame * (1000 / fps)}
                  highlightColor={highlightColor}
                  absoluteLayout={subtitleAbs}
                />
              ) : subtitleMode === 'segment-highlight' && subtitle.words && subtitle.words.length > 0 ? (
                <HighlightedSubtitleDisplay
                  words={subtitle.words}
                  style={style}
                  segmentStartMs={subtitle.startFrame * (1000 / fps)}
                  highlightColor={highlightColor}
                  absoluteLayout={subtitleAbs}
                />
              ) : (
                <SubtitleDisplay text={subtitle.text} style={style} absoluteLayout={subtitleAbs} />
              )}
            </Sequence>
          );
          })}

        {visibleCustomTextSegments.map((seg) => {
          const ctBounds = getCustomTextDragBounds(seg.text, seg.style);
          const customAbs = getDragAbsoluteLayout(seg.left, seg.top, ctBounds);
          return (
          <Sequence
            key={seg.id}
            from={seg.startFrame}
            durationInFrames={Math.max(1, seg.endFrame - seg.startFrame)}
          >
            <CustomTextOverlay text={seg.text} style={seg.style} absoluteLayout={customAbs} />
          </Sequence>
        );
        })}

        {visibleBannerSegments.map((seg) => {
          const bBounds = getBannerDragBounds(seg.text, seg.style, seg.logoUrl);
          const bannerAbs =
            seg.left != null && seg.top != null
              ? {
                  left: 0,
                  top: seg.top,
                  width: COMPOSITION_WIDTH,
                  height: bBounds.height,
                }
              : undefined;
          return (
          <Sequence
            key={seg.id}
            from={seg.startFrame}
            durationInFrames={Math.max(1, seg.endFrame - seg.startFrame)}
          >
            <BannerOverlay
              logoUrl={seg.logoUrl}
              text={seg.text}
              style={seg.style}
              absoluteLayout={bannerAbs}
            />
          </Sequence>
        );
        })}
        </AbsoluteFill>
        {interactionEnabled && setSelectedItemId ? (
          <SortedOverlays
            subtitles={visibleSubtitles.filter((s) => s.endFrame > s.startFrame) as Subtitle[]}
            subtitleStyle={style}
            customTextSegments={visibleCustomTextSegments}
            bannerSegments={visibleBannerSegments}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            onSubtitlePositionChange={onSubtitlePositionChange}
            onCustomTextPositionChange={onCustomTextPositionChange}
            onBannerPositionChange={onBannerPositionChange}
          />
        ) : null}
      </AbsoluteFill>
    </GoogleFontLoader>
  );
};

// ============ SIMPLE TEST COMPOSITION ============

export type MyCompositionProps = {
  title: string;
};

export const MyComposition: React.FC<MyCompositionProps> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const scale = interpolate(frame, [0, fps * 0.5], [0.8, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          color: 'white',
          fontSize: 80,
          fontWeight: 'bold',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          color: '#888',
          fontSize: 24,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Frame: {frame}
      </div>
    </AbsoluteFill>
  );
};