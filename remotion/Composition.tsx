import React, { useEffect, useState, useRef } from 'react';
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
} from '@/components/timeline/types';
import { BannerOverlay } from './BannerOverlay';

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
}> = ({ words, style, segmentStartMs, highlightColor }) => {
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

  const positionStyles = getSubtitlePositionStyles(style, scale);

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
          transform: !isPositionWithOuterScale(style)
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
}> = ({ words, style, segmentStartMs, highlightColor }) => {
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

  const positionStyles = getSubtitlePositionStyles(style, scale);

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
          transform: !isPositionWithOuterScale(style)
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

const SubtitleDisplay: React.FC<{ text: string; style: SubtitleStyle }> = ({
  text,
  style,
}) => {
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

  const positionStyles = getSubtitlePositionStyles(style, scale);

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
          transform: !isPositionWithOuterScale(style)
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
}> = ({ text, style }) => {
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

  const positionStyles = getCustomTextPositionStyles(style, scale);

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
          transform: !isCustomTextPositionWithOuterScale(style)
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

// ============ MAIN COMPOSITION ============

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
}) => {
  const { fps } = useVideoConfig();
  const videoStartFrame = Math.round((videoStartFrom / 1000) * fps);

  const isPortrait = videoAspectRatio < 0.7;

  const hasCustomTransform = (t: VideoTransform | undefined) =>
    t &&
    (t.scale !== 1 || t.offsetX !== 0 || t.offsetY !== 0);

  // Cover math: 16:9 -> fill height; 9:16 -> fill width. Output canvas is always 9:16.
  const COMPOSITION_WIDTH = 1080;
  const COMPOSITION_HEIGHT = 1920;
  const coverWidth =
    COMPOSITION_HEIGHT * videoAspectRatio > COMPOSITION_WIDTH
      ? COMPOSITION_HEIGHT * videoAspectRatio
      : COMPOSITION_WIDTH;
  const coverHeight =
    COMPOSITION_HEIGHT * videoAspectRatio > COMPOSITION_WIDTH
      ? COMPOSITION_HEIGHT
      : COMPOSITION_WIDTH / videoAspectRatio;

  const getVideoWrapperStyle = (t: VideoTransform) =>
    hasCustomTransform(t)
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
  const globalHasTransform = hasCustomTransform(videoTransform);
  const globalVideoWrapperStyle =
    globalHasTransform && videoTransform
      ? getVideoWrapperStyle(videoTransform)
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

  return (
    <GoogleFontLoader style={style}>
      <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
        {useVideoSegments ? (
          videoSegments.map((segment) => {
            const durationFrames = segment.endFrame - segment.startFrame;
            const segTransform = segment.transform ?? videoTransform;
            const segHasTransform = hasCustomTransform(segTransform);
            const segWrapperStyle =
              segHasTransform && segTransform
                ? getVideoWrapperStyle(segTransform)
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
                <OffthreadVideo
                  src={segment.sourceVideoUrl}
                  trimBefore={segment.sourceStartFrame}
                  trimAfter={segment.sourceEndFrame}
                  style={segVideoStyle}
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
            <OffthreadVideo
              src={videoUrl}
              startFrom={videoStartFrame}
              style={videoStyle}
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
          .map((subtitle) => (
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
                />
              ) : subtitleMode === 'segment-highlight' && subtitle.words && subtitle.words.length > 0 ? (
                <HighlightedSubtitleDisplay
                  words={subtitle.words}
                  style={style}
                  segmentStartMs={subtitle.startFrame * (1000 / fps)}
                  highlightColor={highlightColor}
                />
              ) : (
                <SubtitleDisplay text={subtitle.text} style={style} />
              )}
            </Sequence>
          ))}

        {visibleCustomTextSegments.map((seg) => (
          <Sequence
            key={seg.id}
            from={seg.startFrame}
            durationInFrames={Math.max(1, seg.endFrame - seg.startFrame)}
          >
            <CustomTextOverlay text={seg.text} style={seg.style} />
          </Sequence>
        ))}

        {visibleBannerSegments.map((seg) => (
          <Sequence
            key={seg.id}
            from={seg.startFrame}
            durationInFrames={Math.max(1, seg.endFrame - seg.startFrame)}
          >
            <BannerOverlay
              logoUrl={seg.logoUrl}
              text={seg.text}
              style={seg.style}
            />
          </Sequence>
        ))}
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