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

/** Keep preset chips readable; huge composition strokes need not fill the tiny preview. */
const PREVIEW_MAX_STROKE_PX = 5;

function buildTextShadows(style: SubtitleStyle, scale: number): string {
  const textShadows: string[] = [];
  const sw = Math.min(
    PREVIEW_MAX_STROKE_PX,
    Math.max(0, Math.round(style.strokeWidth * scale))
  );
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

/**
 * Effect scale for stroke/shadow/radius hints (composition values → chip).
 * Font size & chip padding stay fixed so preset tiles share one height.
 */
const EFFECT_SCALE = 0.18;

/** Fixed chip metrics — composition `fontSize` / `padding*` must not change tile size. */
const GRID_CHIP_FONT_PX = 13;
const GRID_CHIP_PAD_Y = 4;
const GRID_CHIP_PAD_X = 8;
/** Total preview strip height inside the preset button (single line, clipped). */
const GRID_CHIP_BOX_PX = 36;
const GRID_HI_PAD_Y = 1;
const GRID_HI_PAD_X = 4;
const GRID_HI_RADIUS = 3;

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

  const innerRowStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    maxWidth: "100%",
    overflow: "hidden",
  };

  if (mode === "segment-highlight") {
    return (
      <span style={innerRowStyle}>
        <span style={{ color: style.textColor }}>{first}</span>
        <span style={{ color: highlightColor }}>{second || "\u00a0"}</span>
      </span>
    );
  }
  if (mode === "segment-background-highlight") {
    return (
      <span style={innerRowStyle}>
        <span style={{ color: style.textColor }}>{first}</span>
        <span
          style={{
            color: style.textColor,
            backgroundColor: highlightColor,
            borderRadius: GRID_HI_RADIUS,
            padding: `${GRID_HI_PAD_Y}px ${GRID_HI_PAD_X}px`,
            lineHeight: 1,
          }}
        >
          {second || "\u00a0"}
        </span>
      </span>
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
  const mode: SubtitleMode = preset.subtitleMode ?? "segment-highlight";
  const highlightColor = preset.highlightColor ?? "#facc15";

  const inner = previewInner(mode, style, highlightColor, label);

  const spanStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    height: GRID_CHIP_BOX_PX,
    minHeight: GRID_CHIP_BOX_PX,
    maxHeight: GRID_CHIP_BOX_PX,
    color: style.textColor,
    fontSize: GRID_CHIP_FONT_PX,
    fontWeight: style.fontWeight,
    fontFamily: style.fontFamily,
    fontStyle: style.fontStyle ?? "normal",
    lineHeight: 1,
    wordSpacing:
      style.wordSpacing != null
        ? `${Math.max(0, Math.round(style.wordSpacing * EFFECT_SCALE))}px`
        : undefined,
    textShadow: buildTextShadows(style, EFFECT_SCALE),
    backgroundColor: boxBackground(style),
    padding: `${GRID_CHIP_PAD_Y}px ${GRID_CHIP_PAD_X}px`,
    borderRadius: Math.min(
      8,
      Math.max(0, Math.round(style.borderRadius * EFFECT_SCALE))
    ),
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
    textAlign: "center",
    textTransform: style.uppercase ? "uppercase" : undefined,
  };

  return <span style={spanStyle}>{inner}</span>;
}
