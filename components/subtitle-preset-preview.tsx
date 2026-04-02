"use client";

import type { CSSProperties, ReactNode } from "react";
import type { SubtitleMode, SubtitleStyle } from "@/remotion/Composition";
import { DEFAULT_SUBTITLE_STYLE } from "@/remotion/Composition";
import type { SubtitlePresetForApply } from "@/lib/user-subtitle-presets";

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function mergePresetToFullStyle(partial: Partial<SubtitleStyle>): SubtitleStyle {
  return { ...DEFAULT_SUBTITLE_STYLE, ...partial };
}

function buildTextShadows(style: SubtitleStyle, scale: number): string {
  const textShadows: string[] = [];
  const sw = Math.max(0, Math.round(style.strokeWidth * scale));
  const sc = style.strokeColor;
  if (sw > 0) {
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
  const blur = Math.max(0, Math.round(style.shadowBlur * scale));
  if (blur > 0 && shadowOpacity > 0) {
    const ox = Math.round(style.shadowOffsetX * scale);
    const oy = Math.round(style.shadowOffsetY * scale);
    textShadows.push(
      `${ox}px ${oy}px ${blur}px ${hexToRgba(style.shadowColor, shadowOpacity)}`
    );
  }
  return textShadows.length > 0 ? textShadows.join(", ") : "none";
}

function boxBackground(style: SubtitleStyle): string {
  const bgOpacity = style.backgroundOpacity ?? 0;
  const bgColor = style.backgroundColor;
  if (
    bgOpacity <= 0.001 ||
    bgColor === "transparent" ||
    !bgColor ||
    typeof bgColor !== "string"
  ) {
    return "transparent";
  }
  const hex = bgColor.replace("#", "");
  if (hex.length !== 6) return "transparent";
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
}

/** Scales composition font/padding to preset grid chips (~1080-based sizes → UI). */
const PREVIEW_SCALE = 0.22;

function previewInner(
  mode: SubtitleMode,
  style: SubtitleStyle,
  highlightColor: string,
  label: string
): ReactNode {
  const t = label.trim() || "Aa";
  const mid = Math.max(1, Math.ceil(t.length / 2));
  const first = t.slice(0, mid);
  const second = t.slice(mid);

  if (mode === "segment-highlight") {
    return (
      <>
        <span style={{ color: style.textColor }}>{first}</span>
        <span style={{ color: highlightColor }}>{second || "\u00a0"}</span>
      </>
    );
  }
  if (mode === "segment-background-highlight") {
    const scale = PREVIEW_SCALE;
    const hiPadY = Math.max(1, Math.round(2 * scale));
    const hiPadX = Math.max(2, Math.round(6 * scale));
    const hiRadius = Math.max(2, Math.round(4 * scale));
    return (
      <>
        <span style={{ color: style.textColor }}>{first}</span>
        <span
          style={{
            color: style.textColor,
            backgroundColor: highlightColor,
            borderRadius: hiRadius,
            padding: `${hiPadY}px ${hiPadX}px`,
          }}
        >
          {second || "\u00a0"}
        </span>
      </>
    );
  }
  return t;
}

export function SubtitlePresetPreviewChip({
  preset,
  label,
}: {
  preset: SubtitlePresetForApply;
  label: string;
}) {
  const style = mergePresetToFullStyle(preset.style);
  const scale = PREVIEW_SCALE;
  const mode: SubtitleMode = preset.subtitleMode ?? "segment-highlight";
  const highlightColor = preset.highlightColor ?? "#facc15";

  const inner = previewInner(mode, style, highlightColor, label);

  const spanStyle: CSSProperties = {
    display: "inline-block",
    maxWidth: "100%",
    color: style.textColor,
    fontSize: Math.max(11, Math.round(style.fontSize * scale)),
    fontWeight: style.fontWeight,
    fontFamily: style.fontFamily,
    fontStyle: style.fontStyle ?? "normal",
    lineHeight: style.lineHeight ?? 1.2,
    wordSpacing:
      style.wordSpacing != null
        ? `${Math.max(0, Math.round(style.wordSpacing * scale))}px`
        : undefined,
    textShadow: buildTextShadows(style, scale),
    backgroundColor: boxBackground(style),
    padding: `${Math.max(0, Math.round(style.paddingY * scale))}px ${Math.max(0, Math.round(style.paddingX * scale))}px`,
    borderRadius: Math.max(0, Math.round(style.borderRadius * scale)),
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
    textTransform: style.uppercase ? "uppercase" : undefined,
  };

  return <span style={spanStyle}>{inner}</span>;
}
