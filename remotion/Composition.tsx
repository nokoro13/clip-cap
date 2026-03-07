import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
  OffthreadVideo,
  Easing,
} from 'remotion';

// ============ STYLE TYPES ============

export type SubtitleStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  position: 'top' | 'center' | 'bottom';
  /** Vertical position as percentage from top (0 = top, 100 = bottom). Used when positionY is set. */
  positionY?: number;
  animation: 'none' | 'fade' | 'pop' | 'slide' | 'typewriter';
  borderRadius: number;
  paddingX: number;
  paddingY: number;
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: 56,
  fontWeight: 700,
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.6,
  strokeColor: '#000000',
  strokeWidth: 0,
  shadowColor: '#000000',
  shadowBlur: 8,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  position: 'bottom',
  positionY: 85,
  animation: 'pop',
  borderRadius: 8,
  paddingX: 24,
  paddingY: 12,
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

export type SubtitleMode = 'word' | 'segment' | 'segment-highlight';

export type SubtitleCompositionProps = {
  videoUrl: string | null;
  subtitles: Subtitle[];
  style: SubtitleStyle;
  videoStartFrom?: number;
  subtitleMode?: SubtitleMode; // How to display subtitles
  highlightColor?: string; // Color for highlighted words
};

// ============ POSITION HELPER ============

function getSubtitlePositionStyles(
  style: SubtitleStyle,
  scale: number
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    padding: '0 40px',
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
  if (style.shadowBlur > 0) {
    textShadows.push(
      `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor}`
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
          opacity,
          transform: !isPositionWithOuterScale(style)
            ? `scale(${scale}) translateY(${translateY}px)`
            : translateY !== 0
              ? `translateY(${translateY}px)`
              : undefined,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontFamily: style.fontFamily,
          textShadow: textShadows.length > 0 ? textShadows.join(', ') : 'none',
          backgroundColor,
          padding: `${style.paddingY}px ${style.paddingX}px`,
          borderRadius: style.borderRadius,
          whiteSpace: 'pre-wrap',
        }}
      >
        {words.map((word, index) => {
          const isActive = currentMs >= word.startMs && currentMs < word.endMs;
          const isPast = currentMs >= word.endMs;
          
          return (
            <span
              key={`${word.text}-${index}`}
              style={{
                color: isActive ? highlightColor : style.textColor,
                opacity: isPast ? 0.7 : 1,
                transition: 'color 0.1s ease-out',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                display: 'inline-block',
              }}
            >
              {word.text}
              {index < words.length - 1 ? ' ' : ''}
            </span>
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

  if (style.shadowBlur > 0) {
    textShadows.push(
      `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor}`
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
          textShadow: textShadows.length > 0 ? textShadows.join(', ') : 'none',
          backgroundColor,
          padding: `${style.paddingY}px ${style.paddingX}px`,
          borderRadius: style.borderRadius,
          whiteSpace: 'pre-wrap',
        }}
      >
        {displayText}
      </span>
    </div>
  );
};

// ============ MAIN COMPOSITION ============

export const SubtitleComposition: React.FC<SubtitleCompositionProps> = ({
  videoUrl,
  subtitles,
  style,
  videoStartFrom = 0,
  subtitleMode = 'word',
  highlightColor = '#facc15', // Yellow by default
}) => {
  const { fps } = useVideoConfig();
  const videoStartFrame = Math.round((videoStartFrom / 1000) * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {videoUrl && (
        <OffthreadVideo
          src={videoUrl}
          startFrom={videoStartFrame}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      )}

      {!videoUrl && (
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

      {subtitles
        .filter((subtitle) => subtitle.endFrame > subtitle.startFrame)
        .map((subtitle) => (
          <Sequence
            key={subtitle.id}
            from={subtitle.startFrame}
            durationInFrames={Math.max(1, subtitle.endFrame - subtitle.startFrame)}
          >
            {subtitleMode === 'segment-highlight' && subtitle.words && subtitle.words.length > 0 ? (
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
    </AbsoluteFill>
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
