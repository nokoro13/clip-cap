import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  Easing,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Poppins';
import type { BannerStyle } from '@/components/timeline/types';

const { fontFamily: poppinsFontFamily } = loadFont('normal', {
  weights: ['400', '700'],
  subsets: ['latin'],
});

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function getBannerPositionStyles(
  style: BannerStyle,
  width: number,
  height: number
): React.CSSProperties {
  const positionY = style.positionY ?? 90;

  return {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    top: `${positionY}%`,
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
  };
}

export interface BannerOverlayProps {
  logoUrl: string;
  text: string;
  style: BannerStyle;
}

export const BannerOverlay: React.FC<BannerOverlayProps> = ({
  logoUrl,
  text,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  let opacity = 1;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  const animationFrames = Math.min(fps * 0.3, 9);

  switch (style.animation) {
    case 'fade':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      break;
    case 'slide-up':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      translateY = interpolate(frame, [0, animationFrames], [50, 0], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
      break;
    case 'slide-down':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      translateY = interpolate(frame, [0, animationFrames], [-50, 0], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
      break;
    case 'slide-left':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      translateX = interpolate(frame, [0, animationFrames], [50, 0], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
      break;
    case 'slide-right':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      translateX = interpolate(frame, [0, animationFrames], [-50, 0], {
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
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
    case 'bounce':
      opacity = interpolate(frame, [0, animationFrames], [0, 1], {
        extrapolateRight: 'clamp',
      });
      scale = interpolate(
        frame,
        [0, animationFrames * 0.6, animationFrames],
        [0.5, 1.15, 1],
        {
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        }
      );
      break;
  }

  const containerStyles = getBannerPositionStyles(style, width, height);
  const showLogo = !!logoUrl;

  const boxShadow =
    style.shadowBlur > 0
      ? `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${hexToRgba(style.shadowColor, style.shadowOpacity)}`
      : 'none';

  const backgroundColor = hexToRgba(
    style.backgroundColor,
    style.backgroundOpacity
  );

  return (
    <div style={containerStyles}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          width: '100%',
          opacity,
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
          backgroundColor,
          borderRadius: style.borderRadius,
          padding: `${style.paddingY}px ${style.paddingX}px`,
          boxShadow,
          boxSizing: 'border-box',
        }}
      >
        {showLogo && (
          <div
            style={{
              flexShrink: 0,
              paddingLeft: style.paddingX,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Img
              src={logoUrl}
              style={{
                width: style.logoWidth,
                height: style.logoHeight,
                objectFit: 'contain',
                opacity: style.logoOpacity,
                transform: `scale(${style.logoScale})`,
                borderRadius: style.logoBorderRadius,
              }}
            />
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily: style.fontFamily === 'Poppins' ? poppinsFontFamily : style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              fontStyle: style.fontStyle ?? 'normal',
              color: style.textColor,
              textTransform: style.textTransform ?? 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {text}
          </span>
        </div>
      </div>
    </div>
  );
};
