"use client";

import { Player, PlayerRef } from "@remotion/player";
import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { X, Plus, Download, ArrowLeft, Palette, PanelLeftClose, PanelLeft, Captions, Type, Highlighter, SquareCenterlineDashedVerticalIcon, WandSparkles, Pencil, ChevronRight, ChevronDown, Award, PanelBottomClose, PanelBottomOpen, ChartNoAxesGantt, Play, Pause, GripHorizontal } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import {
  SubtitleComposition,
  DEFAULT_SUBTITLE_STYLE,
  type Subtitle,
  type SubtitleStyle,
  type SubtitleMode,
  type WordTiming,
} from "../../../remotion/Composition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ColorPickerInput } from "@/components/color-picker-input";
import { cn } from "@/lib/utils";
import { getVideoBlobUrl } from "@/lib/video-storage";
import {
  FONTS_LIST,
  getFontDisplayName,
  SYSTEM_FONT,
  ALL_FONT_WEIGHTS,
  getWeightsFromFontInfo,
  isGoogleFont,
} from "@/lib/google-fonts-list";
import type { Caption } from "@remotion/captions";
import {
  Timeline,
  type VideoSegment,
  type DeletedRange,
  type EnhancedSubtitle,
  TEXT_TRACK_COLORS,
  BANNER_TRACK_COLORS,
  DeletionDialog,
  getStoredDeletePreference,
} from "@/components/timeline";
import type {
  CustomTextTrack,
  CustomTextSegment,
  CustomTextStyle,
  BannerTrack,
  BannerSegment,
  BannerStyle,
} from "@/components/timeline/types";
import {
  createInitialVideoSegment,
  applyDeletedRangesToSubtitles,
  removeSubtitlesInRangeAndShift,
  updateDeletedRangesAfterCut,
} from "@/lib/timeline-state";
import { VideoCropDialog } from "@/components/video-crop-dialog";

const FPS = 30;

const DEFAULT_CUSTOM_TEXT_STYLE: CustomTextStyle = {
  fontFamily: "Inter",
  fontSize: 60,
  fontWeight: 700,
  fontStyle: "normal",
  lineHeight: 1.2,
  textColor: "#ffffff",
  backgroundColor: "#000000",
  backgroundOpacity: 0.7,
  strokeColor: "#000000",
  strokeWidth: 0,
  shadowColor: "#000000",
  shadowBlur: 8,
  shadowOpacity: 1,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  position: "top",
  positionY: 20,
  animation: "pop",
  borderRadius: 8,
  paddingX: 24,
  paddingY: 16,
  containerMarginX: 40,
  uppercase: false,
};

const DEFAULT_BANNER_STYLE: BannerStyle = {
  layout: "horizontal",
  logoPosition: "left",
  spacing: 16,
  logoWidth: 80,
  logoHeight: 80,
  logoScale: 1.0,
  logoOpacity: 1.0,
  logoBorderRadius: 8,
  fontFamily: "Poppins",
  fontSize: 36,
  fontWeight: 700,
  fontStyle: "normal",
  textColor: "#ffffff",
  textTransform: "none",
  backgroundColor: "#000000",
  backgroundOpacity: 0.8,
  borderRadius: 12,
  paddingX: 20,
  paddingY: 16,
  shadowColor: "#000000",
  shadowBlur: 16,
  shadowOpacity: 0.5,
  shadowOffsetX: 0,
  shadowOffsetY: 4,
  position: "bottom-center",
  positionY: 90,
  marginX: 0,
  marginY: 0,
  animation: "slide-up",
};

const SUBTITLE_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#22c55e",
  "#06b6d4",
];

const PRESET_STYLES: {
  id: string;
  name: string;
  preview: { bg: string; color: string; stroke?: string };
  /** All SubtitleStyle fields supported (font, size, colors, fontStyle, lineHeight, wordSpacing, uppercase, etc.). */
  style: Partial<SubtitleStyle>;
  /** Optional: subtitle display mode (word, segment, segment-highlight, etc.). */
  subtitleMode?: SubtitleMode;
  /** Optional: max words per line for segment modes. */
  maxWordsPerSegment?: number;
  /** Optional: highlight color for segment-highlight / segment-background-highlight. */
  highlightColor?: string;
}[] = [
  {
    id: "clean",
    name: "Clean",
    preview: { bg: "transparent", color: "#fff" },
    style: {
      fontFamily: "Montserrat",
      fontSize: 52,
      fontWeight: 900,
      fontStyle: "normal",
      textColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadowColor: "#000000",
      borderRadius: 4,
      paddingX: 24,
      paddingY: 12,
      shadowBlur: 12,
      shadowOpacity: 1,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      animation: "fade",
      positionY: 70,
      uppercase: true,
      lineHeight: 1.25,
      wordSpacing: 0,
    },
    subtitleMode: "segment-background-highlight",
    maxWordsPerSegment: 3,
    highlightColor: "#ea4453",
  },
  {
    id: "bangers",
    name: "Bangers",
    preview: { bg: "transparent", color: "#fff", stroke: "#000" },
    style: {
      fontFamily: "Bangers",
      fontSize: 72,
      fontWeight: 400,
      fontStyle: "normal",
      textColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadowColor: "#000000",
      borderRadius: 4,
      paddingX: 24,
      paddingY: 12,
      shadowBlur: 12,
      shadowOpacity: 1,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      animation: "pop",
      positionY: 70,
      uppercase: true,
      lineHeight: 1.25,
      wordSpacing: 0,
    },
    subtitleMode: "segment-highlight",
    maxWordsPerSegment: 4,
    highlightColor: "#facc15",
  },
  {
    id: "boxed",
    name: "Boxed",
    preview: { bg: "#000", color: "#fff" },
    style: {
      fontFamily: "Anton",
      fontSize: 96,
      fontWeight: 400,
      fontStyle: "normal",
      textColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadowColor: "#000000",
      borderRadius: 4,
      paddingX: 24,
      paddingY: 12,
      shadowBlur: 12,
      shadowOpacity: 1,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      animation: "pop",
      positionY: 70,
      uppercase: true,
      lineHeight: 1.25,
      wordSpacing: 0,
    },
    subtitleMode: "word",
  },
  {
    id: "classic",
    name: "Classic",
    preview: { bg: "#facc15", color: "#000" },
    style: {
      fontFamily: "Montserrat",
      fontSize: 52,
      fontWeight: 900,
      fontStyle: "normal",
      textColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadowColor: "#000000",
      borderRadius: 4,
      paddingX: 24,
      paddingY: 12,
      shadowBlur: 12,
      shadowOpacity: 1,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      animation: "fade",
      positionY: 70,
      uppercase: true,
      lineHeight: 1.25,
      wordSpacing: 0,
    },
    subtitleMode: "segment-highlight",
    maxWordsPerSegment: 3,
    highlightColor: "#facc15",
  },
  {
    id: "neon",
    name: "Neon",
    preview: { bg: "transparent", color: "#0ff" },
    style: {
      fontFamily: "Montserrat",
      fontSize: 64,
      fontWeight: 900,
      fontStyle: "normal",
      textColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      strokeColor: "#000000",
      shadowColor: "#00ffff",
      borderRadius: 4,
      paddingX: 24,
      paddingY: 12,
      shadowBlur: 12,
      shadowOpacity: 1,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      animation: "fade",
      positionY: 80,
      uppercase: true,
      lineHeight: 1.25,
      wordSpacing: 0,
		containerMarginX: 200,
    },
    subtitleMode: "segment-highlight",
    maxWordsPerSegment: 3,
    highlightColor: "#00ffff",
  },
  {
    id: "bold-red",
    name: "Bold",
    preview: { bg: "#ef4444", color: "#fff" },
    style: {
      fontFamily: "Anton",
      fontSize: 64,
      fontWeight: 400,
      textColor: "#ffffff",
      backgroundColor: "#ef4444",
      backgroundOpacity: 1,
      strokeWidth: 0,
      borderRadius: 0,
      animation: "pop",
    },
  },
  {
    id: "youtube",
    name: "YouTube",
    preview: { bg: "#1a1a1a", color: "#fff" },
    style: {
      fontFamily: "Roboto",
      fontSize: 48,
      fontWeight: 400,
      textColor: "#ffffff",
      backgroundColor: "#000000",
      backgroundOpacity: 0.75,
      strokeWidth: 0,
      borderRadius: 4,
      paddingX: 16,
      paddingY: 8,
      animation: "fade",
    },
    subtitleMode: "segment",
    maxWordsPerSegment: 10,
  },
  {
    id: "minimal",
    name: "Minimal",
    preview: { bg: "transparent", color: "#fff" },
    style: {
      fontFamily: "Nunito",
      fontSize: 42,
      fontWeight: 500,
      textColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowBlur: 14,
      shadowColor: "#000000",
      animation: "fade",
    },
  },
  {
    id: "punchy",
    name: "Punchy",
    preview: { bg: "transparent", color: "#fff", stroke: "#000" },
    style: {
      fontFamily: "Bangers",
      fontSize: 60,
      fontWeight: 400,
      textColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeColor: "#000000",
      strokeWidth: 3,
      shadowBlur: 0,
      animation: "pop",
    },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    preview: { bg: "transparent", color: "#fef08a", stroke: "#000" },
    style: {
      fontFamily: "Barlow",
      fontSize: 54,
      fontWeight: 700,
      textColor: "#fef08a",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeColor: "#000000",
      strokeWidth: 2,
      shadowBlur: 0,
      animation: "pop",
    },
  },
  {
    id: "soft-glow",
    name: "Soft Glow",
    preview: { bg: "transparent", color: "#fff" },
    style: {
      fontFamily: "Raleway",
      fontSize: 52,
      fontWeight: 600,
      textColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowColor: "#ffffff",
      shadowBlur: 24,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      animation: "fade",
    },
  },
  {
    id: "lower-third",
    name: "Lower Third",
    preview: { bg: "#0f172a", color: "#e2e8f0" },
    style: {
      fontFamily: "Fira Sans Condensed",
      fontSize: 40,
      fontWeight: 600,
      textColor: "#e2e8f0",
      backgroundColor: "#0f172a",
      backgroundOpacity: 0.9,
      strokeWidth: 0,
      borderRadius: 0,
      paddingX: 20,
      paddingY: 10,
      positionY: 88,
      animation: "slide",
    },
  },
  {
    id: "elegant",
    name: "Elegant",
    preview: { bg: "transparent", color: "#f8fafc" },
    style: {
      fontFamily: "EB Garamond",
      fontSize: 44,
      fontWeight: 400,
      textColor: "#f8fafc",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowBlur: 16,
      shadowColor: "#000000",
      animation: "fade",
    },
  },
  {
    id: "typewriter",
    name: "Typewriter",
    preview: { bg: "transparent", color: "#fff" },
    style: {
      fontFamily: "Noto Sans",
      fontSize: 50,
      fontWeight: 500,
      textColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowBlur: 8,
      animation: "typewriter",
    },
  },
  {
    id: "instagram",
    name: "Instagram",
    preview: { bg: "transparent", color: "#fff" },
    style: {
      fontFamily: "Poppins",
      fontSize: 56,
      fontWeight: 600,
      textColor: "#ffffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowColor: "#000000",
      shadowBlur: 10,
      shadowOffsetX: 1,
      shadowOffsetY: 1,
      animation: "pop",
    },
  },
  {
    id: "documentary",
    name: "Documentary",
    preview: { bg: "#0c0c0c", color: "#d4d4d4" },
    style: {
      fontFamily: "IMFell",
      fontSize: 38,
      fontWeight: 400,
      textColor: "#d4d4d4",
      backgroundColor: "#0c0c0c",
      backgroundOpacity: 0.85,
      strokeWidth: 0,
      borderRadius: 2,
      paddingX: 18,
      paddingY: 8,
      animation: "fade",
    },
  },
  {
    id: "neon-pink",
    name: "Neon Pink",
    preview: { bg: "transparent", color: "#ec4899" },
    style: {
      fontFamily: "Gabarito",
      fontSize: 58,
      fontWeight: 700,
      textColor: "#ec4899",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowColor: "#ec4899",
      shadowBlur: 22,
      animation: "pop",
    },
  },
  {
    id: "chalk",
    name: "Chalk",
    preview: { bg: "transparent", color: "#fef3c7", stroke: "#78716c" },
    style: {
      fontFamily: "Dancing Script",
      fontSize: 52,
      fontWeight: 600,
      textColor: "#fef3c7",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeColor: "#78716c",
      strokeWidth: 1,
      shadowBlur: 4,
      animation: "fade",
    },
  },
];

/** Default platform logos from Simple Icons CDN (SVG, free to use) */
const PLATFORM_LOGO_URLS = {
  instagram: "https://cdn.simpleicons.org/instagram/E1306C",
  youtube: "https://cdn.simpleicons.org/youtube/FF0033",
  twitch: "https://cdn.simpleicons.org/twitch/9146ff",
  kick: "https://cdn.simpleicons.org/kick/53FC18",
} as const;

const BANNER_PRESETS: {
  id: string;
  name: string;
  logoUrl: string;
  style: BannerStyle;
}[] = [
  {
    id: "instagram",
    name: "Instagram",
    logoUrl: PLATFORM_LOGO_URLS.instagram,
    style: {
      layout: "horizontal",
      logoPosition: "left",
      spacing: 16,
      logoWidth: 86,
      logoHeight: 86,
      logoScale: 1.0,
      logoOpacity: 1.0,
      logoBorderRadius: 8,
      fontFamily: "Poppins",
      fontSize: 36,
      fontWeight: 800,
      fontStyle: "normal",
      textColor: "#000000",
      textTransform: "uppercase",
      backgroundColor: "#ffffff",
      backgroundOpacity: 1,
      borderRadius: 0,
      paddingX: 24,
      paddingY: 16,
      shadowColor: "#000000",
      shadowBlur: 0,
      shadowOpacity: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      position: "bottom-center",
      positionY: 31,
      marginX: 0,
      marginY: 0,
      animation: "slide-up",
    },
  },
  {
    id: "youtube",
    name: "YouTube",
    logoUrl: PLATFORM_LOGO_URLS.youtube,
    style: {
      layout: "horizontal",
      logoPosition: "left",
      spacing: 16,
      logoWidth: 86,
      logoHeight: 86,
      logoScale: 1.0,
      logoOpacity: 1.0,
      logoBorderRadius: 8,
      fontFamily: "Poppins",
      fontSize: 36,
      fontWeight: 800,
      fontStyle: "normal",
      textColor: "#000000",
      textTransform: "uppercase",
      backgroundColor: "#ffffff",
      backgroundOpacity: 1,
      borderRadius: 0,
      paddingX: 12,
      paddingY: 0,
      shadowColor: "#000000",
      shadowBlur: 0,
      shadowOpacity: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      position: "bottom-center",
      positionY: 31,
      marginX: 0,
      marginY: 0,
      animation: "slide-up",
    },
  },
  {
    id: "twitch",
    name: "Twitch",
    logoUrl: PLATFORM_LOGO_URLS.twitch,
    style: {
      layout: "horizontal",
      logoPosition: "left",
      spacing: 16,
      logoWidth: 86,
      logoHeight: 86,
      logoScale: 1.0,
      logoOpacity: 1.0,
      logoBorderRadius: 8,
      fontFamily: "Poppins",
      fontSize: 36,
      fontWeight: 800,
      fontStyle: "normal",
      textColor: "#ffffff",
      textTransform: "uppercase",
      backgroundColor: "#000000",
      backgroundOpacity: 1,
      borderRadius: 0,
      paddingX: 28,
      paddingY: 16,
      shadowColor: "#000000",
      shadowBlur: 0,
      shadowOpacity: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      position: "bottom-center",
      positionY: 31,
      marginX: 0,
      marginY: 0,
      animation: "slide-up",
    },
  },
  {
    id: "kick",
    name: "Kick",
    logoUrl: PLATFORM_LOGO_URLS.kick,
    style: {
      layout: "horizontal",
      logoPosition: "left",
      spacing: 16,
      logoWidth: 86,
      logoHeight: 86,
      logoScale: 1.0,
      logoOpacity: 1.0,
      logoBorderRadius: 8,
      fontFamily: "Poppins",
      fontSize: 36,
      fontWeight: 800,
      fontStyle: "normal",
      textColor: "#ffffff",
      textTransform: "uppercase",
      backgroundColor: "#000000",
      backgroundOpacity: 1,
      borderRadius: 0,
      paddingX: 28,
      paddingY: 16,
      shadowColor: "#000000",
      shadowBlur: 0,
      shadowOpacity: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      position: "bottom-center",
      positionY: 31,
      marginX: 0,
      marginY: 0,
      animation: "slide-up",
    },
  },
];

function msToFrame(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

// Convert word-level captions to subtitles (one word at a time)
function captionsToSubtitles(captions: Caption[], fps: number): Subtitle[] {
  return captions
    .map((caption, index) => {
      const startFrame = msToFrame(caption.startMs, fps);
      const endFrame = msToFrame(caption.endMs, fps);
      const adjustedEndFrame =
        endFrame <= startFrame ? startFrame + 1 : endFrame;
      return {
        id: `subtitle-${index}-${caption.startMs}`,
        text: caption.text.trim(),
        startFrame,
        endFrame: adjustedEndFrame,
      };
    })
    .filter((sub) => sub.text.length > 0);
}

// Segment caption type from API
type SegmentCaption = {
  startMs: number;
  endMs: number;
  text: string;
  words: Array<{ text: string; startMs: number; endMs: number }>;
};

// Convert segment captions (with word timings) to subtitles for highlighting mode
function segmentCaptionsToSubtitles(
  segments: SegmentCaption[],
  fps: number
): Subtitle[] {
  return segments
    .map((segment, index) => {
      const startFrame = msToFrame(segment.startMs, fps);
      const endFrame = msToFrame(segment.endMs, fps);
      const adjustedEndFrame =
        endFrame <= startFrame ? startFrame + 1 : endFrame;
      return {
        id: `segment-${index}-${segment.startMs}`,
        text: segment.text.trim(),
        startFrame,
        endFrame: adjustedEndFrame,
        words: segment.words.map((w) => ({
          ...w,
          text: w.text.trim(),
        })),
      };
    })
    .filter((sub) => sub.text.length > 0);
}

// Split a segment into smaller segments based on max words
function splitSegmentByMaxWords(
  segment: Subtitle,
  maxWords: number,
  fps: number
): Subtitle[] {
  if (!segment.words || segment.words.length <= maxWords) {
    return [segment];
  }

  const result: Subtitle[] = [];
  const words = segment.words;

  for (let i = 0; i < words.length; i += maxWords) {
    const chunkWords = words.slice(i, Math.min(i + maxWords, words.length));
    if (chunkWords.length === 0) continue;

    const startMs = chunkWords[0].startMs;
    const endMs = chunkWords[chunkWords.length - 1].endMs;
    const startFrame = msToFrame(startMs, fps);
    const endFrame = msToFrame(endMs, fps);

    result.push({
      id: `${segment.id}-chunk-${i}`,
      text: chunkWords.map((w) => w.text.trim()).join(" "),
      startFrame,
      endFrame: endFrame <= startFrame ? startFrame + 1 : endFrame,
      words: chunkWords.map((w) => ({ ...w, text: w.text.trim() })),
    });
  }

  return result;
}

// Apply max words limit to all segments
function applyMaxWordsToSegments(
  segments: Subtitle[],
  maxWords: number,
  fps: number
): Subtitle[] {
  return segments.flatMap((segment) =>
    splitSegmentByMaxWords(segment, maxWords, fps)
  );
}

// Group word-level captions into segments (for when segmentCaptions aren't available)
// Groups words by time gaps or by max word count
function groupWordsIntoSegments(
  captions: Caption[],
  fps: number,
  maxWordsPerGroup = 6
): Subtitle[] {
  if (captions.length === 0) return [];

  const segments: Subtitle[] = [];
  let currentGroup: Caption[] = [];
  let groupStartMs = captions[0].startMs;

  for (let i = 0; i < captions.length; i++) {
    const caption = captions[i];
    const prevCaption = i > 0 ? captions[i - 1] : null;

    // Check if we should start a new group:
    // 1. Gap between words > 500ms
    // 2. Current group has max words
    // 3. Word ends with sentence-ending punctuation
    const timeSincePrev = prevCaption ? caption.startMs - prevCaption.endMs : 0;
    const prevEndsWithPunctuation =
      prevCaption && /[.!?]$/.test(prevCaption.text.trim());

    if (
      currentGroup.length > 0 &&
      (timeSincePrev > 500 ||
        currentGroup.length >= maxWordsPerGroup ||
        prevEndsWithPunctuation)
    ) {
      // Save current group
      const lastCaption = currentGroup[currentGroup.length - 1];
      const startFrame = msToFrame(groupStartMs, fps);
      const endFrame = msToFrame(lastCaption.endMs, fps);

      segments.push({
        id: `grouped-${segments.length}-${groupStartMs}`,
        text: currentGroup
          .map((c) => c.text.trim())
          .join(" ")
          .trim(),
        startFrame,
        endFrame: endFrame <= startFrame ? startFrame + 1 : endFrame,
        words: currentGroup.map((c) => ({
          text: c.text.trim(),
          startMs: c.startMs,
          endMs: c.endMs,
        })),
      });

      // Start new group
      currentGroup = [caption];
      groupStartMs = caption.startMs;
    } else {
      currentGroup.push(caption);
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    const lastCaption = currentGroup[currentGroup.length - 1];
    const startFrame = msToFrame(groupStartMs, fps);
    const endFrame = msToFrame(lastCaption.endMs, fps);

    segments.push({
      id: `grouped-${segments.length}-${groupStartMs}`,
      text: currentGroup
        .map((c) => c.text.trim())
        .join(" ")
        .trim(),
      startFrame,
      endFrame: endFrame <= startFrame ? startFrame + 1 : endFrame,
      words: currentGroup.map((c) => ({
        text: c.text.trim(),
        startMs: c.startMs,
        endMs: c.endMs,
      })),
    });
  }

  return segments.filter((s) => s.text.length > 0);
}

export default function EditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const playerRef = useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(300); // Default 10 seconds at 30fps
  const [videoStartFrom, setVideoStartFrom] = useState(0); // Start offset in ms for clips
  const [isLoading, setIsLoading] = useState(true);
  const [subtitles, setSubtitles] = useState<EnhancedSubtitle[]>([]);
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [customizePanelOpen, setCustomizePanelOpen] = useState(false);
  /** Weights supported by the currently selected font (for Google Fonts). */
  const [availableWeights, setAvailableWeights] = useState<number[]>([
    400, 700,
  ]);
  const [leftPanelWidth, setLeftPanelWidth] = useState(334);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(360);
  const [resizingPanel, setResizingPanel] = useState(false);
  const [resizingBottomPanel, setResizingBottomPanel] = useState(false);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const bottomResizeStartRef = useRef<{ y: number; height: number } | null>(null);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [selectedVideoSegment, setSelectedVideoSegment] = useState<string | null>(null);
  const [videoSegments, setVideoSegments] = useState<VideoSegment[]>([]);
  const [deletedRanges, setDeletedRanges] = useState<DeletedRange[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteSubtitleId, setPendingDeleteSubtitleId] = useState<string | null>(null);
  const [subtitleMode, setSubtitleMode] =
    useState<SubtitleMode>("segment-highlight");
  const [highlightColor, setHighlightColor] = useState("#facc15"); // Yellow default
  const [wordSubtitles, setWordSubtitles] = useState<Subtitle[]>([]); // Word-by-word subtitles
  const [segmentSubtitles, setSegmentSubtitles] = useState<Subtitle[]>([]); // Segment subtitles with word timings
  const [maxWordsPerSegment, setMaxWordsPerSegment] = useState(8); // Max words before splitting
  const [rawSegmentSubtitles, setRawSegmentSubtitles] = useState<Subtitle[]>(
    []
  ); // Original segments before splitting
  const [experienceId, setExperienceId] = useState<string | null>(null); // For back navigation
  const [sourceProjectId, setSourceProjectId] = useState<string | null>(null); // For navigating back to gallery when editing clips
  const [videoTransform, setVideoTransform] = useState({
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
  });
  const [videoAspectRatio, setVideoAspectRatio] = useState<number>(16 / 9);
  const [showCropDialog, setShowCropDialog] = useState(false);
  /** When opening crop dialog: url/trim for preview; segmentId when cropping a specific segment */
  const [cropDialogClip, setCropDialogClip] = useState<{
    url: string;
    trimStartSeconds: number;
    trimEndSeconds?: number;
    segmentId?: string;
  } | null>(null);
  const [customTextTracks, setCustomTextTracks] = useState<CustomTextTrack[]>([]);
  const [customTextSegments, setCustomTextSegments] = useState<CustomTextSegment[]>([]);
  const [selectedTextSegment, setSelectedTextSegment] = useState<string | null>(null);
  const [bannerTracks, setBannerTracks] = useState<BannerTrack[]>([]);
  const [bannerSegments, setBannerSegments] = useState<BannerSegment[]>([]);
  const [selectedBannerSegment, setSelectedBannerSegment] = useState<string | null>(null);
  const [leftPanelTab, setLeftPanelTab] = useState<"styling" | "subtitles" | "text" | "banners">("styling");
  const [mobilePanelTab, setMobilePanelTab] = useState<
    "" | "styling" | "subtitles" | "text" | "banners" | "timeline"
  >("");
  const [mobileTabsContentHeight, setMobileTabsContentHeight] = useState<number | null>(null);
  const [resizingMobileTabs, setResizingMobileTabs] = useState(false);
  const [skipMobileTabsCloseTransition, setSkipMobileTabsCloseTransition] = useState(false);
  const mobileTabsContentRef = useRef<HTMLDivElement | null>(null);
  const mobileTabsResizeStartRef = useRef<{ y: number; height: number } | null>(
    null
  );
  const mobilePanelTabPrevRef = useRef<
    "" | "styling" | "subtitles" | "text" | "banners" | "timeline"
  >("styling");
  const [collapsedTextTrackIds, setCollapsedTextTrackIds] = useState<Set<string>>(new Set());
  const [collapsedBannerTrackIds, setCollapsedBannerTrackIds] = useState<Set<string>>(new Set());
  const [bannerPresetPopoverTrackId, setBannerPresetPopoverTrackId] = useState<string | null>(null);
  const [bannerEditorMoreOptionsOpen, setBannerEditorMoreOptionsOpen] = useState(false);

  // Sync isPlaying with Remotion player (for mobile play control below video)
  useEffect(() => {
    if (!playerRef?.current) return;
    const player = playerRef.current;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [videoUrl, videoDuration]);

  // --- Mobile tabs resizable content (max 50vh) ---
  const handleMobileTabsResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setResizingMobileTabs(true);
      const y = "touches" in e ? e.touches[0].clientY : e.clientY;
      const currentHeight =
        mobileTabsContentHeight ??
        mobileTabsContentRef.current?.offsetHeight ??
        Math.min(300, Math.floor(window.innerHeight * 0.5));

      mobileTabsResizeStartRef.current = { y, height: currentHeight };

      // First drag from auto mode locks in current pixel height
      if (mobileTabsContentHeight === null) {
        setMobileTabsContentHeight(currentHeight);
      }
    },
    [mobileTabsContentHeight]
  );

  useEffect(() => {
    if (!resizingMobileTabs) return;

    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    document.body.style.touchAction = "none";
    document.body.style.overscrollBehavior = "none";

    const getY = (e: MouseEvent | TouchEvent) =>
      "touches" in e
        ? (e as TouchEvent).touches[0].clientY
        : (e as MouseEvent).clientY;

    const onMove = (e: MouseEvent | TouchEvent) => {
      if ("touches" in e) e.preventDefault();
      const start = mobileTabsResizeStartRef.current;
      if (!start || !mobileTabsContentRef.current) return;

      const currentY = getY(e);
      const delta = start.y - currentY; // drag up = increase height
      const rawNextHeight = start.height + delta;

      // If dragged fully closed, snap to 0 and close the panel (no transition)
      if (rawNextHeight <= 0) {
        setSkipMobileTabsCloseTransition(true);
        setMobileTabsContentHeight(null);
        setMobilePanelTab("");
        setResizingMobileTabs(false);
        mobileTabsResizeStartRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.body.style.touchAction = "";
        document.body.style.overscrollBehavior = "";
        return;
      }

      const maxHeight = Math.floor(window.innerHeight * 0.5); // hard cap at 50vh
      const nextHeight = Math.min(
        maxHeight,
        Math.max(0, rawNextHeight)
      );

      setMobileTabsContentHeight(nextHeight);
      mobileTabsResizeStartRef.current = { y: currentY, height: nextHeight };
    };

    const onUp = () => {
      setResizingMobileTabs(false);
      mobileTabsResizeStartRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
      document.body.style.overscrollBehavior = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
      document.body.style.overscrollBehavior = "";
    };
  }, [resizingMobileTabs]);

  // Reset to auto height when closing/switching mobile tab
  useEffect(() => {
    if (!mobilePanelTab) {
      setMobileTabsContentHeight(null);
      setSkipMobileTabsCloseTransition(false); // re-enable transition for next open/close
    }
  }, [mobilePanelTab]);

  // Track previous mobile tab for smooth close transition (avoid flash)
  useEffect(() => {
    if (mobilePanelTab) {
      mobilePanelTabPrevRef.current = mobilePanelTab;
    }
  }, [mobilePanelTab]);

  // Load video and captions from URL params or localStorage
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);

      // Try to get video URL from search params
      const urlParam = searchParams.get("videoUrl");
      const blobUrl = searchParams.get("blobUrl");
      const captionsParam = searchParams.get("captions");
      const durationParam = searchParams.get("duration");

      // Check localStorage for project data
      const projectId = params.id as string;
      const storedProject = localStorage.getItem(`project-${projectId}`);

      // Resolve video URL: prefer IndexedDB (fresh blob URL that survives refresh). Blob URLs in
      // sessionStorage/localStorage are invalid after refresh. For clips, video is stored under sourceProjectId.
      let initialVideoUrl: string | null = null;
      let parsedProject: { sourceProjectId?: string; youtubeVideoId?: string } | null = null;
      if (storedProject) {
        try {
          parsedProject = JSON.parse(storedProject);
        } catch {
          // ignore
        }
      }

      if (projectId) {
        const fromIdb = await getVideoBlobUrl(projectId);
        if (fromIdb) {
          initialVideoUrl = fromIdb;
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(`video-${projectId}`, fromIdb);
          }
        }
      }
      // For clips, video blob is stored under source project id, not clip id
      if (!initialVideoUrl && parsedProject?.sourceProjectId) {
        const fromSourceIdb = await getVideoBlobUrl(parsedProject.sourceProjectId);
        if (fromSourceIdb) {
          initialVideoUrl = fromSourceIdb;
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(`video-${projectId}`, fromSourceIdb);
          }
        }
      }
      if (!initialVideoUrl && typeof sessionStorage !== "undefined") {
        const fromSession = sessionStorage.getItem(`video-${projectId}`);
        // Skip blob URLs - they're invalid after refresh
        if (fromSession && !fromSession.startsWith("blob:")) {
          initialVideoUrl = fromSession;
        }
      }
      if (!initialVideoUrl && storedProject) {
        try {
          const p = JSON.parse(storedProject);
          const storedUrl = p.videoUrl || p.blobUrl || null;
          if (storedUrl && !storedUrl.startsWith("blob:")) {
            initialVideoUrl = storedUrl;
          }
        } catch {
          // ignore
        }
      }
      // For YouTube-sourced clips, use our stream proxy (raw yt-dlp URLs are blocked in browser by CORS).
      if (storedProject && parsedProject?.youtubeVideoId) {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        initialVideoUrl = `${origin}/api/youtube-stream/${parsedProject.youtubeVideoId}`;
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(`video-${projectId}`, initialVideoUrl);
        }
      }
      if (initialVideoUrl) setVideoUrl(initialVideoUrl);

      if (storedProject) {
        try {
          const project = JSON.parse(storedProject);

          // Load word-level captions (always available)
          let words: Subtitle[] = [];
          if (project.captions && project.captions.length > 0) {
            words = captionsToSubtitles(project.captions, FPS);
            setWordSubtitles(words);
          }

          // Load segment captions with word timings
          let rawSegments: Subtitle[] = [];
          if (project.segmentCaptions && project.segmentCaptions.length > 0) {
            // Use segment captions from API (best quality)
            rawSegments = segmentCaptionsToSubtitles(
              project.segmentCaptions,
              FPS
            );
          } else if (project.captions && project.captions.length > 0) {
            // No segment captions - create them by grouping words (with high limit)
            rawSegments = groupWordsIntoSegments(project.captions, FPS, 50);
          }

          if (rawSegments.length > 0) {
            // Store raw segments for re-splitting later
            setRawSegmentSubtitles(rawSegments);
            // Apply max words limit
            const splitSegments = applyMaxWordsToSegments(
              rawSegments,
              maxWordsPerSegment,
              FPS
            );
            setSegmentSubtitles(splitSegments);
            setSubtitles(splitSegments);
            setSubtitleMode("segment-highlight");
          } else if (words.length > 0) {
            // Fallback to word mode if no segments
            setSubtitles(words);
            setSubtitleMode("word");
          }

          if (project.duration) {
            setVideoDuration(Math.ceil(project.duration * FPS));
          }
          // Handle clip offset (when editing a clip from a longer video)
          if (project.clipStartMs) {
            setVideoStartFrom(project.clipStartMs);
          }

          // Store experienceId for back navigation
          if (project.experienceId) {
            setExperienceId(project.experienceId);
          }

          // Store sourceProjectId for navigating back to gallery when editing clips
          if (project.sourceProjectId) {
            setSourceProjectId(project.sourceProjectId);
          }

          // Load video transform and aspect ratio
          if (project.videoTransform) {
            setVideoTransform(project.videoTransform);
          }
          if (
            typeof project.videoAspectRatio === "number" &&
            project.videoAspectRatio > 0
          ) {
            setVideoAspectRatio(project.videoAspectRatio);
          }

          // Load custom text tracks and segments
          if (project.customTextTracks && Array.isArray(project.customTextTracks)) {
            setCustomTextTracks(project.customTextTracks);
          }
          if (project.customTextSegments && Array.isArray(project.customTextSegments)) {
            setCustomTextSegments(project.customTextSegments);
          }
          if (project.bannerTracks && Array.isArray(project.bannerTracks)) {
            setBannerTracks(project.bannerTracks);
          }
          if (project.bannerSegments && Array.isArray(project.bannerSegments)) {
            setBannerSegments(project.bannerSegments);
          }
        } catch (e) {
          console.error("Failed to parse stored project:", e);
        }
      }

      // URL params override stored data
      if (urlParam) {
        setVideoUrl(decodeURIComponent(urlParam));
      }
      if (blobUrl) {
        setVideoUrl(decodeURIComponent(blobUrl));
      }
      if (captionsParam) {
        try {
          const captions: Caption[] = JSON.parse(
            decodeURIComponent(captionsParam)
          );
          setSubtitles(captionsToSubtitles(captions, FPS));
        } catch (e) {
          console.error("Failed to parse captions:", e);
        }
      }
      if (durationParam) {
        const duration = parseFloat(durationParam);
        if (!isNaN(duration)) {
          setVideoDuration(Math.ceil(duration * FPS));
        }
      }

      // Add demo subtitles if none loaded
      if (!captionsParam && !storedProject) {
        setSubtitles([
          { id: "1", text: "Welcome to ClipCap!", startFrame: 0, endFrame: 60 },
          {
            id: "2",
            text: "Style your subtitles",
            startFrame: 75,
            endFrame: 150,
          },
          {
            id: "3",
            text: "Just like TikTok!",
            startFrame: 165,
            endFrame: 240,
          },
        ]);
      }

      setIsLoading(false);
    };

    loadData();
  }, [params.id, searchParams]);

  // Derived duration: when we have video segments, use their total; otherwise use videoDuration
  const compositionDuration =
    videoSegments.length > 0
      ? Math.max(0, ...videoSegments.map((s) => s.endFrame))
      : videoDuration;

  // Initialize video segments when video loads
  useEffect(() => {
    if (videoUrl && videoDuration > 0) {
      const projectId = params.id as string;
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem(`project-${projectId}`) : null;
      if (stored) {
        try {
          const project = JSON.parse(stored);
          if (project.videoSegments && Array.isArray(project.videoSegments) && project.videoSegments.length > 0) {
            setVideoSegments(project.videoSegments);
          } else {
            // When editing a clip from a project, source video is the full video - use clipStartMs to trim to the correct portion
            const sourceStartFrame =
              project.clipStartMs != null
                ? Math.round((project.clipStartMs / 1000) * FPS)
                : 0;
            setVideoSegments([
              createInitialVideoSegment(
                videoUrl,
                videoDuration,
                sourceStartFrame,
                project.videoTransform
              ),
            ]);
          }
          if (project.deletedRanges && Array.isArray(project.deletedRanges)) {
            setDeletedRanges(project.deletedRanges);
          }
        } catch {
          const sourceStartFrame =
            videoStartFrom > 0 ? Math.round((videoStartFrom / 1000) * FPS) : 0;
          setVideoSegments([
            createInitialVideoSegment(videoUrl, videoDuration, sourceStartFrame),
          ]);
        }
      } else {
        const sourceStartFrame =
          videoStartFrom > 0 ? Math.round((videoStartFrom / 1000) * FPS) : 0;
        setVideoSegments([
          createInitialVideoSegment(videoUrl, videoDuration, sourceStartFrame),
        ]);
      }
    } else {
      setVideoSegments([]);
    }
  }, [videoUrl, videoDuration, videoStartFrom, params.id]);

  // Persist videoTransform, videoAspectRatio, videoSegments, deletedRanges to project in localStorage
  useEffect(() => {
    const projectId = params.id as string;
    if (!projectId || typeof localStorage === "undefined") return;
    const stored = localStorage.getItem(`project-${projectId}`);
    if (!stored) return;
    try {
      const project = JSON.parse(stored);
      localStorage.setItem(
        `project-${projectId}`,
        JSON.stringify({
          ...project,
          videoTransform,
          videoAspectRatio,
          videoSegments,
          deletedRanges,
          customTextTracks,
          customTextSegments,
          bannerTracks,
          bannerSegments,
        })
      );
    } catch {
      // ignore
    }
  }, [params.id, videoTransform, videoAspectRatio, videoSegments, deletedRanges, customTextTracks, customTextSegments, bannerTracks, bannerSegments]);

  // Load video dimensions when videoUrl changes so 9:16 is detected for crop
  useEffect(() => {
    if (!videoUrl) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const onLoadedMetadata = () => {
      if (video.videoHeight > 0) {
        setVideoAspectRatio(video.videoWidth / video.videoHeight);
      }
    };
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.src = videoUrl;
    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.src = "";
    };
  }, [videoUrl]);

  // Re-apply max words limit when setting changes
  useEffect(() => {
    if (rawSegmentSubtitles.length === 0) return;

    const splitSegments = applyMaxWordsToSegments(
      rawSegmentSubtitles,
      maxWordsPerSegment,
      FPS
    );
    setSegmentSubtitles(splitSegments);

    // Update current subtitles if in segment mode
    if (subtitleMode !== "word") {
      setSubtitles(splitSegments);
    }
  }, [maxWordsPerSegment, rawSegmentSubtitles, subtitleMode]);

  const updateStyle = useCallback(
    <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => {
      setStyle((prev) => ({ ...prev, [key]: value }));
      setActivePreset(null);
    },
    []
  );

  // When Customize panel opens or font changes, resolve available weights for the current font
  useEffect(() => {
    if (!customizePanelOpen) return;
    const entry = FONTS_LIST.find((f) => f.family === style.fontFamily);
    if (!entry?.load) {
      setAvailableWeights(ALL_FONT_WEIGHTS);
      return;
    }
    let cancelled = false;
    entry
      .load()
      .then((mod) => {
        if (cancelled) return;
        const info = mod.getInfo?.();
        if (!info) {
          setAvailableWeights(ALL_FONT_WEIGHTS);
          return;
        }
        const weights = getWeightsFromFontInfo(info);
        if (weights.length > 0) {
          setAvailableWeights(weights);
          setStyle((prev) => {
            if (weights.includes(prev.fontWeight)) return prev;
            return { ...prev, fontWeight: weights[0]! };
          });
        } else {
          setAvailableWeights(ALL_FONT_WEIGHTS);
        }
      })
      .catch(() => setAvailableWeights(ALL_FONT_WEIGHTS));
    return () => {
      cancelled = true;
    };
  }, [customizePanelOpen, style.fontFamily]);

  // Ensure current style font is loaded when it's a Google Font (e.g. after applying a preset).
  // This fixes the picker and subtitles showing a fallback until the font is loaded.
  useEffect(() => {
    if (!isGoogleFont(style.fontFamily)) return;
    const entry = FONTS_LIST.find(
      (f) => f.family === style.fontFamily && f.load
    );
    if (!entry?.load) return;
    let cancelled = false;
    entry
      .load()
      .then((mod) => {
        if (cancelled) return;
        const weight = String(style.fontWeight);
        const result = mod.loadFont?.("normal", {
          weights: [weight],
          subsets: ["latin"],
        });
        if (result) {
          result.waitUntilDone?.().then(() => {
            if (!cancelled && result.fontFamily !== style.fontFamily) {
              setStyle((prev) => ({ ...prev, fontFamily: result.fontFamily }));
            }
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [style.fontFamily, style.fontWeight]);

  const applyPreset = useCallback(
    (preset: (typeof PRESET_STYLES)[0]) => {
      setStyle((prev) => ({ ...prev, ...preset.style }));
      if (preset.maxWordsPerSegment !== undefined)
        setMaxWordsPerSegment(preset.maxWordsPerSegment);
      if (preset.highlightColor !== undefined)
        setHighlightColor(preset.highlightColor);
      setActivePreset(preset.id);

      if (preset.subtitleMode !== undefined) {
        setSubtitleMode(preset.subtitleMode);
        const maxWords = preset.maxWordsPerSegment ?? maxWordsPerSegment;
        let newSubtitles: EnhancedSubtitle[];

        if (preset.subtitleMode === "word") {
          newSubtitles = wordSubtitles.length > 0 ? [...wordSubtitles] : [];
        } else {
          const segments = applyMaxWordsToSegments(
            rawSegmentSubtitles,
            maxWords,
            FPS
          );
          newSubtitles = segments.length > 0 ? [...segments] : [];
        }

        const withDeletions = applyDeletedRangesToSubtitles(
          newSubtitles,
          deletedRanges
        );
        setSubtitles(withDeletions);
      }
    },
    [
      wordSubtitles,
      rawSegmentSubtitles,
      maxWordsPerSegment,
      deletedRanges,
    ]
  );

  const updateSubtitle = useCallback(
    (id: string, updates: Partial<Subtitle>) => {
      setSubtitles((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;

          const updated = { ...s, ...updates };

          // If text was updated and we have words (segment mode), update the words array too
          if (updates.text !== undefined && s.words && s.words.length > 0) {
            const newWords = updates.text
              .trim()
              .split(/\s+/)
              .filter((w) => w.length > 0);
            const oldWords = s.words;

            // Calculate total duration for the subtitle
            const totalDurationMs =
              oldWords.length > 0
                ? oldWords[oldWords.length - 1].endMs - oldWords[0].startMs
                : 1000;
            const startMs = oldWords.length > 0 ? oldWords[0].startMs : 0;

            // Distribute timing evenly across new words
            const wordDuration = totalDurationMs / newWords.length;

            updated.words = newWords.map((word, i) => ({
              text: word,
              startMs: startMs + i * wordDuration,
              endMs: startMs + (i + 1) * wordDuration,
            }));
          }

          return updated;
        })
      );

      // Also update segmentSubtitles to keep them in sync
      if (subtitleMode !== "word") {
        setSegmentSubtitles((prev) =>
          prev.map((s) => {
            if (s.id !== id) return s;

            const updated = { ...s, ...updates };

            if (updates.text !== undefined && s.words && s.words.length > 0) {
              const newWords = updates.text
                .trim()
                .split(/\s+/)
                .filter((w) => w.length > 0);
              const oldWords = s.words;

              const totalDurationMs =
                oldWords.length > 0
                  ? oldWords[oldWords.length - 1].endMs - oldWords[0].startMs
                  : 1000;
              const startMs = oldWords.length > 0 ? oldWords[0].startMs : 0;
              const wordDuration = totalDurationMs / newWords.length;

              updated.words = newWords.map((word, i) => ({
                text: word,
                startMs: startMs + i * wordDuration,
                endMs: startMs + (i + 1) * wordDuration,
              }));
            }

            return updated;
          })
        );
      }
    },
    [subtitleMode]
  );

  type TextSegmentUpdate =
    | (Omit<Partial<CustomTextSegment>, "style"> & { style?: Partial<CustomTextStyle> })
    | ((seg: CustomTextSegment) => Omit<Partial<CustomTextSegment>, "style"> & { style?: Partial<CustomTextStyle> });

  const updateTextSegment = useCallback(
    (id: string, updates: TextSegmentUpdate) => {
      setCustomTextSegments((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const patch = typeof updates === "function" ? updates(s) : updates;
          if (patch.style) {
            return { ...s, ...patch, style: { ...s.style, ...patch.style } as CustomTextStyle };
          }
          const { style: _omit, ...rest } = patch;
          return { ...s, ...rest };
        })
      );
    },
    []
  );

  const removeSubtitle = useCallback(
    (id: string) => {
      setSubtitles((prev) => prev.filter((s) => s.id !== id));
      if (selectedSubtitle === id) setSelectedSubtitle(null);
    },
    [selectedSubtitle]
  );

  const MIN_LEFT_PANEL = 334;
  const MAX_LEFT_PANEL = 560;

  const handleLeftPanelResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizingPanel(true);
      resizeStartRef.current = { x: e.clientX, width: leftPanelWidth };
    },
    [leftPanelWidth]
  );

  useEffect(() => {
    if (!resizingPanel) return;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (e: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const delta = e.clientX - start.x;
      const nextWidth = Math.min(
        MAX_LEFT_PANEL,
        Math.max(MIN_LEFT_PANEL, start.width + delta)
      );
      setLeftPanelWidth(nextWidth);
      resizeStartRef.current = { x: e.clientX, width: nextWidth };
    };
    const onUp = () => {
      setResizingPanel(false);
      resizeStartRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizingPanel]);

  const MIN_BOTTOM_PANEL = 200;
  const handleBottomPanelResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setResizingBottomPanel(true);
      const y = "touches" in e ? e.touches[0].clientY : e.clientY;
      bottomResizeStartRef.current = { y, height: bottomPanelHeight };
    },
    [bottomPanelHeight]
  );

  useEffect(() => {
    if (!resizingBottomPanel) return;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    document.body.style.touchAction = "none";
    document.body.style.overscrollBehavior = "none";
    const getY = (e: MouseEvent | TouchEvent) =>
      "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    const onMove = (e: MouseEvent | TouchEvent) => {
      if ("touches" in e) e.preventDefault();
      const start = bottomResizeStartRef.current;
      if (!start) return;
      const currentY = getY(e);
      const delta = start.y - currentY;
      const maxHeight = Math.floor(window.innerHeight * 0.5);
      const nextHeight = Math.min(
        maxHeight,
        Math.max(MIN_BOTTOM_PANEL, start.height + delta)
      );
      setBottomPanelHeight(nextHeight);
      bottomResizeStartRef.current = { y: currentY, height: nextHeight };
    };
    const onUp = () => {
      setResizingBottomPanel(false);
      bottomResizeStartRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
      document.body.style.overscrollBehavior = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
      document.body.style.overscrollBehavior = "";
    };
  }, [resizingBottomPanel]);

  const formatTime = (frames: number) => {
    const seconds = frames / FPS;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const handleExport = useCallback(() => {
    // For now, just show an alert. In production, this would trigger Lambda rendering
    alert("Export functionality requires Remotion Lambda setup. Coming soon!");
  }, []);

  const handleSeek = useCallback(
    (frame: number) => {
      playerRef.current?.seekTo(Math.max(0, Math.min(frame, compositionDuration)));
    },
    [compositionDuration]
  );

  const handleDeleteConfirm = useCallback(
    (deleteVideo: boolean, subId?: string | null) => {
      const id = subId ?? pendingDeleteSubtitleId;
      setPendingDeleteSubtitleId(null);
      if (!id) return;

      const segment = subtitles.find((s) => s.id === id);
      if (!segment) return;

      if (!deleteVideo) {
        // Subtitle only: remove from timeline entirely
        setDeletedRanges((prev) => [
          ...prev,
          {
            id: `deleted-${Date.now()}`,
            startFrame: segment.startFrame,
            endFrame: segment.endFrame,
            affectsVideo: false,
          },
        ]);
        setSubtitles((prev) => prev.filter((s) => s.id !== id));
      } else {
        // Subtitle + video: remove all subtitles in range, cut video, shift everything left
        const cutStart = segment.startFrame;
        const cutEnd = segment.endFrame;
        // If the cut range is too small, do nothing to avoid zero-length segments
        if (cutEnd - cutStart < 2) {
          return;
        }
        const newRange: DeletedRange = {
          id: `deleted-${Date.now()}`,
          startFrame: cutStart,
          endFrame: cutEnd,
          affectsVideo: true,
        };

        setDeletedRanges((prev) =>
          updateDeletedRangesAfterCut(prev, cutStart, cutEnd, newRange)
        );
        const shiftSubtitles = (prev: EnhancedSubtitle[]) =>
          removeSubtitlesInRangeAndShift(prev, cutStart, cutEnd, FPS);
        setSubtitles(shiftSubtitles);
        setRawSegmentSubtitles((prev) => shiftSubtitles(prev));
        setWordSubtitles((prev) => shiftSubtitles(prev));

        if (videoSegments.length > 0) {
          setVideoSegments((prev) => {
            const seg = prev.find(
              (v) =>
                (segment.startFrame >= v.startFrame &&
                  segment.startFrame < v.endFrame) ||
                (segment.endFrame > v.startFrame &&
                  segment.endFrame <= v.endFrame)
            );
            if (!seg) return prev;

            const segStart = seg.startFrame;
            const segEnd = seg.endFrame;
            const vCutStart = Math.max(segStart, cutStart);
            const vCutEnd = Math.min(segEnd, cutEnd);

            if (vCutStart <= segStart && vCutEnd >= segEnd) {
              const filtered = prev.filter((s) => s.id !== seg.id);
              let pos = 0;
              return filtered.map((s) => {
                const dur = s.sourceEndFrame - s.sourceStartFrame;
                const updated = {
                  ...s,
                  startFrame: pos,
                  endFrame: pos + dur,
                };
                pos += dur;
                return updated;
              });
            }

            const newSegments: VideoSegment[] = [];
            if (vCutStart > segStart) {
              const srcCut = seg.sourceStartFrame + (vCutStart - segStart);
              newSegments.push({
                ...seg,
                id: `${seg.id}-before-${Date.now()}`,
                endFrame: vCutStart,
                sourceEndFrame: srcCut,
              });
            }
            if (vCutEnd < segEnd) {
              const srcCut = seg.sourceStartFrame + (vCutEnd - segStart);
              newSegments.push({
                ...seg,
                id: `${seg.id}-after-${Date.now()}`,
                startFrame: vCutEnd,
                sourceStartFrame: srcCut,
              });
            }

            let result = prev.flatMap((s) =>
              s.id === seg.id ? newSegments : [s]
            );
            let pos = 0;
            result = result.map((s) => {
              const dur = s.sourceEndFrame - s.sourceStartFrame;
              const updated = { ...s, startFrame: pos, endFrame: pos + dur };
              pos += dur;
              return updated;
            });
            return result;
          });
        }
      }
      setSelectedSubtitle(null);
    },
    [
      pendingDeleteSubtitleId,
      subtitles,
      videoSegments,
      setSubtitles,
      setRawSegmentSubtitles,
      setWordSubtitles,
      setVideoSegments,
      setDeletedRanges,
    ]
  );

  const handleDeleteRequest = useCallback(
    (subtitleId: string | null, _videoSegmentId: string | null) => {
      if (subtitleId) {
        const pref = getStoredDeletePreference();
        if (pref !== null) {
          handleDeleteConfirm(pref, subtitleId);
          return;
        }
        setPendingDeleteSubtitleId(subtitleId);
        setShowDeleteDialog(true);
      }
    },
    [handleDeleteConfirm]
  );

  // Keyboard shortcut for splitting (S) and delete (Delete/Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isTyping =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA";

      if (e.key === "Delete" || e.key === "Backspace") {
        if (isTyping) return;
        e.preventDefault();
        if (selectedSubtitle) {
          handleDeleteRequest(selectedSubtitle, null);
        } else if (selectedTextSegment) {
          setCustomTextSegments((prev) =>
            prev.filter((s) => s.id !== selectedTextSegment)
          );
          setSelectedTextSegment(null);
        } else if (selectedBannerSegment) {
          setBannerSegments((prev) =>
            prev.filter((s) => s.id !== selectedBannerSegment)
          );
          setSelectedBannerSegment(null);
        } else if (selectedVideoSegment) {
          const deleteBtn = document.querySelector(
            '[title="Delete selected (Delete key)"]'
          );
          (deleteBtn as HTMLButtonElement)?.click();
        }
        return;
      }

      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        if (isTyping) return;
        e.preventDefault();
        const splitBtn = document.querySelector(
          '[title="Split subtitle and video at playhead (S / Ctrl+K)"]'
        );
        (splitBtn as HTMLButtonElement)?.click();
        return;
      }

      if (e.key === "s" || e.key === "S") {
        if (isTyping) return;
        e.preventDefault();
        const splitBtn = document.querySelector(
          '[title="Split subtitle and video at playhead (S / Ctrl+K)"]'
        );
        (splitBtn as HTMLButtonElement)?.click();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedSubtitle,
    selectedTextSegment,
    selectedBannerSegment,
    selectedVideoSegment,
    handleDeleteRequest,
    setCustomTextSegments,
    setSelectedTextSegment,
    setBannerSegments,
    setSelectedBannerSegment,
  ]);

  // Scroll selected subtitle/text segment card into view when selection changes from timeline
  useEffect(() => {
    if (leftPanelTab === "subtitles" && selectedSubtitle) {
      const el = document.querySelector(
        `[data-subtitle-id="${selectedSubtitle}"]`
      );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    if (leftPanelTab === "text" && selectedTextSegment) {
      const el = document.querySelector(
        `[data-text-segment-id="${selectedTextSegment}"]`
      );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [leftPanelTab, selectedSubtitle, selectedTextSegment]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="mb-4 size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header - relative z-10 so back stays clickable */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <Link
            href={
              sourceProjectId
                ? `/projects/${sourceProjectId}` // Back to gallery when editing a clip
                : experienceId
                  ? `/experiences/${experienceId}` // Back to experience page
                  : "/" // Fallback to home
            }
            className="cursor-pointer text-muted-foreground hover:text-foreground"
            prefetch={false}
          >
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-lg font-semibold">ClipCap Editor</h1>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button variant="destructive" onClick={handleExport}>
            <Download className="mr-2 size-4" />
            Export
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 flex-col-reverse sm:flex-row">
        {/* Left Panel - Tabs: Styling & Subtitles (resizable, collapsible) */}
		  
        <aside
          style={{
            width: leftPanelCollapsed ? 48 : leftPanelWidth,
            transition: "width 0.2s ease-out",
          }}
          className="relative hidden sm:flex min-h-0 flex-shrink-0 flex-col overflow-hidden border-r border-border"
        >
          {/* Collapse/expand toggle - always visible */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-2 z-20 shrink-0",
              leftPanelCollapsed ? "left-1 right-1" : "left-1"
            )}
            onClick={() => setLeftPanelCollapsed((c) => !c)}
            title={leftPanelCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={leftPanelCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {leftPanelCollapsed ? (
              <PanelLeft className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>

          {!leftPanelCollapsed && (
            <>
          <Tabs
            value={leftPanelTab}
            onValueChange={(v) => setLeftPanelTab(v as "styling" | "subtitles" | "text")}
            className="flex flex-1 flex-row overflow-hidden pt-10"
            orientation="vertical"
          >
            <TabsList variant="line" className="shrink-0 mt-4 gap-4">
              <TabsTrigger value="styling" className="border-none">
                <Palette className="size-4" />
              </TabsTrigger>
              <TabsTrigger value="subtitles" className="border-none">
                <Captions className="size-4" />
              </TabsTrigger>
              <TabsTrigger value="text" className="border-none">
                <Type className="size-4" />
              </TabsTrigger>
              <TabsTrigger value="banners" className="border-none">
                <Award className="size-4" />
              </TabsTrigger>
            </TabsList>
            <div className="relative flex-1 flex min-h-0 flex-col">
              <TabsContent
                value="styling"
                className="mt-0 flex flex-1 min-h-0 flex-col outline-none p-4 gap-4"
              >
                <Button
                  variant="outline"
                  className="self-end"
                  onClick={() => setCustomizePanelOpen(true)}
                >
                  <Pencil className="size-4" />
                  Customize{" "}
                  {activePreset
                    ? (PRESET_STYLES.find((p) => p.id === activePreset)?.name ??
                      "style")
                    : "style"}
                </Button>
                {/* Presets + Customize button (visible when panel closed) */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="mb-4">
                    <Label className="mb-2 text-muted-foreground">
                      Style Presets
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESET_STYLES.map((preset) => (
                        <Button
                          key={preset.id}
                          onClick={() => applyPreset(preset)}
                          variant="preset"
                          className="p-6"
                        >
                          <div
                            className="rounded px-2 py-1 text-xs font-bold"
                            style={{
                              color: preset.preview.color,
                              backgroundColor: preset.preview.bg,
                              textShadow: preset.preview.stroke
                                ? `1px 1px 0 ${preset.preview.stroke}, -1px -1px 0 ${preset.preview.stroke}, 1px -1px 0 ${preset.preview.stroke}, -1px 1px 0 ${preset.preview.stroke}`
                                : "none",
                            }}
                          >
                            {preset.name}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sliding Customize panel (overlays presets, slides in from right) */}
                <div
                  className={cn(
                    "absolute inset-0 overflow-hidden transition-[visibility] duration-300",
                    !customizePanelOpen && "pointer-events-none"
                  )}
                  aria-hidden={!customizePanelOpen}
                >
                  <div
                    className={cn(
                      "absolute inset-0 bg-background shadow-lg transition-transform duration-300 ease-out",
                      customizePanelOpen ? "translate-x-0" : "translate-x-full"
                    )}
                  >
                    <div className="flex h-full flex-col overflow-y-auto p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCustomizePanelOpen(false)}
                          className="-ml-2"
                        >
                          <ArrowLeft className="mr-2 size-4" />
                          Back
                        </Button>
                      </div>

                      <Tabs defaultValue="font" className="w-full">
                        <TabsList
                          variant="line"
                          className="grid w-full grid-cols-4 h-9 mb-3"
                        >
                          <TabsTrigger value="font" className="border-none" style={{ justifyContent: "center" }}>
                            <Type className="size-4" />
                          </TabsTrigger>
                          <TabsTrigger
                            value="background"
                            className="border-none"
                            style={{ justifyContent: "center" }}
                          >
                            <Highlighter
                              className="size-4"
                            />
                          </TabsTrigger>
                          <TabsTrigger
                            value="alignment"
                            className="border-none"
                            style={{ justifyContent: "center" }}
                          >
                            <SquareCenterlineDashedVerticalIcon
                              className="size-4"
                            />
                          </TabsTrigger>
                          <TabsTrigger value="effects" className="border-none" style={{ justifyContent: "center" }}>
                            <WandSparkles className="size-4" />
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="font" className="mt-0 space-y-4">
                          <div className="flex gap-4 mb-4">
                            <div className="space-y-2 flex-1">
                              <Label className="text-xs text-muted-foreground">
                                Font family
                              </Label>
                              <Select
                                value={
                                  style.fontFamily === SYSTEM_FONT
                                    ? SYSTEM_FONT
                                    : style.fontFamily
                                }
                                onValueChange={async (value) => {
                                  if (value === SYSTEM_FONT) {
                                    setAvailableWeights(ALL_FONT_WEIGHTS);
                                    updateStyle("fontFamily", SYSTEM_FONT);
                                    return;
                                  }
                                  const entry = FONTS_LIST.find(
                                    (f) => f.family === value
                                  );
                                  if (!entry) return;
                                  if (!entry.load) {
                                    setAvailableWeights(ALL_FONT_WEIGHTS);
                                    updateStyle("fontFamily", entry.family);
                                    return;
                                  }
                                  try {
                                    const mod = await entry.load();
                                    const info = mod.getInfo?.();
                                    const weights = info
                                      ? getWeightsFromFontInfo(info)
                                      : [400, 700];
                                    if (weights.length > 0) {
                                      setAvailableWeights(weights);
                                    }
                                    const weightToLoad =
                                      weights.length > 0 &&
                                      weights.includes(style.fontWeight)
                                        ? style.fontWeight
                                        : (weights[0] ?? 400);
                                    if (
                                      weights.length > 0 &&
                                      !weights.includes(style.fontWeight)
                                    ) {
                                      updateStyle("fontWeight", weightToLoad);
                                    }
                                    const result = mod.loadFont?.("normal", {
                                      weights: [String(weightToLoad)],
                                      subsets: ["latin"],
                                    });
                                    if (!result) {
                                      const fallback =
                                        info?.fontFamily ??
                                        (mod as { fontFamily?: string })
                                          .fontFamily;
                                      if (fallback)
                                        updateStyle("fontFamily", fallback);
                                      return;
                                    }
                                    updateStyle(
                                      "fontFamily",
                                      result.fontFamily
                                    );
                                    await result.waitUntilDone?.();
                                  } catch (e) {
                                    console.warn("Failed to load font:", e);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue>
                                    {getFontDisplayName(style.fontFamily)}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={SYSTEM_FONT}>
                                    System
                                  </SelectItem>
                                  {FONTS_LIST.map((f) => (
                                    <SelectItem
                                      key={f.family}
                                      value={f.family}
                                      style={{ fontFamily: f.family }}
                                    >
                                      {f.family}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2 flex-1">
                              <Label className="text-xs text-muted-foreground">
                                Font weight
                              </Label>
                              <Select
                                value={String(
                                  availableWeights.includes(style.fontWeight)
                                    ? style.fontWeight
                                    : (availableWeights[0] ?? 400)
                                )}
                                onValueChange={(v) =>
                                  updateStyle("fontWeight", Number(v))
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableWeights.map((w) => (
                                    <SelectItem key={w} value={String(w)}>
                                      {String(w)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="flex gap-4 mb-4">
                            <div className="space-y-1 flex-1 flex flex-col">
                              <span className="text-xs text-muted-foreground">
                                Font Color
                              </span>
                              <ColorPickerInput
                                value={style.textColor}
                                onChange={(v) => updateStyle("textColor", v)}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-1 flex-1 flex flex-col">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Size
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {style.fontSize}px
                                </span>
                              </div>
                              <div className="h-full content-center flex">
                                <Slider
                                  value={[style.fontSize]}
                                  onValueChange={([v]) =>
                                    updateStyle("fontSize", v)
                                  }
                                  min={32}
                                  max={96}
                                  step={1}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-4 mb-4">
                            <div className="space-y-1 flex-1 flex flex-col">
                              <span className="text-xs text-muted-foreground">
                                Stroke
                              </span>
                              <ColorPickerInput
                                value={style.strokeColor}
                                onChange={(v) => updateStyle("strokeColor", v)}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2 flex-1 flex flex-col">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Width
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {style.strokeWidth}px
                                </span>
                              </div>
                              <div className="h-full content-center flex">
                                <Slider
                                  value={[style.strokeWidth]}
                                  onValueChange={([v]) =>
                                    updateStyle("strokeWidth", v)
                                  }
                                  min={0}
                                  max={6}
                                  step={1}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-4	mb-4">
                            <div className="flex flex-col flex-1 justify-between gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Italic
                                </Label>
                                <p className="text-[10px] text-muted-foreground/80">
                                  Use italic text
                                </p>
                              </div>
                              <Switch
                                checked={style.fontStyle === "italic"}
                                onCheckedChange={(checked: boolean) =>
                                  updateStyle(
                                    "fontStyle",
                                    checked ? "italic" : "normal"
                                  )
                                }
                              />
                            </div>

                            <div className="flex flex-col flex-1 justify-between gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Uppercase
                                </Label>
                                <p className="text-[10px] text-muted-foreground/80">
                                  Display all subtitles in uppercase
                                </p>
                              </div>
                              <Switch
                                checked={style.uppercase ?? false}
                                onCheckedChange={(checked: boolean) =>
                                  updateStyle("uppercase", checked)
                                }
                              />
                            </div>
                          </div>

                          <div className="flex gap-4 mb-4">
                            <div className="space-y-4 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Line height
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {style.lineHeight ?? 1.2}
                                </span>
                              </div>
                              <Slider
                                value={[style.lineHeight ?? 1.2]}
                                onValueChange={([v]) =>
                                  updateStyle("lineHeight", v)
                                }
                                min={0.8}
                                max={2.5}
                                step={0.1}
                              />
                            </div>

                            <div className="space-y-4 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Spacing
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {style.wordSpacing ?? 0}px
                                </span>
                              </div>
                              <Slider
                                value={[style.wordSpacing ?? 0]}
                                onValueChange={([v]) =>
                                  updateStyle("wordSpacing", v)
                                }
                                min={-16}
                                max={20}
                                step={1}
                              />
                            </div>
                          </div>

								  <div className="flex gap-4 mb-4">
                            <div className="space-y-1 flex-1 flex flex-col">
                              <span className="text-xs text-muted-foreground">
                                Shadow Color
                              </span>
                              <ColorPickerInput
                                value={style.shadowColor}
                                onChange={(v) => updateStyle("shadowColor", v)}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2 flex-1 flex flex-col">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Blur
                                </span>
                                <span className="text-muted-foreground">
                                  {style.shadowBlur}px
                                </span>
                              </div>
                              <div className="h-full content-center flex">
                                <Slider
                                  value={[style.shadowBlur]}
                                  onValueChange={([v]) =>
                                    updateStyle("shadowBlur", v)
                                  }
                                  min={0}
                                  max={40}
                                  step={2}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mb-4 space-y-2">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">
                                  Opacity
                                </span>
                                <span className="text-muted-foreground">
                                  {Math.round((style.shadowOpacity ?? 1) * 100)}
                                  %
                                </span>
                              </div>
                              <Slider
                                value={[(style.shadowOpacity ?? 1) * 100]}
                                onValueChange={([v]) =>
                                  updateStyle("shadowOpacity", v / 100)
                                }
                                min={0}
                                max={100}
                                step={5}
                              />
                              <p className="text-[10px] text-muted-foreground/80">
                                At 0% the shadow is off (same as no shadow).
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Offset X</span>
                                    <span>{style.shadowOffsetX}px</span>
                                  </div>
                                  <Slider
                                    value={[style.shadowOffsetX]}
                                    onValueChange={([v]) =>
                                      updateStyle("shadowOffsetX", v)
                                    }
                                    min={-20}
                                    max={20}
                                    step={1}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Offset Y</span>
                                    <span>{style.shadowOffsetY}px</span>
                                  </div>
                                  <Slider
                                    value={[style.shadowOffsetY]}
                                    onValueChange={([v]) =>
                                      updateStyle("shadowOffsetY", v)
                                    }
                                    min={-20}
                                    max={20}
                                    step={1}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent
                          value="background"
                          className="mt-0 space-y-4"
                        >
                          <div className="flex gap-4 mb-4">
                            <div className="space-y-1 flex-1 flex flex-col">
                              <span className="text-xs text-muted-foreground">
                                Background
                              </span>
                              <ColorPickerInput
                                value={style.backgroundColor}
                                onChange={(v) =>
                                  updateStyle("backgroundColor", v)
                                }
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2 flex-1 flex flex-col">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Opacity
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(style.backgroundOpacity * 100)}%
                                </span>
                              </div>
                              <div className="h-full content-center flex">
                                <Slider
                                  value={[style.backgroundOpacity * 100]}
                                  onValueChange={([v]) =>
                                    updateStyle("backgroundOpacity", v / 100)
                                  }
                                  min={0}
                                  max={100}
                                  step={5}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Width (padding)</span>
                                <span>{style.paddingX}px</span>
                              </div>
                              <Slider
                                value={[style.paddingX]}
                                onValueChange={([v]) =>
                                  updateStyle("paddingX", v)
                                }
                                min={0}
                                max={48}
                                step={2}
                              />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Height (padding)</span>
                                <span>{style.paddingY}px</span>
                              </div>
                              <Slider
                                value={[style.paddingY]}
                                onValueChange={([v]) =>
                                  updateStyle("paddingY", v)
                                }
                                min={0}
                                max={32}
                                step={2}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Border radius
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {style.borderRadius}px
                              </span>
                            </div>
                            <Slider
                              value={[style.borderRadius]}
                              onValueChange={([v]) =>
                                updateStyle("borderRadius", v)
                              }
                              min={0}
                              max={24}
                              step={1}
                            />
                          </div>
                        </TabsContent>

                        <TabsContent
                          value="alignment"
                          className="mt-0 space-y-4"
                        >
                          <div className="mb-4 space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Position
                            </Label>
                            <div className="flex gap-1">
                              {(
                                [
                                  { pos: "top" as const, positionY: 10 },
                                  { pos: "center" as const, positionY: 50 },
                                  { pos: "bottom" as const, positionY: 90 },
                                ] as const
                              ).map(({ pos, positionY }) => (
                                <Button
                                  key={pos}
                                  variant={
                                    style.position === pos &&
                                    (style.positionY ?? 85) === positionY
                                      ? "default"
                                      : "secondary"
                                  }
                                  size="sm"
                                  onClick={() => {
                                    updateStyle("position", pos);
                                    updateStyle("positionY", positionY);
                                  }}
                                  className="flex-1 capitalize"
                                >
                                  {pos}
                                </Button>
                              ))}
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Vertical
                                </span>
                              </div>
                              <Slider
                                value={[style.positionY ?? 85]}
                                onValueChange={([v]) =>
                                  updateStyle("positionY", v)
                                }
                                min={5}
                                max={95}
                                step={1}
                              />
                            </div>
                          </div>
                          <div className="mb-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Side margin
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {style.containerMarginX ?? 40}px
                              </span>
                            </div>
                            <Slider
                              value={[style.containerMarginX ?? 40]}
                              onValueChange={([v]) =>
                                updateStyle("containerMarginX", v)
                              }
                              min={24}
                              max={200}
                              step={4}
                            />
                            <p className="text-[10px] text-muted-foreground/80">
                              Left/right margin. Larger = narrower text = more
                              wrapping to two lines.
                            </p>
                          </div>
                        </TabsContent>

                        <TabsContent value="effects" className="mt-0 space-y-4">

                          <div className="mb-4 space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Animation
                            </Label>
                            <Select
                              value={style.animation}
                              onValueChange={(v) =>
                                updateStyle(
                                  "animation",
                                  v as SubtitleStyle["animation"]
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="fade">Fade</SelectItem>
                                <SelectItem value="pop">Pop</SelectItem>
                                <SelectItem value="slide">Slide</SelectItem>
                                <SelectItem value="typewriter">
                                  Typewriter
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TabsContent>
                      </Tabs>

                      <div className="mt-4 border-t border-border pt-4">
                        <Label className="mb-3 text-muted-foreground">
                          Subtitle Mode
                        </Label>

                        <div className="mb-4 space-y-2">
                          <Select
                            value={subtitleMode}
                            onValueChange={(v) => {
                              const mode = v as SubtitleMode;
                              setSubtitleMode(mode);
                              if (mode === "word") {
                                if (wordSubtitles.length > 0)
                                  setSubtitles(wordSubtitles);
                              } else {
                                if (segmentSubtitles.length > 0)
                                  setSubtitles(segmentSubtitles);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="word">Word by Word</SelectItem>
                              <SelectItem value="segment">
                                Full Sentences
                              </SelectItem>
                              <SelectItem value="segment-highlight">
                                Sentences + Highlight
                              </SelectItem>
                              <SelectItem value="segment-background-highlight">
                                Sentences + Background Highlight
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">
                            {subtitleMode === "word" &&
                              "One word at a time (TikTok style)"}
                            {subtitleMode === "segment" &&
                              "Full sentences/phrases"}
                            {subtitleMode === "segment-highlight" &&
                              "Karaoke-style word highlighting"}
                            {subtitleMode === "segment-background-highlight" &&
                              "Active word in a colored background box"}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60">
                            Words: {wordSubtitles.length} | Segments:{" "}
                            {segmentSubtitles.length}
                          </p>
                        </div>

                        {(subtitleMode === "segment-highlight" ||
                          subtitleMode === "segment-background-highlight") && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">
                                Highlight Color
                              </span>
                              <ColorPickerInput
                                value={highlightColor}
                                onChange={setHighlightColor}
                              />
                            </div>
                          </div>
                        )}

                        {subtitleMode !== "word" && (
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Max Words Per Line
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {maxWordsPerSegment}
                              </span>
                            </div>
                            <Slider
                              value={[maxWordsPerSegment]}
                              onValueChange={([v]) => setMaxWordsPerSegment(v)}
                              min={3}
                              max={15}
                              step={1}
                            />
                            <p className="text-[10px] text-muted-foreground/60">
                              Splits long segments into smaller chunks
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="subtitles"
                className="mt-0 outline-none p-4 overflow-auto"
              >
                <Label className="mb-2 text-muted-foreground">
                  Subtitles ({subtitles.length})
                </Label>

                <div className="flex flex-col gap-2">
                  {subtitles.map((sub, i) => (
                    <div
                      key={sub.id}
                      data-subtitle-id={sub.id}
                      onClick={() => {
                        setSelectedSubtitle(sub.id);
                        playerRef.current?.seekTo(sub.startFrame);
                      }}
                      className={cn(
                        "cursor-pointer rounded-lg border p-2 transition-colors hover:bg-secondary/80",
                        selectedSubtitle === sub.id
                          ? "border-primary bg-primary/30"
                          : "border-transparent bg-secondary"
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className="text-[10px] font-semibold"
                          style={{
                            color: SUBTITLE_COLORS[i % SUBTITLE_COLORS.length],
                          }}
                        >
                          {formatTime(sub.startFrame)} -{" "}
                          {formatTime(sub.endFrame)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSubtitle(sub.id);
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                      <textarea
                        value={sub.text}
                        onChange={(e) =>
                          updateSubtitle(sub.id, { text: e.target.value })
                        }
                        onClick={(e) => e.stopPropagation()}
                        rows={2}
                        className="w-full min-h-[4rem] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        placeholder="Subtitle text (press Enter for line break)"
                      />
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className="mt-3 w-full border-dashed"
                  onClick={() => {
                    const lastEnd =
                      subtitles.length > 0
                        ? subtitles[subtitles.length - 1].endFrame
                        : 0;
                    setSubtitles((prev) => [
                      ...prev,
                      {
                        id: Date.now().toString(),
                        text: "New subtitle",
                        startFrame: Math.min(lastEnd + 15, videoDuration - 60),
                        endFrame: Math.min(lastEnd + 75, videoDuration),
                      },
                    ]);
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  Add Subtitle
                </Button>
              </TabsContent>

              <TabsContent
                value="text"
                className="mt-0 outline-none p-4 overflow-auto"
              >
                <Label className="mb-2 text-muted-foreground">
                  Custom Text Overlays
                </Label>

                {/* Quick add when no tracks */}
                {customTextTracks.length === 0 && (
                  <Button
                    variant="default"
                    className="w-full mb-4 border-dashed"
                    onClick={() => {
                      const frame = playerRef.current?.getCurrentFrame() ?? 0;
                      const newTrack: CustomTextTrack = {
                        id: `text-track-${Date.now()}`,
                        name: `Text 1`,
                        visible: true,
                        color: TEXT_TRACK_COLORS[0],
                      };
                      const newSegment: CustomTextSegment = {
                        id: `text-seg-${Date.now()}`,
                        trackId: newTrack.id,
                        text: "Your text here",
                        startFrame: Math.min(frame, compositionDuration - 60),
                        endFrame: Math.min(frame + 90, compositionDuration),
                        style: { ...DEFAULT_CUSTOM_TEXT_STYLE },
                      };
                      setCustomTextTracks((prev) => [...prev, newTrack]);
                      setCustomTextSegments((prev) => [...prev, newSegment]);
                      setSelectedTextSegment(newSegment.id);
                      playerRef.current?.seekTo(newSegment.startFrame);
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add text overlay
                  </Button>
                )}

                {/* Tracks with nested segments - collapsible */}
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {customTextTracks.map((track) => {
                    const segments = customTextSegments.filter(
                      (s) => s.trackId === track.id
                    );
                    const isExpanded = !collapsedTextTrackIds.has(track.id);
                    return (
                      <div
                        key={track.id}
                        className="rounded-lg border border-border bg-secondary/30 overflow-hidden"
                      >
                        <div className="flex items-center gap-1.5 p-2 pr-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() =>
                              setCollapsedTextTrackIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(track.id)) next.delete(track.id);
                                else next.add(track.id);
                                return next;
                              })
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronRight className="size-3.5" />
                            )}
                          </Button>
                          <span
                            className="shrink-0 w-2 h-2 rounded-full"
                            style={{ backgroundColor: track.color }}
                          />
                          <span className="text-xs font-medium truncate flex-1">
                            {track.name}
                          </span>
                          <Switch
                            checked={track.visible}
                            onCheckedChange={(visible) =>
                              setCustomTextTracks((prev) =>
                                prev.map((t) =>
                                  t.id === track.id ? { ...t, visible } : t
                                )
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              const frame =
                                playerRef.current?.getCurrentFrame() ?? 0;
                              const newSegment: CustomTextSegment = {
                                id: `text-seg-${Date.now()}`,
                                trackId: track.id,
                                text: "Your text here",
                                startFrame: Math.min(
                                  frame,
                                  compositionDuration - 60
                                ),
                                endFrame: Math.min(
                                  frame + 90,
                                  compositionDuration
                                ),
                                style: { ...DEFAULT_CUSTOM_TEXT_STYLE },
                              };
                              setCustomTextSegments((prev) => [
                                ...prev,
                                newSegment,
                              ]);
                              setSelectedTextSegment(newSegment.id);
                              playerRef.current?.seekTo(newSegment.startFrame);
                              setCollapsedTextTrackIds((prev) => {
                                const next = new Set(prev);
                                next.delete(track.id);
                                return next;
                              });
                            }}
                          >
                            <Plus className="size-3 mr-0.5" />
                            Add
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomTextTracks((prev) =>
                                prev.filter((t) => t.id !== track.id)
                              );
                              setCustomTextSegments((prev) =>
                                prev.filter((s) => s.trackId !== track.id)
                              );
                              if (
                                customTextSegments.some(
                                  (s) =>
                                    s.id === selectedTextSegment &&
                                    s.trackId === track.id
                                )
                              ) {
                                setSelectedTextSegment(null);
                              }
                            }}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-border/50 px-2 pb-2 pt-1.5 space-y-1">
                            {segments.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground py-1 px-2">
                                No segments — click Add
                              </p>
                            ) : (
                              segments.map((seg) => (
                                <div
                                  key={seg.id}
                                  data-text-segment-id={seg.id}
                                  onClick={() => {
                                    setSelectedTextSegment(seg.id);
                                    playerRef.current?.seekTo(seg.startFrame);
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md border p-2 cursor-pointer transition-colors",
                                    selectedTextSegment === seg.id
                                      ? "border-primary bg-primary/10"
                                      : "border-border/50 bg-muted/30 hover:bg-muted/50"
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {seg.text || "Empty"}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {formatTime(seg.startFrame)} -{" "}
                                      {formatTime(seg.endFrame)}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {customTextTracks.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-4 border-dashed"
                    onClick={() => {
                      const newTrack: CustomTextTrack = {
                        id: `text-track-${Date.now()}`,
                        name: `Text ${customTextTracks.length + 1}`,
                        visible: true,
                        color:
                          TEXT_TRACK_COLORS[
                            customTextTracks.length % TEXT_TRACK_COLORS.length
                          ],
                      };
                      setCustomTextTracks((prev) => [...prev, newTrack]);
                      setCollapsedTextTrackIds((prev) => {
                        const next = new Set(prev);
                        next.delete(newTrack.id);
                        return next;
                      });
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add track
                  </Button>
                )}

                {customTextTracks.length > 0 && customTextSegments.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() => {
                      const track = customTextTracks[0];
                      if (!track) return;
                      const frame =
                        playerRef.current?.getCurrentFrame() ?? 0;
                      const newSegment: CustomTextSegment = {
                        id: `text-seg-${Date.now()}`,
                        trackId: track.id,
                        text: "Your text here",
                        startFrame: Math.min(frame, compositionDuration - 60),
                        endFrame: Math.min(frame + 90, compositionDuration),
                        style: { ...DEFAULT_CUSTOM_TEXT_STYLE },
                      };
                      setCustomTextSegments((prev) => [...prev, newSegment]);
                      setSelectedTextSegment(newSegment.id);
                      playerRef.current?.seekTo(newSegment.startFrame);
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add first segment at playhead
                  </Button>
                )}

                {/* Selected segment editor */}
                {selectedTextSegment && (() => {
                  const seg = customTextSegments.find(
                    (s) => s.id === selectedTextSegment
                  );
                  if (!seg) return null;
                  return (
                    <div className="space-y-4 border-t border-border pt-4 mt-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground">
                          Edit selected segment
                        </Label>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              updateTextSegment(selectedTextSegment, {
                                style: {
                                  fontFamily: style.fontFamily,
                                  fontSize: style.fontSize,
                                  fontWeight: style.fontWeight,
                                  fontStyle: style.fontStyle,
                                  lineHeight: style.lineHeight,
                                  textColor: style.textColor,
                                  strokeColor: style.strokeColor,
                                  strokeWidth: style.strokeWidth,
                                  shadowColor: style.shadowColor,
                                  shadowBlur: style.shadowBlur,
                                  shadowOpacity: style.shadowOpacity,
                                  shadowOffsetX: style.shadowOffsetX,
                                  shadowOffsetY: style.shadowOffsetY,
                                  backgroundColor: style.backgroundColor,
                                  backgroundOpacity: style.backgroundOpacity,
                                  borderRadius: style.borderRadius,
                                  paddingX: style.paddingX,
                                  paddingY: style.paddingY,
                                  containerMarginX: style.containerMarginX,
                                  position: style.position,
                                  positionY: style.positionY,
                                  animation: style.animation,
                                  uppercase: style.uppercase,
                                },
                              });
                            }}
                          >
                            Copy from subtitles
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => {
                              setCustomTextSegments((prev) =>
                                prev.filter((s) => s.id !== selectedTextSegment)
                              );
                              setSelectedTextSegment(null);
                            }}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(seg.startFrame)} - {formatTime(seg.endFrame)}
                        {" · "}
                        Drag on timeline to change
                      </div>
                      <textarea
                        value={seg.text}
                        onChange={(e) =>
                          updateTextSegment(selectedTextSegment, {
                            text: e.target.value,
                          })
                        }
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Enter your text"
                      />
                      <Tabs defaultValue="font" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 h-9 mb-3">
                          <TabsTrigger value="font" style={{ justifyContent: "center" }}>
                            <Type className="size-4" />
                          </TabsTrigger>
                          <TabsTrigger value="colors" style={{ justifyContent: "center" }}>
                            <Highlighter className="size-4" />
                          </TabsTrigger>
                          <TabsTrigger value="position" style={{ justifyContent: "center" }}>
                            <SquareCenterlineDashedVerticalIcon className="size-4" />
                          </TabsTrigger>
                          <TabsTrigger value="animation" style={{ justifyContent: "center" }}>
                            <WandSparkles className="size-4" />
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="font" className="mt-0 space-y-3">
                          <div>
                            <Label className="text-xs">Font</Label>
                            <Select
                              value={seg.style.fontFamily}
                              onValueChange={(v) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { fontFamily: v },
                                })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={SYSTEM_FONT}>
                                  System
                                </SelectItem>
                                {FONTS_LIST.map((f) => (
                                  <SelectItem
                                    key={f.family}
                                    value={f.family}
                                    style={{ fontFamily: f.family }}
                                  >
                                    {getFontDisplayName(f.family)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Label className="text-xs">Size</Label>
                              <Input
                                type="number"
                                value={seg.style.fontSize}
                                onChange={(e) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: {
                                      fontSize:
                                        parseInt(e.target.value, 10) || 60,
                                    },
                                  })
                                }
                                className="mt-1"
                                min={12}
                                max={120}
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs">Weight</Label>
                              <Select
                                value={String(seg.style.fontWeight)}
                                onValueChange={(v) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: {
                                      fontWeight: parseInt(v, 10),
                                    },
                                  })
                                }
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[400, 500, 600, 700, 800, 900].map((w) => (
                                    <SelectItem
                                      key={w}
                                      value={String(w)}
                                    >
                                      {w}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex flex-col flex-1 justify-between gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Italic
                                </Label>
                              </div>
                              <Switch
                                checked={seg.style.fontStyle === "italic"}
                                onCheckedChange={(checked: boolean) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: {
                                      fontStyle: checked ? "italic" : "normal",
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="flex flex-col flex-1 justify-between gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Uppercase
                                </Label>
                              </div>
                              <Switch
                                checked={seg.style.uppercase ?? false}
                                onCheckedChange={(checked: boolean) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { uppercase: checked },
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">
                              Line height ({seg.style.lineHeight ?? 1.2})
                            </Label>
                            <Slider
                              value={[seg.style.lineHeight ?? 1.2]}
                              onValueChange={([v]) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { lineHeight: v },
                                })
                              }
                              min={0.8}
                              max={2.5}
                              step={0.1}
                              className="mt-1"
                            />
                          </div>
                        </TabsContent>
                        <TabsContent value="colors" className="mt-0 space-y-3">
                          <div>
                            <Label className="text-xs">Text color</Label>
                            <div className="mt-1">
                              <ColorPickerInput
                                value={seg.style.textColor}
                                onChange={(v) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { textColor: v },
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="space-y-1 flex-1">
                              <Label className="text-xs">Stroke</Label>
                              <ColorPickerInput
                                value={seg.style.strokeColor}
                                onChange={(v) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { strokeColor: v },
                                  })
                                }
                                className="mt-1"
                              />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between">
                                <Label className="text-xs">Stroke width</Label>
                                <span className="text-xs text-muted-foreground">
                                  {seg.style.strokeWidth}px
                                </span>
                              </div>
                              <Slider
                                value={[seg.style.strokeWidth]}
                                onValueChange={([v]) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { strokeWidth: v },
                                  })
                                }
                                min={0}
                                max={6}
                                step={1}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="space-y-1 flex-1">
                              <Label className="text-xs">Shadow color</Label>
                              <ColorPickerInput
                                value={seg.style.shadowColor}
                                onChange={(v) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { shadowColor: v },
                                  })
                                }
                                className="mt-1"
                              />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between">
                                <Label className="text-xs">Shadow blur</Label>
                                <span className="text-xs text-muted-foreground">
                                  {seg.style.shadowBlur}px
                                </span>
                              </div>
                              <Slider
                                value={[seg.style.shadowBlur]}
                                onValueChange={([v]) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { shadowBlur: v },
                                  })
                                }
                                min={0}
                                max={40}
                                step={2}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <Label className="text-xs">Shadow opacity</Label>
                              <span className="text-xs text-muted-foreground">
                                {Math.round((seg.style.shadowOpacity ?? 1) * 100)}%
                              </span>
                            </div>
                            <Slider
                              value={[(seg.style.shadowOpacity ?? 1) * 100]}
                              onValueChange={([v]) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { shadowOpacity: v / 100 },
                                })
                              }
                              min={0}
                              max={100}
                              step={5}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Shadow offset X</Label>
                              <Input
                                type="number"
                                value={seg.style.shadowOffsetX}
                                onChange={(e) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: {
                                      shadowOffsetX: parseInt(e.target.value, 10) || 0,
                                    },
                                  })
                                }
                                min={-20}
                                max={20}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Shadow offset Y</Label>
                              <Input
                                type="number"
                                value={seg.style.shadowOffsetY}
                                onChange={(e) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: {
                                      shadowOffsetY: parseInt(e.target.value, 10) || 0,
                                    },
                                  })
                                }
                                min={-20}
                                max={20}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Background</Label>
                            <div className="flex gap-2 mt-1">
                              <ColorPickerInput
                                value={seg.style.backgroundColor}
                                onChange={(v) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { backgroundColor: v },
                                  })
                                }
                              />
                              <div className="flex-1">
                                <Slider
                                  value={[seg.style.backgroundOpacity * 100]}
                                  onValueChange={([v]) =>
                                    updateTextSegment(selectedTextSegment, {
                                      style: {
                                        backgroundOpacity: v / 100,
                                      },
                                    })
                                  }
                                  min={0}
                                  max={100}
                                  step={5}
                                />
                                <span className="text-[10px] text-muted-foreground">
                                  {Math.round(seg.style.backgroundOpacity * 100)}%
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Width (padding)</span>
                                <span>{seg.style.paddingX}px</span>
                              </div>
                              <Slider
                                value={[seg.style.paddingX]}
                                onValueChange={([v]) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { paddingX: v },
                                  })
                                }
                                min={0}
                                max={48}
                                step={2}
                              />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Height (padding)</span>
                                <span>{seg.style.paddingY}px</span>
                              </div>
                              <Slider
                                value={[seg.style.paddingY]}
                                onValueChange={([v]) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { paddingY: v },
                                  })
                                }
                                min={0}
                                max={32}
                                step={2}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <Label className="text-xs">Border radius</Label>
                              <span className="text-xs text-muted-foreground">
                                {seg.style.borderRadius}px
                              </span>
                            </div>
                            <Slider
                              value={[seg.style.borderRadius]}
                              onValueChange={([v]) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { borderRadius: v },
                                })
                              }
                              min={0}
                              max={24}
                              step={1}
                            />
                          </div>
                        </TabsContent>
                        <TabsContent value="position" className="mt-0 space-y-3">
                          <div>
                            <Label className="text-xs">Position</Label>
                            <Select
                              value={seg.style.position}
                              onValueChange={(v) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: {
                                    position: v as "top" | "center" | "bottom",
                                    positionY:
                                      v === "top"
                                        ? 20
                                        : v === "center"
                                          ? 50
                                          : 85,
                                  },
                                })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="top">Top</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="bottom">Bottom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">
                              Vertical offset ({seg.style.positionY ?? 50}%)
                            </Label>
                            <Slider
                              value={[seg.style.positionY ?? 50]}
                              onValueChange={([v]) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { positionY: v },
                                })
                              }
                              min={5}
                              max={95}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between">
                              <Label className="text-xs">Side margin</Label>
                              <span className="text-xs text-muted-foreground">
                                {seg.style.containerMarginX ?? 40}px
                              </span>
                            </div>
                            <Slider
                              value={[seg.style.containerMarginX ?? 40]}
                              onValueChange={([v]) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { containerMarginX: v },
                                })
                              }
                              min={24}
                              max={200}
                              step={4}
                              className="mt-1"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Left/right margin. Larger = narrower text area.
                            </p>
                          </div>
                        </TabsContent>
                        <TabsContent value="animation" className="mt-0 space-y-3">
                          <div>
                            <Label className="text-xs">Animation</Label>
                            <Select
                              value={seg.style.animation}
                              onValueChange={(v) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: {
                                    animation: v as
                                      | "none"
                                      | "fade"
                                      | "pop"
                                      | "slide"
                                      | "typewriter",
                                  },
                                })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="fade">Fade</SelectItem>
                                <SelectItem value="pop">Pop</SelectItem>
                                <SelectItem value="slide">Slide</SelectItem>
                                <SelectItem value="typewriter">
                                  Typewriter
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  );
                })()}

                {!selectedTextSegment && customTextSegments.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Click a segment above or on the timeline to edit
                  </p>
                )}
              </TabsContent>

              <TabsContent
                value="banners"
                className="mt-0 outline-none p-4 overflow-auto"
              >
                <Label className="mb-2 text-muted-foreground">
                  Social Banners
                </Label>

                {bannerTracks.length === 0 && (
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-1 gap-2">
                      {BANNER_PRESETS.map((preset) => (
                        <Button
                          key={preset.id}
                          variant="outline"
                          className="flex flex-col items-start p-4 h-auto text-left"
                          onClick={() => {
                            const frame =
                              playerRef.current?.getCurrentFrame() ?? 0;
                            const newTrack: BannerTrack = {
                              id: `banner-track-${Date.now()}`,
                              name: preset.name,
                              visible: true,
                              color: BANNER_TRACK_COLORS[0],
                            };
                            const newSegment: BannerSegment = {
                              id: `banner-seg-${Date.now()}`,
                              trackId: newTrack.id,
                              logoUrl: preset.logoUrl,
                              text: "YOUR-PAGE.URL",
                              startFrame: Math.min(
                                frame,
                                compositionDuration - 60
                              ),
                              endFrame: Math.min(
                                frame + 90,
                                compositionDuration
                              ),
                              style: { ...preset.style },
                            };
                            setBannerTracks((prev) => [...prev, newTrack]);
                            setBannerSegments((prev) => [
                              ...prev,
                              newSegment,
                            ]);
                            setSelectedBannerSegment(newSegment.id);
                            playerRef.current?.seekTo(newSegment.startFrame);
                          }}
                        >
                          <span className="font-semibold">{preset.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {bannerTracks.map((track) => {
                    const segments = bannerSegments.filter(
                      (s) => s.trackId === track.id
                    );
                    const isExpanded = !collapsedBannerTrackIds.has(track.id);
                    return (
                      <div
                        key={track.id}
                        className="rounded-lg border border-border bg-secondary/30 overflow-hidden"
                      >
                        <div className="flex items-center gap-1.5 p-2 pr-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() =>
                              setCollapsedBannerTrackIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(track.id)) next.delete(track.id);
                                else next.add(track.id);
                                return next;
                              })
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronRight className="size-3.5" />
                            )}
                          </Button>
                          <span
                            className="shrink-0 w-2 h-2 rounded-full"
                            style={{ backgroundColor: track.color }}
                          />
                          <span className="text-xs font-medium truncate flex-1">
                            {track.name}
                          </span>
                          <Switch
                            checked={track.visible}
                            onCheckedChange={(visible) =>
                              setBannerTracks((prev) =>
                                prev.map((t) =>
                                  t.id === track.id ? { ...t, visible } : t
                                )
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Popover
                            open={bannerPresetPopoverTrackId === track.id}
                            onOpenChange={(open) =>
                              setBannerPresetPopoverTrackId(open ? track.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Plus className="size-3 mr-0.5" />
                                Add
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-64 p-2"
                              align="end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-xs font-medium text-muted-foreground px-2 py-1.5 mb-1">
                                Choose style
                              </div>
                              <div className="space-y-0.5">
                                {BANNER_PRESETS.map((preset) => (
                                  <Button
                                    key={preset.id}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start h-auto py-2 px-2 text-left"
                                    onClick={() => {
                                      setBannerPresetPopoverTrackId(null);
                                      const frame =
                                        playerRef.current?.getCurrentFrame() ??
                                        0;
                                      const newSegment: BannerSegment = {
                                        id: `banner-seg-${Date.now()}`,
                                        trackId: track.id,
                                        logoUrl: preset.logoUrl,
                                        text: "YOUR-PAGE.URL",
                                        startFrame: Math.min(
                                          frame,
                                          compositionDuration - 60
                                        ),
                                        endFrame: Math.min(
                                          frame + 90,
                                          compositionDuration
                                        ),
                                        style: { ...preset.style },
                                      };
                                      setBannerSegments((prev) => [
                                        ...prev,
                                        newSegment,
                                      ]);
                                      setSelectedBannerSegment(newSegment.id);
                                      playerRef.current?.seekTo(
                                        newSegment.startFrame
                                      );
                                      setCollapsedBannerTrackIds((prev) => {
                                        const next = new Set(prev);
                                        next.delete(track.id);
                                        return next;
                                      });
                                    }}
                                  >
                                    <span className="font-medium">
                                      {preset.name}
                                    </span>
                                  </Button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBannerTracks((prev) =>
                                prev.filter((t) => t.id !== track.id)
                              );
                              setBannerSegments((prev) =>
                                prev.filter((s) => s.trackId !== track.id)
                              );
                              if (
                                bannerSegments.some(
                                  (s) =>
                                    s.id === selectedBannerSegment &&
                                    s.trackId === track.id
                                )
                              ) {
                                setSelectedBannerSegment(null);
                              }
                            }}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-border/50 px-2 pb-2 pt-1.5 space-y-1">
                            {segments.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground py-1 px-2">
                                No segments — click Add
                              </p>
                            ) : (
                              segments.map((seg) => (
                                <div
                                  key={seg.id}
                                  data-banner-segment-id={seg.id}
                                  onClick={() => {
                                    setSelectedBannerSegment(seg.id);
                                    playerRef.current?.seekTo(seg.startFrame);
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md border p-2 cursor-pointer transition-colors",
                                    selectedBannerSegment === seg.id
                                      ? "border-primary bg-primary/10"
                                      : "border-border/50 bg-muted/30 hover:bg-muted/50"
                                  )}
                                >
                                  {seg.logoUrl ? (
                                    <img
                                      src={seg.logoUrl}
                                      alt=""
                                      className="w-8 h-8 object-contain rounded shrink-0"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded bg-muted shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                                      +
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {seg.text || "Empty"}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {formatTime(seg.startFrame)} -{" "}
                                      {formatTime(seg.endFrame)}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {bannerTracks.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-4 border-dashed"
                    onClick={() => {
                      const newTrack: BannerTrack = {
                        id: `banner-track-${Date.now()}`,
                        name: `Banner ${bannerTracks.length + 1}`,
                        visible: true,
                        color:
                          BANNER_TRACK_COLORS[
                            bannerTracks.length % BANNER_TRACK_COLORS.length
                          ],
                      };
                      setBannerTracks((prev) => [...prev, newTrack]);
                      setCollapsedBannerTrackIds((prev) => {
                        const next = new Set(prev);
                        next.delete(newTrack.id);
                        return next;
                      });
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add track
                  </Button>
                )}

                {selectedBannerSegment && (() => {
                  const seg = bannerSegments.find(
                    (s) => s.id === selectedBannerSegment
                  );
                  if (!seg) return null;

                  return (
                    <div className="space-y-4 border-t border-border pt-4 mt-4">
                      <Label className="text-muted-foreground">
                        Edit selected banner
                      </Label>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(seg.startFrame)} - {formatTime(seg.endFrame)}
                        {" · "}
                        Drag on timeline to change
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Text</Label>
                          <Input
                            value={seg.text}
                            onChange={(e) =>
                              setBannerSegments((prev) =>
                                prev.map((s) =>
                                  s.id === selectedBannerSegment
                                    ? { ...s, text: e.target.value }
                                    : s
                                )
                              )
                            }
                            placeholder="YOUR-PAGE.URL"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Text color</Label>
                          <ColorPickerInput
                            value={seg.style.textColor}
                            onChange={(v) =>
                              setBannerSegments((prev) =>
                                prev.map((s) =>
                                  s.id === selectedBannerSegment
                                    ? { ...s, style: { ...s.style, textColor: v } }
                                    : s
                                )
                              )
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Background</Label>
                          <div className="flex gap-2 mt-1">
                            <ColorPickerInput
                              value={seg.style.backgroundColor}
                              onChange={(v) =>
                                setBannerSegments((prev) =>
                                  prev.map((s) =>
                                    s.id === selectedBannerSegment
                                      ? {
                                          ...s,
                                          style: { ...s.style, backgroundColor: v },
                                        }
                                      : s
                                  )
                                )
                              }
                            />
                            <div className="flex-1">
                              <Slider
                                value={[seg.style.backgroundOpacity * 100]}
                                onValueChange={([v]) =>
                                  setBannerSegments((prev) =>
                                    prev.map((s) =>
                                      s.id === selectedBannerSegment
                                        ? {
                                            ...s,
                                            style: {
                                              ...s.style,
                                              backgroundOpacity: v / 100,
                                            },
                                          }
                                        : s
                                    )
                                  )
                                }
                                min={0}
                                max={100}
                                step={5}
                              />
                              <span className="text-[10px] text-muted-foreground">
                                {Math.round(seg.style.backgroundOpacity * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">
                            Vertical position ({seg.style.positionY ?? 90}%)
                          </Label>
                          <Slider
                            value={[seg.style.positionY ?? 90]}
                            onValueChange={([v]) =>
                              setBannerSegments((prev) =>
                                prev.map((s) =>
                                  s.id === selectedBannerSegment
                                    ? {
                                        ...s,
                                        style: { ...s.style, positionY: v },
                                      }
                                    : s
                                )
                              )
                            }
                            min={0}
                            max={100}
                            step={1}
                            className="mt-1"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            0% = top, 100% = bottom
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs">Animation</Label>
                          <Select
                            value={seg.style.animation}
                            onValueChange={(v) =>
                              setBannerSegments((prev) =>
                                prev.map((s) =>
                                  s.id === selectedBannerSegment
                                    ? {
                                        ...s,
                                        style: {
                                          ...s.style,
                                          animation: v as BannerStyle["animation"],
                                        },
                                      }
                                    : s
                                )
                              )
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="fade">Fade</SelectItem>
                              <SelectItem value="slide-up">Slide up</SelectItem>
                              <SelectItem value="slide-down">Slide down</SelectItem>
                              <SelectItem value="slide-left">Slide left</SelectItem>
                              <SelectItem value="slide-right">Slide right</SelectItem>
                              <SelectItem value="pop">Pop</SelectItem>
                              <SelectItem value="bounce">Bounce</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label className="text-xs">Border radius</Label>
                            <span className="text-xs text-muted-foreground">
                              {seg.style.borderRadius}px
                            </span>
                          </div>
                          <Slider
                            value={[seg.style.borderRadius]}
                            onValueChange={([v]) =>
                              setBannerSegments((prev) =>
                                prev.map((s) =>
                                  s.id === selectedBannerSegment
                                    ? {
                                        ...s,
                                        style: { ...s.style, borderRadius: v },
                                      }
                                    : s
                                )
                              )
                            }
                            min={0}
                            max={32}
                            step={1}
                          />
                        </div>
                      </div>

                      <div className="border-t border-border pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-muted-foreground h-8"
                          onClick={() =>
                            setBannerEditorMoreOptionsOpen(
                              !bannerEditorMoreOptionsOpen
                            )
                          }
                        >
                          {bannerEditorMoreOptionsOpen ? (
                            <ChevronDown className="size-4 mr-2" />
                          ) : (
                            <ChevronRight className="size-4 mr-2" />
                          )}
                          More options
                        </Button>
                        {bannerEditorMoreOptionsOpen && (
                          <div className="space-y-3 mt-2 pl-6">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Label className="text-xs">Logo width</Label>
                                <Input
                                  type="number"
                                  value={seg.style.logoWidth}
                                  onChange={(e) =>
                                    setBannerSegments((prev) =>
                                      prev.map((s) =>
                                        s.id === selectedBannerSegment
                                          ? {
                                              ...s,
                                              style: {
                                                ...s.style,
                                                logoWidth:
                                                  parseInt(e.target.value, 10) ||
                                                  80,
                                              },
                                            }
                                          : s
                                      )
                                    )
                                  }
                                  min={20}
                                  max={300}
                                  className="mt-1"
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">Logo height</Label>
                                <Input
                                  type="number"
                                  value={seg.style.logoHeight}
                                  onChange={(e) =>
                                    setBannerSegments((prev) =>
                                      prev.map((s) =>
                                        s.id === selectedBannerSegment
                                          ? {
                                              ...s,
                                              style: {
                                                ...s.style,
                                                logoHeight:
                                                  parseInt(e.target.value, 10) ||
                                                  80,
                                              },
                                            }
                                          : s
                                      )
                                    )
                                  }
                                  min={20}
                                  max={200}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">
                                Text font size ({seg.style.fontSize}px)
                              </Label>
                              <Slider
                                value={[seg.style.fontSize]}
                                onValueChange={([v]) =>
                                  setBannerSegments((prev) =>
                                    prev.map((s) =>
                                      s.id === selectedBannerSegment
                                        ? {
                                            ...s,
                                            style: { ...s.style, fontSize: v },
                                          }
                                        : s
                                    )
                                  )
                                }
                                min={12}
                                max={72}
                                step={2}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive"
                        onClick={() => {
                          setBannerSegments((prev) =>
                            prev.filter((s) => s.id !== selectedBannerSegment)
                          );
                          setSelectedBannerSegment(null);
                        }}
                      >
                        <X className="mr-2 size-4" />
                        Remove banner
                      </Button>
                    </div>
                  );
                })()}

                {!selectedBannerSegment && bannerSegments.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Click a segment above or on the timeline to edit
                  </p>
                )}
              </TabsContent>
            </div>
          </Tabs>

          {/* Resize handle - drag to change panel width (only when expanded) */}
          <div
            role="separator"
            aria-label="Resize left panel"
            onMouseDown={handleLeftPanelResizeStart}
            className={cn(
              "absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize select-none border-r border-transparent transition-colors hover:border-primary/30 hover:bg-primary/10",
              resizingPanel && "border-primary/50 bg-primary/20"
            )}
          />
            </>
          )}
        </aside>

		    <div
            className={cn(
              "flex sm:hidden flex-col min-h-0",
              mobilePanelTab ? "" : "flex-none shrink-0"
            )}
          >
          <Tabs
            value={mobilePanelTab || mobilePanelTabPrevRef.current || "styling"}
            onValueChange={(v) => {
              const tab = v as "styling" | "subtitles" | "text" | "banners" | "timeline";
              setMobilePanelTab((prev) => (prev === tab ? "" : tab));
            }}
            className="flex flex-1 flex-col-reverse overflow-hidden min-h-0"
            style={{ flexDirection: "column-reverse" }}
            orientation="horizontal"
            activationMode="manual"
          >
            <TabsList variant="none" className="shrink-0 gap-4 w-full bg-background my-2">
              <TabsTrigger
                value="styling"
                className="border-none py-8 rounded-[50%]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMobilePanelTab((p) => (p === "styling" ? "" : "styling"));
                }}
              >
                <Palette className="size-6" />
              </TabsTrigger>
              <TabsTrigger
                value="subtitles"
                className="border-none py-8 rounded-[50%]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMobilePanelTab((p) => (p === "subtitles" ? "" : "subtitles"));
                }}
              >
                <Captions className="size-6" />
              </TabsTrigger>
              <TabsTrigger
                value="text"
                className="border-none py-8 rounded-[50%]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMobilePanelTab((p) => (p === "text" ? "" : "text"));
                }}
              >
                <Type className="size-6" />
              </TabsTrigger>
              <TabsTrigger
                value="banners"
                className="border-none py-8 rounded-[50%]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMobilePanelTab((p) => (p === "banners" ? "" : "banners"));
                }}
              >
                <Award className="size-6" />
              </TabsTrigger>
              <TabsTrigger
                value="timeline"
                className="border-none py-8 rounded-[50%]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMobilePanelTab((p) => (p === "timeline" ? "" : "timeline"));
                }}
              >
                <ChartNoAxesGantt className="size-6" />
              </TabsTrigger>
            </TabsList>
            <div
              className={cn(
                "flex flex-1 min-h-0 flex-col bg-background overflow-hidden",
                !skipMobileTabsCloseTransition && "transition-[max-height] duration-300 ease-out",
                !mobilePanelTab && "pointer-events-none"
              )}
              style={{
                maxHeight: mobilePanelTab ? "calc(50vh + 48px)" : "0px",
              }}
            >
              {/* Resize handle above tabs content */}
              <div
                role="separator"
                aria-label="Resize tabs content - drag up or down"
                onMouseDown={handleMobileTabsResizeStart}
                onTouchStart={handleMobileTabsResizeStart}
                className={cn(
                  "shrink-0 cursor-ns-resize select-none border-b border-transparent transition-colors flex items-center justify-center touch-none [-webkit-tap-highlight-color:transparent]",
                  resizingMobileTabs && "border-primary/50 bg-primary/10"
                )}
              >
                <div className="flex flex-col gap-0.5 opacity-60" aria-hidden>
                  <GripHorizontal/>
                </div>
              </div>

              {/* Resizable / scrollable content area */}
              <div
                ref={mobileTabsContentRef}
                className="shrink-0 flex flex-col overflow-y-auto"
                style={
                  mobileTabsContentHeight !== null
                    ? { height: mobileTabsContentHeight }
                    : { maxHeight: "50vh" }
                }
              >
              <TabsContent
                value="styling"
                className="relative mt-0 flex flex-1 min-h-0 flex-col outline-none p-4 gap-4"
              >
                <Button
                  variant="outline"
                  className="self-end"
                  onClick={() => setCustomizePanelOpen(true)}
                >
                  <Pencil className="size-4" />
                  Customize{" "}
                  {activePreset
                    ? (PRESET_STYLES.find((p) => p.id === activePreset)?.name ??
                      "style")
                    : "style"}
                </Button>
                {/* Presets + Customize button (visible when panel closed) */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="mb-4">
                    <Label className="mb-2 text-muted-foreground">
                      Style Presets
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {PRESET_STYLES.map((preset) => (
                        <Button
                          key={preset.id}
                          onClick={() => applyPreset(preset)}
                          variant="preset"
                          className="p-6"
                        >
                          <div
                            className="rounded px-2 py-1 text-xs font-bold"
                            style={{
                              color: preset.preview.color,
                              backgroundColor: preset.preview.bg,
                              textShadow: preset.preview.stroke
                                ? `1px 1px 0 ${preset.preview.stroke}, -1px -1px 0 ${preset.preview.stroke}, 1px -1px 0 ${preset.preview.stroke}, -1px 1px 0 ${preset.preview.stroke}`
                                : "none",
                            }}
                          >
                            {preset.name}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sliding Customize panel (overlays presets, slides in from right) */}
                <div
                  className={cn(
                    "absolute inset-0 overflow-hidden transition-[visibility] duration-300",
                    !customizePanelOpen && "pointer-events-none"
                  )}
                  aria-hidden={!customizePanelOpen}
                >
                  <div
                    className={cn(
                      "absolute inset-0 bg-background shadow-lg transition-transform duration-300 ease-out",
                      customizePanelOpen ? "translate-x-0" : "translate-x-full"
                    )}
                  >
                    <div className="flex h-full flex-col overflow-y-auto p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCustomizePanelOpen(false)}
                          className="-ml-2"
                        >
                          <ArrowLeft className="mr-2 size-4" />
                          Back
                        </Button>
                      </div>

                      <Tabs defaultValue="font" className="w-full">
                        <TabsList
                          variant="line"
                          className="grid w-full grid-cols-4 h-9 mb-3"
                        >
                          <TabsTrigger value="font" className="border-none" style={{ justifyContent: "center" }}>
                            <Type className="size-4" />
                          </TabsTrigger>
                          <TabsTrigger
                            value="background"
                            className="border-none"
                            style={{ justifyContent: "center" }}
                          >
                            <Highlighter
                              className="size-4"
                            />
                          </TabsTrigger>
                          <TabsTrigger
                            value="alignment"
                            className="border-none"
                            style={{ justifyContent: "center" }}
                          >
                            <SquareCenterlineDashedVerticalIcon
                              className="size-4"
                            />
                          </TabsTrigger>
                          <TabsTrigger value="effects" className="border-none" style={{ justifyContent: "center" }}>
                            <WandSparkles className="size-4" />
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="font" className="mt-0 space-y-4">
                          <div className="flex gap-4 mb-4">
                            <div className="space-y-2 flex-1">
                              <Label className="text-xs text-muted-foreground">
                                Font family
                              </Label>
                              <Select
                                value={
                                  style.fontFamily === SYSTEM_FONT
                                    ? SYSTEM_FONT
                                    : style.fontFamily
                                }
                                onValueChange={async (value) => {
                                  if (value === SYSTEM_FONT) {
                                    setAvailableWeights(ALL_FONT_WEIGHTS);
                                    updateStyle("fontFamily", SYSTEM_FONT);
                                    return;
                                  }
                                  const entry = FONTS_LIST.find(
                                    (f) => f.family === value
                                  );
                                  if (!entry) return;
                                  if (!entry.load) {
                                    setAvailableWeights(ALL_FONT_WEIGHTS);
                                    updateStyle("fontFamily", entry.family);
                                    return;
                                  }
                                  try {
                                    const mod = await entry.load();
                                    const info = mod.getInfo?.();
                                    const weights = info
                                      ? getWeightsFromFontInfo(info)
                                      : [400, 700];
                                    if (weights.length > 0) {
                                      setAvailableWeights(weights);
                                    }
                                    const weightToLoad =
                                      weights.length > 0 &&
                                      weights.includes(style.fontWeight)
                                        ? style.fontWeight
                                        : (weights[0] ?? 400);
                                    if (
                                      weights.length > 0 &&
                                      !weights.includes(style.fontWeight)
                                    ) {
                                      updateStyle("fontWeight", weightToLoad);
                                    }
                                    const result = mod.loadFont?.("normal", {
                                      weights: [String(weightToLoad)],
                                      subsets: ["latin"],
                                    });
                                    if (!result) {
                                      const fallback =
                                        info?.fontFamily ??
                                        (mod as { fontFamily?: string })
                                          .fontFamily;
                                      if (fallback)
                                        updateStyle("fontFamily", fallback);
                                      return;
                                    }
                                    updateStyle(
                                      "fontFamily",
                                      result.fontFamily
                                    );
                                    await result.waitUntilDone?.();
                                  } catch (e) {
                                    console.warn("Failed to load font:", e);
                                  }
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue>
                                    {getFontDisplayName(style.fontFamily)}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={SYSTEM_FONT}>
                                    System
                                  </SelectItem>
                                  {FONTS_LIST.map((f) => (
                                    <SelectItem
                                      key={f.family}
                                      value={f.family}
                                      style={{ fontFamily: f.family }}
                                    >
                                      {f.family}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2 flex-1">
                              <Label className="text-xs text-muted-foreground">
                                Font weight
                              </Label>
                              <Select
                                value={String(
                                  availableWeights.includes(style.fontWeight)
                                    ? style.fontWeight
                                    : (availableWeights[0] ?? 400)
                                )}
                                onValueChange={(v) =>
                                  updateStyle("fontWeight", Number(v))
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableWeights.map((w) => (
                                    <SelectItem key={w} value={String(w)}>
                                      {String(w)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="flex gap-4 mb-4">
                            <div className="space-y-1 flex-1 flex flex-col">
                              <span className="text-xs text-muted-foreground">
                                Font Color
                              </span>
                              <ColorPickerInput
                                value={style.textColor}
                                onChange={(v) => updateStyle("textColor", v)}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-1 flex-1 flex flex-col">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Size
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {style.fontSize}px
                                </span>
                              </div>
                              <div className="h-full content-center flex">
                                <Slider
                                  value={[style.fontSize]}
                                  onValueChange={([v]) =>
                                    updateStyle("fontSize", v)
                                  }
                                  min={32}
                                  max={96}
                                  step={1}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-4 mb-4">
                            <div className="space-y-1 flex-1 flex flex-col">
                              <span className="text-xs text-muted-foreground">
                                Stroke
                              </span>
                              <ColorPickerInput
                                value={style.strokeColor}
                                onChange={(v) => updateStyle("strokeColor", v)}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2 flex-1 flex flex-col">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Width
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {style.strokeWidth}px
                                </span>
                              </div>
                              <div className="h-full content-center flex">
                                <Slider
                                  value={[style.strokeWidth]}
                                  onValueChange={([v]) =>
                                    updateStyle("strokeWidth", v)
                                  }
                                  min={0}
                                  max={6}
                                  step={1}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-4	mb-4">
                            <div className="flex flex-col flex-1 justify-between gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Italic
                                </Label>
                                <p className="text-[10px] text-muted-foreground/80">
                                  Use italic text
                                </p>
                              </div>
                              <Switch
                                checked={style.fontStyle === "italic"}
                                onCheckedChange={(checked: boolean) =>
                                  updateStyle(
                                    "fontStyle",
                                    checked ? "italic" : "normal"
                                  )
                                }
                              />
                            </div>

                            <div className="flex flex-col flex-1 justify-between gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Uppercase
                                </Label>
                                <p className="text-[10px] text-muted-foreground/80">
                                  Display all subtitles in uppercase
                                </p>
                              </div>
                              <Switch
                                checked={style.uppercase ?? false}
                                onCheckedChange={(checked: boolean) =>
                                  updateStyle("uppercase", checked)
                                }
                              />
                            </div>
                          </div>

                          <div className="flex gap-4 mb-4">
                            <div className="space-y-4 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Line height
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {style.lineHeight ?? 1.2}
                                </span>
                              </div>
                              <Slider
                                value={[style.lineHeight ?? 1.2]}
                                onValueChange={([v]) =>
                                  updateStyle("lineHeight", v)
                                }
                                min={0.8}
                                max={2.5}
                                step={0.1}
                              />
                            </div>

                            <div className="space-y-4 flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Spacing
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {style.wordSpacing ?? 0}px
                                </span>
                              </div>
                              <Slider
                                value={[style.wordSpacing ?? 0]}
                                onValueChange={([v]) =>
                                  updateStyle("wordSpacing", v)
                                }
                                min={-16}
                                max={20}
                                step={1}
                              />
                            </div>
                          </div>

								  <div className="flex gap-4 mb-4">
                            <div className="space-y-1 flex-1 flex flex-col">
                              <span className="text-xs text-muted-foreground">
                                Shadow Color
                              </span>
                              <ColorPickerInput
                                value={style.shadowColor}
                                onChange={(v) => updateStyle("shadowColor", v)}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2 flex-1 flex flex-col">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Blur
                                </span>
                                <span className="text-muted-foreground">
                                  {style.shadowBlur}px
                                </span>
                              </div>
                              <div className="h-full content-center flex">
                                <Slider
                                  value={[style.shadowBlur]}
                                  onValueChange={([v]) =>
                                    updateStyle("shadowBlur", v)
                                  }
                                  min={0}
                                  max={40}
                                  step={2}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mb-4 space-y-2">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">
                                  Opacity
                                </span>
                                <span className="text-muted-foreground">
                                  {Math.round((style.shadowOpacity ?? 1) * 100)}
                                  %
                                </span>
                              </div>
                              <Slider
                                value={[(style.shadowOpacity ?? 1) * 100]}
                                onValueChange={([v]) =>
                                  updateStyle("shadowOpacity", v / 100)
                                }
                                min={0}
                                max={100}
                                step={5}
                              />
                              <p className="text-[10px] text-muted-foreground/80">
                                At 0% the shadow is off (same as no shadow).
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Offset X</span>
                                    <span>{style.shadowOffsetX}px</span>
                                  </div>
                                  <Slider
                                    value={[style.shadowOffsetX]}
                                    onValueChange={([v]) =>
                                      updateStyle("shadowOffsetX", v)
                                    }
                                    min={-20}
                                    max={20}
                                    step={1}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Offset Y</span>
                                    <span>{style.shadowOffsetY}px</span>
                                  </div>
                                  <Slider
                                    value={[style.shadowOffsetY]}
                                    onValueChange={([v]) =>
                                      updateStyle("shadowOffsetY", v)
                                    }
                                    min={-20}
                                    max={20}
                                    step={1}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent
                          value="background"
                          className="mt-0 space-y-4"
                        >
                          <div className="flex gap-4 mb-4">
                            <div className="space-y-1 flex-1 flex flex-col">
                              <span className="text-xs text-muted-foreground">
                                Background
                              </span>
                              <ColorPickerInput
                                value={style.backgroundColor}
                                onChange={(v) =>
                                  updateStyle("backgroundColor", v)
                                }
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2 flex-1 flex flex-col">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Opacity
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(style.backgroundOpacity * 100)}%
                                </span>
                              </div>
                              <div className="h-full content-center flex">
                                <Slider
                                  value={[style.backgroundOpacity * 100]}
                                  onValueChange={([v]) =>
                                    updateStyle("backgroundOpacity", v / 100)
                                  }
                                  min={0}
                                  max={100}
                                  step={5}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Width (padding)</span>
                                <span>{style.paddingX}px</span>
                              </div>
                              <Slider
                                value={[style.paddingX]}
                                onValueChange={([v]) =>
                                  updateStyle("paddingX", v)
                                }
                                min={0}
                                max={48}
                                step={2}
                              />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Height (padding)</span>
                                <span>{style.paddingY}px</span>
                              </div>
                              <Slider
                                value={[style.paddingY]}
                                onValueChange={([v]) =>
                                  updateStyle("paddingY", v)
                                }
                                min={0}
                                max={32}
                                step={2}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Border radius
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {style.borderRadius}px
                              </span>
                            </div>
                            <Slider
                              value={[style.borderRadius]}
                              onValueChange={([v]) =>
                                updateStyle("borderRadius", v)
                              }
                              min={0}
                              max={24}
                              step={1}
                            />
                          </div>
                        </TabsContent>

                        <TabsContent
                          value="alignment"
                          className="mt-0 space-y-4"
                        >
                          <div className="mb-4 space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Position
                            </Label>
                            <div className="flex gap-1">
                              {(
                                [
                                  { pos: "top" as const, positionY: 10 },
                                  { pos: "center" as const, positionY: 50 },
                                  { pos: "bottom" as const, positionY: 90 },
                                ] as const
                              ).map(({ pos, positionY }) => (
                                <Button
                                  key={pos}
                                  variant={
                                    style.position === pos &&
                                    (style.positionY ?? 85) === positionY
                                      ? "default"
                                      : "secondary"
                                  }
                                  size="sm"
                                  onClick={() => {
                                    updateStyle("position", pos);
                                    updateStyle("positionY", positionY);
                                  }}
                                  className="flex-1 capitalize"
                                >
                                  {pos}
                                </Button>
                              ))}
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Vertical
                                </span>
                              </div>
                              <Slider
                                value={[style.positionY ?? 85]}
                                onValueChange={([v]) =>
                                  updateStyle("positionY", v)
                                }
                                min={5}
                                max={95}
                                step={1}
                              />
                            </div>
                          </div>
                          <div className="mb-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Side margin
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {style.containerMarginX ?? 40}px
                              </span>
                            </div>
                            <Slider
                              value={[style.containerMarginX ?? 40]}
                              onValueChange={([v]) =>
                                updateStyle("containerMarginX", v)
                              }
                              min={24}
                              max={200}
                              step={4}
                            />
                            <p className="text-[10px] text-muted-foreground/80">
                              Left/right margin. Larger = narrower text = more
                              wrapping to two lines.
                            </p>
                          </div>
                        </TabsContent>

                        <TabsContent value="effects" className="mt-0 space-y-4">

                          <div className="mb-4 space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              Animation
                            </Label>
                            <Select
                              value={style.animation}
                              onValueChange={(v) =>
                                updateStyle(
                                  "animation",
                                  v as SubtitleStyle["animation"]
                                )
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="fade">Fade</SelectItem>
                                <SelectItem value="pop">Pop</SelectItem>
                                <SelectItem value="slide">Slide</SelectItem>
                                <SelectItem value="typewriter">
                                  Typewriter
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TabsContent>
                      </Tabs>

                      <div className="mt-4 border-t border-border pt-4">
                        <Label className="mb-3 text-muted-foreground">
                          Subtitle Mode
                        </Label>

                        <div className="mb-4 space-y-2">
                          <Select
                            value={subtitleMode}
                            onValueChange={(v) => {
                              const mode = v as SubtitleMode;
                              setSubtitleMode(mode);
                              if (mode === "word") {
                                if (wordSubtitles.length > 0)
                                  setSubtitles(wordSubtitles);
                              } else {
                                if (segmentSubtitles.length > 0)
                                  setSubtitles(segmentSubtitles);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="word">Word by Word</SelectItem>
                              <SelectItem value="segment">
                                Full Sentences
                              </SelectItem>
                              <SelectItem value="segment-highlight">
                                Sentences + Highlight
                              </SelectItem>
                              <SelectItem value="segment-background-highlight">
                                Sentences + Background Highlight
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">
                            {subtitleMode === "word" &&
                              "One word at a time (TikTok style)"}
                            {subtitleMode === "segment" &&
                              "Full sentences/phrases"}
                            {subtitleMode === "segment-highlight" &&
                              "Karaoke-style word highlighting"}
                            {subtitleMode === "segment-background-highlight" &&
                              "Active word in a colored background box"}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60">
                            Words: {wordSubtitles.length} | Segments:{" "}
                            {segmentSubtitles.length}
                          </p>
                        </div>

                        {(subtitleMode === "segment-highlight" ||
                          subtitleMode === "segment-background-highlight") && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">
                                Highlight Color
                              </span>
                              <ColorPickerInput
                                value={highlightColor}
                                onChange={setHighlightColor}
                              />
                            </div>
                          </div>
                        )}

                        {subtitleMode !== "word" && (
                          <div className="mt-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Max Words Per Line
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {maxWordsPerSegment}
                              </span>
                            </div>
                            <Slider
                              value={[maxWordsPerSegment]}
                              onValueChange={([v]) => setMaxWordsPerSegment(v)}
                              min={3}
                              max={15}
                              step={1}
                            />
                            <p className="text-[10px] text-muted-foreground/60">
                              Splits long segments into smaller chunks
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent
                value="subtitles"
                className="mt-0 outline-none p-4 overflow-auto h-max-content"
              >
                <Label className="mb-2 text-muted-foreground">
                  Subtitles ({subtitles.length})
                </Label>

                <div className="flex flex-col gap-2">
                  {subtitles.map((sub, i) => (
                    <div
                      key={sub.id}
                      data-subtitle-id={sub.id}
                      onClick={() => {
                        setSelectedSubtitle(sub.id);
                        playerRef.current?.seekTo(sub.startFrame);
                      }}
                      className={cn(
                        "cursor-pointer rounded-lg border p-2 transition-colors hover:bg-secondary/80",
                        selectedSubtitle === sub.id
                          ? "border-primary bg-primary/30"
                          : "border-transparent bg-secondary"
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className="text-[10px] font-semibold"
                          style={{
                            color: SUBTITLE_COLORS[i % SUBTITLE_COLORS.length],
                          }}
                        >
                          {formatTime(sub.startFrame)} -{" "}
                          {formatTime(sub.endFrame)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSubtitle(sub.id);
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                      <textarea
                        value={sub.text}
                        onChange={(e) =>
                          updateSubtitle(sub.id, { text: e.target.value })
                        }
                        onClick={(e) => e.stopPropagation()}
                        rows={2}
                        className="w-full min-h-[4rem] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        placeholder="Subtitle text (press Enter for line break)"
                      />
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className="mt-3 w-full border-dashed"
                  onClick={() => {
                    const lastEnd =
                      subtitles.length > 0
                        ? subtitles[subtitles.length - 1].endFrame
                        : 0;
                    setSubtitles((prev) => [
                      ...prev,
                      {
                        id: Date.now().toString(),
                        text: "New subtitle",
                        startFrame: Math.min(lastEnd + 15, videoDuration - 60),
                        endFrame: Math.min(lastEnd + 75, videoDuration),
                      },
                    ]);
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  Add Subtitle
                </Button>
              </TabsContent>

              <TabsContent
                value="text"
                className="mt-0 outline-none p-4 overflow-auto h-max-content"
              >
                <Label className="mb-2 text-muted-foreground">
                  Custom Text Overlays
                </Label>

                {/* Quick add when no tracks */}
                {customTextTracks.length === 0 && (
                  <Button
                    variant="default"
                    className="w-full mb-4 border-dashed"
                    onClick={() => {
                      const frame = playerRef.current?.getCurrentFrame() ?? 0;
                      const newTrack: CustomTextTrack = {
                        id: `text-track-${Date.now()}`,
                        name: `Text 1`,
                        visible: true,
                        color: TEXT_TRACK_COLORS[0],
                      };
                      const newSegment: CustomTextSegment = {
                        id: `text-seg-${Date.now()}`,
                        trackId: newTrack.id,
                        text: "Your text here",
                        startFrame: Math.min(frame, compositionDuration - 60),
                        endFrame: Math.min(frame + 90, compositionDuration),
                        style: { ...DEFAULT_CUSTOM_TEXT_STYLE },
                      };
                      setCustomTextTracks((prev) => [...prev, newTrack]);
                      setCustomTextSegments((prev) => [...prev, newSegment]);
                      setSelectedTextSegment(newSegment.id);
                      playerRef.current?.seekTo(newSegment.startFrame);
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add text overlay
                  </Button>
                )}

                {/* Tracks with nested segments - collapsible */}
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {customTextTracks.map((track) => {
                    const segments = customTextSegments.filter(
                      (s) => s.trackId === track.id
                    );
                    const isExpanded = !collapsedTextTrackIds.has(track.id);
                    return (
                      <div
                        key={track.id}
                        className="rounded-lg border border-border bg-secondary/30 overflow-hidden"
                      >
                        <div className="flex items-center gap-1.5 p-2 pr-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() =>
                              setCollapsedTextTrackIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(track.id)) next.delete(track.id);
                                else next.add(track.id);
                                return next;
                              })
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronRight className="size-3.5" />
                            )}
                          </Button>
                          <span
                            className="shrink-0 w-2 h-2 rounded-full"
                            style={{ backgroundColor: track.color }}
                          />
                          <span className="text-xs font-medium truncate flex-1">
                            {track.name}
                          </span>
                          <Switch
                            checked={track.visible}
                            onCheckedChange={(visible) =>
                              setCustomTextTracks((prev) =>
                                prev.map((t) =>
                                  t.id === track.id ? { ...t, visible } : t
                                )
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              const frame =
                                playerRef.current?.getCurrentFrame() ?? 0;
                              const newSegment: CustomTextSegment = {
                                id: `text-seg-${Date.now()}`,
                                trackId: track.id,
                                text: "Your text here",
                                startFrame: Math.min(
                                  frame,
                                  compositionDuration - 60
                                ),
                                endFrame: Math.min(
                                  frame + 90,
                                  compositionDuration
                                ),
                                style: { ...DEFAULT_CUSTOM_TEXT_STYLE },
                              };
                              setCustomTextSegments((prev) => [
                                ...prev,
                                newSegment,
                              ]);
                              setSelectedTextSegment(newSegment.id);
                              playerRef.current?.seekTo(newSegment.startFrame);
                              setCollapsedTextTrackIds((prev) => {
                                const next = new Set(prev);
                                next.delete(track.id);
                                return next;
                              });
                            }}
                          >
                            <Plus className="size-3 mr-0.5" />
                            Add
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomTextTracks((prev) =>
                                prev.filter((t) => t.id !== track.id)
                              );
                              setCustomTextSegments((prev) =>
                                prev.filter((s) => s.trackId !== track.id)
                              );
                              if (
                                customTextSegments.some(
                                  (s) =>
                                    s.id === selectedTextSegment &&
                                    s.trackId === track.id
                                )
                              ) {
                                setSelectedTextSegment(null);
                              }
                            }}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-border/50 px-2 pb-2 pt-1.5 space-y-1">
                            {segments.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground py-1 px-2">
                                No segments — click Add
                              </p>
                            ) : (
                              segments.map((seg) => (
                                <div
                                  key={seg.id}
                                  data-text-segment-id={seg.id}
                                  onClick={() => {
                                    setSelectedTextSegment(seg.id);
                                    playerRef.current?.seekTo(seg.startFrame);
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md border p-2 cursor-pointer transition-colors",
                                    selectedTextSegment === seg.id
                                      ? "border-primary bg-primary/10"
                                      : "border-border/50 bg-muted/30 hover:bg-muted/50"
                                  )}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {seg.text || "Empty"}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {formatTime(seg.startFrame)} -{" "}
                                      {formatTime(seg.endFrame)}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {customTextTracks.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-4 border-dashed"
                    onClick={() => {
                      const newTrack: CustomTextTrack = {
                        id: `text-track-${Date.now()}`,
                        name: `Text ${customTextTracks.length + 1}`,
                        visible: true,
                        color:
                          TEXT_TRACK_COLORS[
                            customTextTracks.length % TEXT_TRACK_COLORS.length
                          ],
                      };
                      setCustomTextTracks((prev) => [...prev, newTrack]);
                      setCollapsedTextTrackIds((prev) => {
                        const next = new Set(prev);
                        next.delete(newTrack.id);
                        return next;
                      });
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add track
                  </Button>
                )}

                {customTextTracks.length > 0 && customTextSegments.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() => {
                      const track = customTextTracks[0];
                      if (!track) return;
                      const frame =
                        playerRef.current?.getCurrentFrame() ?? 0;
                      const newSegment: CustomTextSegment = {
                        id: `text-seg-${Date.now()}`,
                        trackId: track.id,
                        text: "Your text here",
                        startFrame: Math.min(frame, compositionDuration - 60),
                        endFrame: Math.min(frame + 90, compositionDuration),
                        style: { ...DEFAULT_CUSTOM_TEXT_STYLE },
                      };
                      setCustomTextSegments((prev) => [...prev, newSegment]);
                      setSelectedTextSegment(newSegment.id);
                      playerRef.current?.seekTo(newSegment.startFrame);
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add first segment at playhead
                  </Button>
                )}

                {/* Selected segment editor */}
                {selectedTextSegment && (() => {
                  const seg = customTextSegments.find(
                    (s) => s.id === selectedTextSegment
                  );
                  if (!seg) return null;
                  return (
                    <div className="space-y-4 border-t border-border pt-4 mt-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-muted-foreground">
                          Edit selected segment
                        </Label>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              updateTextSegment(selectedTextSegment, {
                                style: {
                                  fontFamily: style.fontFamily,
                                  fontSize: style.fontSize,
                                  fontWeight: style.fontWeight,
                                  fontStyle: style.fontStyle,
                                  lineHeight: style.lineHeight,
                                  textColor: style.textColor,
                                  strokeColor: style.strokeColor,
                                  strokeWidth: style.strokeWidth,
                                  shadowColor: style.shadowColor,
                                  shadowBlur: style.shadowBlur,
                                  shadowOpacity: style.shadowOpacity,
                                  shadowOffsetX: style.shadowOffsetX,
                                  shadowOffsetY: style.shadowOffsetY,
                                  backgroundColor: style.backgroundColor,
                                  backgroundOpacity: style.backgroundOpacity,
                                  borderRadius: style.borderRadius,
                                  paddingX: style.paddingX,
                                  paddingY: style.paddingY,
                                  containerMarginX: style.containerMarginX,
                                  position: style.position,
                                  positionY: style.positionY,
                                  animation: style.animation,
                                  uppercase: style.uppercase,
                                },
                              });
                            }}
                          >
                            Copy from subtitles
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => {
                              setCustomTextSegments((prev) =>
                                prev.filter((s) => s.id !== selectedTextSegment)
                              );
                              setSelectedTextSegment(null);
                            }}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(seg.startFrame)} - {formatTime(seg.endFrame)}
                        {" · "}
                        Drag on timeline to change
                      </div>
                      <textarea
                        value={seg.text}
                        onChange={(e) =>
                          updateTextSegment(selectedTextSegment, {
                            text: e.target.value,
                          })
                        }
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Enter your text"
                      />
                      <Tabs defaultValue="font" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 h-9 mb-3">
                          <TabsTrigger value="font" style={{ justifyContent: "center" }}>
                            <Type className="size-4" />
                          </TabsTrigger>
                          <TabsTrigger value="colors" style={{ justifyContent: "center" }}>
                            <Highlighter className="size-4" />
                          </TabsTrigger>
                          <TabsTrigger value="position" style={{ justifyContent: "center" }}>
                            <SquareCenterlineDashedVerticalIcon className="size-4" />
                          </TabsTrigger>
                          <TabsTrigger value="animation" style={{ justifyContent: "center" }}>
                            <WandSparkles className="size-4" />
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="font" className="mt-0 space-y-3">
                          <div>
                            <Label className="text-xs">Font</Label>
                            <Select
                              value={seg.style.fontFamily}
                              onValueChange={(v) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { fontFamily: v },
                                })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={SYSTEM_FONT}>
                                  System
                                </SelectItem>
                                {FONTS_LIST.map((f) => (
                                  <SelectItem
                                    key={f.family}
                                    value={f.family}
                                    style={{ fontFamily: f.family }}
                                  >
                                    {getFontDisplayName(f.family)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Label className="text-xs">Size</Label>
                              <Input
                                type="number"
                                value={seg.style.fontSize}
                                onChange={(e) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: {
                                      fontSize:
                                        parseInt(e.target.value, 10) || 60,
                                    },
                                  })
                                }
                                className="mt-1"
                                min={12}
                                max={120}
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs">Weight</Label>
                              <Select
                                value={String(seg.style.fontWeight)}
                                onValueChange={(v) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: {
                                      fontWeight: parseInt(v, 10),
                                    },
                                  })
                                }
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[400, 500, 600, 700, 800, 900].map((w) => (
                                    <SelectItem
                                      key={w}
                                      value={String(w)}
                                    >
                                      {w}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="flex flex-col flex-1 justify-between gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Italic
                                </Label>
                              </div>
                              <Switch
                                checked={seg.style.fontStyle === "italic"}
                                onCheckedChange={(checked: boolean) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: {
                                      fontStyle: checked ? "italic" : "normal",
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="flex flex-col flex-1 justify-between gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Uppercase
                                </Label>
                              </div>
                              <Switch
                                checked={seg.style.uppercase ?? false}
                                onCheckedChange={(checked: boolean) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { uppercase: checked },
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">
                              Line height ({seg.style.lineHeight ?? 1.2})
                            </Label>
                            <Slider
                              value={[seg.style.lineHeight ?? 1.2]}
                              onValueChange={([v]) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { lineHeight: v },
                                })
                              }
                              min={0.8}
                              max={2.5}
                              step={0.1}
                              className="mt-1"
                            />
                          </div>
                        </TabsContent>
                        <TabsContent value="colors" className="mt-0 space-y-3">
                          <div>
                            <Label className="text-xs">Text color</Label>
                            <div className="mt-1">
                              <ColorPickerInput
                                value={seg.style.textColor}
                                onChange={(v) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { textColor: v },
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="space-y-1 flex-1">
                              <Label className="text-xs">Stroke</Label>
                              <ColorPickerInput
                                value={seg.style.strokeColor}
                                onChange={(v) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { strokeColor: v },
                                  })
                                }
                                className="mt-1"
                              />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between">
                                <Label className="text-xs">Stroke width</Label>
                                <span className="text-xs text-muted-foreground">
                                  {seg.style.strokeWidth}px
                                </span>
                              </div>
                              <Slider
                                value={[seg.style.strokeWidth]}
                                onValueChange={([v]) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { strokeWidth: v },
                                  })
                                }
                                min={0}
                                max={6}
                                step={1}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="space-y-1 flex-1">
                              <Label className="text-xs">Shadow color</Label>
                              <ColorPickerInput
                                value={seg.style.shadowColor}
                                onChange={(v) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { shadowColor: v },
                                  })
                                }
                                className="mt-1"
                              />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between">
                                <Label className="text-xs">Shadow blur</Label>
                                <span className="text-xs text-muted-foreground">
                                  {seg.style.shadowBlur}px
                                </span>
                              </div>
                              <Slider
                                value={[seg.style.shadowBlur]}
                                onValueChange={([v]) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { shadowBlur: v },
                                  })
                                }
                                min={0}
                                max={40}
                                step={2}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <Label className="text-xs">Shadow opacity</Label>
                              <span className="text-xs text-muted-foreground">
                                {Math.round((seg.style.shadowOpacity ?? 1) * 100)}%
                              </span>
                            </div>
                            <Slider
                              value={[(seg.style.shadowOpacity ?? 1) * 100]}
                              onValueChange={([v]) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { shadowOpacity: v / 100 },
                                })
                              }
                              min={0}
                              max={100}
                              step={5}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Shadow offset X</Label>
                              <Input
                                type="number"
                                value={seg.style.shadowOffsetX}
                                onChange={(e) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: {
                                      shadowOffsetX: parseInt(e.target.value, 10) || 0,
                                    },
                                  })
                                }
                                min={-20}
                                max={20}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Shadow offset Y</Label>
                              <Input
                                type="number"
                                value={seg.style.shadowOffsetY}
                                onChange={(e) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: {
                                      shadowOffsetY: parseInt(e.target.value, 10) || 0,
                                    },
                                  })
                                }
                                min={-20}
                                max={20}
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Background</Label>
                            <div className="flex gap-2 mt-1">
                              <ColorPickerInput
                                value={seg.style.backgroundColor}
                                onChange={(v) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { backgroundColor: v },
                                  })
                                }
                              />
                              <div className="flex-1">
                                <Slider
                                  value={[seg.style.backgroundOpacity * 100]}
                                  onValueChange={([v]) =>
                                    updateTextSegment(selectedTextSegment, {
                                      style: {
                                        backgroundOpacity: v / 100,
                                      },
                                    })
                                  }
                                  min={0}
                                  max={100}
                                  step={5}
                                />
                                <span className="text-[10px] text-muted-foreground">
                                  {Math.round(seg.style.backgroundOpacity * 100)}%
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Width (padding)</span>
                                <span>{seg.style.paddingX}px</span>
                              </div>
                              <Slider
                                value={[seg.style.paddingX]}
                                onValueChange={([v]) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { paddingX: v },
                                  })
                                }
                                min={0}
                                max={48}
                                step={2}
                              />
                            </div>
                            <div className="space-y-2 flex-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Height (padding)</span>
                                <span>{seg.style.paddingY}px</span>
                              </div>
                              <Slider
                                value={[seg.style.paddingY]}
                                onValueChange={([v]) =>
                                  updateTextSegment(selectedTextSegment, {
                                    style: { paddingY: v },
                                  })
                                }
                                min={0}
                                max={32}
                                step={2}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <Label className="text-xs">Border radius</Label>
                              <span className="text-xs text-muted-foreground">
                                {seg.style.borderRadius}px
                              </span>
                            </div>
                            <Slider
                              value={[seg.style.borderRadius]}
                              onValueChange={([v]) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { borderRadius: v },
                                })
                              }
                              min={0}
                              max={24}
                              step={1}
                            />
                          </div>
                        </TabsContent>
                        <TabsContent value="position" className="mt-0 space-y-3">
                          <div>
                            <Label className="text-xs">Position</Label>
                            <Select
                              value={seg.style.position}
                              onValueChange={(v) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: {
                                    position: v as "top" | "center" | "bottom",
                                    positionY:
                                      v === "top"
                                        ? 20
                                        : v === "center"
                                          ? 50
                                          : 85,
                                  },
                                })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="top">Top</SelectItem>
                                <SelectItem value="center">Center</SelectItem>
                                <SelectItem value="bottom">Bottom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">
                              Vertical offset ({seg.style.positionY ?? 50}%)
                            </Label>
                            <Slider
                              value={[seg.style.positionY ?? 50]}
                              onValueChange={([v]) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { positionY: v },
                                })
                              }
                              min={5}
                              max={95}
                              step={1}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between">
                              <Label className="text-xs">Side margin</Label>
                              <span className="text-xs text-muted-foreground">
                                {seg.style.containerMarginX ?? 40}px
                              </span>
                            </div>
                            <Slider
                              value={[seg.style.containerMarginX ?? 40]}
                              onValueChange={([v]) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: { containerMarginX: v },
                                })
                              }
                              min={24}
                              max={200}
                              step={4}
                              className="mt-1"
                            />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Left/right margin. Larger = narrower text area.
                            </p>
                          </div>
                        </TabsContent>
                        <TabsContent value="animation" className="mt-0 space-y-3">
                          <div>
                            <Label className="text-xs">Animation</Label>
                            <Select
                              value={seg.style.animation}
                              onValueChange={(v) =>
                                updateTextSegment(selectedTextSegment, {
                                  style: {
                                    animation: v as
                                      | "none"
                                      | "fade"
                                      | "pop"
                                      | "slide"
                                      | "typewriter",
                                  },
                                })
                              }
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="fade">Fade</SelectItem>
                                <SelectItem value="pop">Pop</SelectItem>
                                <SelectItem value="slide">Slide</SelectItem>
                                <SelectItem value="typewriter">
                                  Typewriter
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  );
                })()}

                {!selectedTextSegment && customTextSegments.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Click a segment above or on the timeline to edit
                  </p>
                )}
              </TabsContent>

              <TabsContent
                value="banners"
                className="mt-0 outline-none p-4 overflow-auto h-max-content"
              >
                <Label className="mb-2 text-muted-foreground">
                  Social Banners
                </Label>

                {bannerTracks.length === 0 && (
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-1 gap-2">
                      {BANNER_PRESETS.map((preset) => (
                        <Button
                          key={preset.id}
                          variant="outline"
                          className="flex flex-col items-start p-4 h-auto text-left"
                          onClick={() => {
                            const frame =
                              playerRef.current?.getCurrentFrame() ?? 0;
                            const newTrack: BannerTrack = {
                              id: `banner-track-${Date.now()}`,
                              name: preset.name,
                              visible: true,
                              color: BANNER_TRACK_COLORS[0],
                            };
                            const newSegment: BannerSegment = {
                              id: `banner-seg-${Date.now()}`,
                              trackId: newTrack.id,
                              logoUrl: preset.logoUrl,
                              text: "YOUR-PAGE.URL",
                              startFrame: Math.min(
                                frame,
                                compositionDuration - 60
                              ),
                              endFrame: Math.min(
                                frame + 90,
                                compositionDuration
                              ),
                              style: { ...preset.style },
                            };
                            setBannerTracks((prev) => [...prev, newTrack]);
                            setBannerSegments((prev) => [
                              ...prev,
                              newSegment,
                            ]);
                            setSelectedBannerSegment(newSegment.id);
                            playerRef.current?.seekTo(newSegment.startFrame);
                          }}
                        >
                          <span className="font-semibold">{preset.name}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {bannerTracks.map((track) => {
                    const segments = bannerSegments.filter(
                      (s) => s.trackId === track.id
                    );
                    const isExpanded = !collapsedBannerTrackIds.has(track.id);
                    return (
                      <div
                        key={track.id}
                        className="rounded-lg border border-border bg-secondary/30 overflow-hidden"
                      >
                        <div className="flex items-center gap-1.5 p-2 pr-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() =>
                              setCollapsedBannerTrackIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(track.id)) next.delete(track.id);
                                else next.add(track.id);
                                return next;
                              })
                            }
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <ChevronRight className="size-3.5" />
                            )}
                          </Button>
                          <span
                            className="shrink-0 w-2 h-2 rounded-full"
                            style={{ backgroundColor: track.color }}
                          />
                          <span className="text-xs font-medium truncate flex-1">
                            {track.name}
                          </span>
                          <Switch
                            checked={track.visible}
                            onCheckedChange={(visible) =>
                              setBannerTracks((prev) =>
                                prev.map((t) =>
                                  t.id === track.id ? { ...t, visible } : t
                                )
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Popover
                            open={bannerPresetPopoverTrackId === track.id}
                            onOpenChange={(open) =>
                              setBannerPresetPopoverTrackId(open ? track.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5 text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Plus className="size-3 mr-0.5" />
                                Add
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-64 p-2"
                              align="end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-xs font-medium text-muted-foreground px-2 py-1.5 mb-1">
                                Choose style
                              </div>
                              <div className="space-y-0.5">
                                {BANNER_PRESETS.map((preset) => (
                                  <Button
                                    key={preset.id}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start h-auto py-2 px-2 text-left"
                                    onClick={() => {
                                      setBannerPresetPopoverTrackId(null);
                                      const frame =
                                        playerRef.current?.getCurrentFrame() ??
                                        0;
                                      const newSegment: BannerSegment = {
                                        id: `banner-seg-${Date.now()}`,
                                        trackId: track.id,
                                        logoUrl: preset.logoUrl,
                                        text: "YOUR-PAGE.URL",
                                        startFrame: Math.min(
                                          frame,
                                          compositionDuration - 60
                                        ),
                                        endFrame: Math.min(
                                          frame + 90,
                                          compositionDuration
                                        ),
                                        style: { ...preset.style },
                                      };
                                      setBannerSegments((prev) => [
                                        ...prev,
                                        newSegment,
                                      ]);
                                      setSelectedBannerSegment(newSegment.id);
                                      playerRef.current?.seekTo(
                                        newSegment.startFrame
                                      );
                                      setCollapsedBannerTrackIds((prev) => {
                                        const next = new Set(prev);
                                        next.delete(track.id);
                                        return next;
                                      });
                                    }}
                                  >
                                    <span className="font-medium">
                                      {preset.name}
                                    </span>
                                  </Button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBannerTracks((prev) =>
                                prev.filter((t) => t.id !== track.id)
                              );
                              setBannerSegments((prev) =>
                                prev.filter((s) => s.trackId !== track.id)
                              );
                              if (
                                bannerSegments.some(
                                  (s) =>
                                    s.id === selectedBannerSegment &&
                                    s.trackId === track.id
                                )
                              ) {
                                setSelectedBannerSegment(null);
                              }
                            }}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-border/50 px-2 pb-2 pt-1.5 space-y-1">
                            {segments.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground py-1 px-2">
                                No segments — click Add
                              </p>
                            ) : (
                              segments.map((seg) => (
                                <div
                                  key={seg.id}
                                  data-banner-segment-id={seg.id}
                                  onClick={() => {
                                    setSelectedBannerSegment(seg.id);
                                    playerRef.current?.seekTo(seg.startFrame);
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md border p-2 cursor-pointer transition-colors",
                                    selectedBannerSegment === seg.id
                                      ? "border-primary bg-primary/10"
                                      : "border-border/50 bg-muted/30 hover:bg-muted/50"
                                  )}
                                >
                                  {seg.logoUrl ? (
                                    <img
                                      src={seg.logoUrl}
                                      alt=""
                                      className="w-8 h-8 object-contain rounded shrink-0"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded bg-muted shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                                      +
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">
                                      {seg.text || "Empty"}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {formatTime(seg.startFrame)} -{" "}
                                      {formatTime(seg.endFrame)}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {bannerTracks.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-4 border-dashed"
                    onClick={() => {
                      const newTrack: BannerTrack = {
                        id: `banner-track-${Date.now()}`,
                        name: `Banner ${bannerTracks.length + 1}`,
                        visible: true,
                        color:
                          BANNER_TRACK_COLORS[
                            bannerTracks.length % BANNER_TRACK_COLORS.length
                          ],
                      };
                      setBannerTracks((prev) => [...prev, newTrack]);
                      setCollapsedBannerTrackIds((prev) => {
                        const next = new Set(prev);
                        next.delete(newTrack.id);
                        return next;
                      });
                    }}
                  >
                    <Plus className="mr-2 size-4" />
                    Add track
                  </Button>
                )}

                {selectedBannerSegment && (() => {
                  const seg = bannerSegments.find(
                    (s) => s.id === selectedBannerSegment
                  );
                  if (!seg) return null;

                  return (
                    <div className="space-y-4 border-t border-border pt-4 mt-4">
                      <Label className="text-muted-foreground">
                        Edit selected banner
                      </Label>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(seg.startFrame)} - {formatTime(seg.endFrame)}
                        {" · "}
                        Drag on timeline to change
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs">Text</Label>
                          <Input
                            value={seg.text}
                            onChange={(e) =>
                              setBannerSegments((prev) =>
                                prev.map((s) =>
                                  s.id === selectedBannerSegment
                                    ? { ...s, text: e.target.value }
                                    : s
                                )
                              )
                            }
                            placeholder="YOUR-PAGE.URL"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Text color</Label>
                          <ColorPickerInput
                            value={seg.style.textColor}
                            onChange={(v) =>
                              setBannerSegments((prev) =>
                                prev.map((s) =>
                                  s.id === selectedBannerSegment
                                    ? { ...s, style: { ...s.style, textColor: v } }
                                    : s
                                )
                              )
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Background</Label>
                          <div className="flex gap-2 mt-1">
                            <ColorPickerInput
                              value={seg.style.backgroundColor}
                              onChange={(v) =>
                                setBannerSegments((prev) =>
                                  prev.map((s) =>
                                    s.id === selectedBannerSegment
                                      ? {
                                          ...s,
                                          style: { ...s.style, backgroundColor: v },
                                        }
                                      : s
                                  )
                                )
                              }
                            />
                            <div className="flex-1">
                              <Slider
                                value={[seg.style.backgroundOpacity * 100]}
                                onValueChange={([v]) =>
                                  setBannerSegments((prev) =>
                                    prev.map((s) =>
                                      s.id === selectedBannerSegment
                                        ? {
                                            ...s,
                                            style: {
                                              ...s.style,
                                              backgroundOpacity: v / 100,
                                            },
                                          }
                                        : s
                                    )
                                  )
                                }
                                min={0}
                                max={100}
                                step={5}
                              />
                              <span className="text-[10px] text-muted-foreground">
                                {Math.round(seg.style.backgroundOpacity * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">
                            Vertical position ({seg.style.positionY ?? 90}%)
                          </Label>
                          <Slider
                            value={[seg.style.positionY ?? 90]}
                            onValueChange={([v]) =>
                              setBannerSegments((prev) =>
                                prev.map((s) =>
                                  s.id === selectedBannerSegment
                                    ? {
                                        ...s,
                                        style: { ...s.style, positionY: v },
                                      }
                                    : s
                                )
                              )
                            }
                            min={0}
                            max={100}
                            step={1}
                            className="mt-1"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            0% = top, 100% = bottom
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs">Animation</Label>
                          <Select
                            value={seg.style.animation}
                            onValueChange={(v) =>
                              setBannerSegments((prev) =>
                                prev.map((s) =>
                                  s.id === selectedBannerSegment
                                    ? {
                                        ...s,
                                        style: {
                                          ...s.style,
                                          animation: v as BannerStyle["animation"],
                                        },
                                      }
                                    : s
                                )
                              )
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="fade">Fade</SelectItem>
                              <SelectItem value="slide-up">Slide up</SelectItem>
                              <SelectItem value="slide-down">Slide down</SelectItem>
                              <SelectItem value="slide-left">Slide left</SelectItem>
                              <SelectItem value="slide-right">Slide right</SelectItem>
                              <SelectItem value="pop">Pop</SelectItem>
                              <SelectItem value="bounce">Bounce</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label className="text-xs">Border radius</Label>
                            <span className="text-xs text-muted-foreground">
                              {seg.style.borderRadius}px
                            </span>
                          </div>
                          <Slider
                            value={[seg.style.borderRadius]}
                            onValueChange={([v]) =>
                              setBannerSegments((prev) =>
                                prev.map((s) =>
                                  s.id === selectedBannerSegment
                                    ? {
                                        ...s,
                                        style: { ...s.style, borderRadius: v },
                                      }
                                    : s
                                )
                              )
                            }
                            min={0}
                            max={32}
                            step={1}
                          />
                        </div>
                      </div>

                      <div className="border-t border-border pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-muted-foreground h-8"
                          onClick={() =>
                            setBannerEditorMoreOptionsOpen(
                              !bannerEditorMoreOptionsOpen
                            )
                          }
                        >
                          {bannerEditorMoreOptionsOpen ? (
                            <ChevronDown className="size-4 mr-2" />
                          ) : (
                            <ChevronRight className="size-4 mr-2" />
                          )}
                          More options
                        </Button>
                        {bannerEditorMoreOptionsOpen && (
                          <div className="space-y-3 mt-2 pl-6">
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Label className="text-xs">Logo width</Label>
                                <Input
                                  type="number"
                                  value={seg.style.logoWidth}
                                  onChange={(e) =>
                                    setBannerSegments((prev) =>
                                      prev.map((s) =>
                                        s.id === selectedBannerSegment
                                          ? {
                                              ...s,
                                              style: {
                                                ...s.style,
                                                logoWidth:
                                                  parseInt(e.target.value, 10) ||
                                                  80,
                                              },
                                            }
                                          : s
                                      )
                                    )
                                  }
                                  min={20}
                                  max={300}
                                  className="mt-1"
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">Logo height</Label>
                                <Input
                                  type="number"
                                  value={seg.style.logoHeight}
                                  onChange={(e) =>
                                    setBannerSegments((prev) =>
                                      prev.map((s) =>
                                        s.id === selectedBannerSegment
                                          ? {
                                              ...s,
                                              style: {
                                                ...s.style,
                                                logoHeight:
                                                  parseInt(e.target.value, 10) ||
                                                  80,
                                              },
                                            }
                                          : s
                                      )
                                    )
                                  }
                                  min={20}
                                  max={200}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">
                                Text font size ({seg.style.fontSize}px)
                              </Label>
                              <Slider
                                value={[seg.style.fontSize]}
                                onValueChange={([v]) =>
                                  setBannerSegments((prev) =>
                                    prev.map((s) =>
                                      s.id === selectedBannerSegment
                                        ? {
                                            ...s,
                                            style: { ...s.style, fontSize: v },
                                          }
                                        : s
                                    )
                                  )
                                }
                                min={12}
                                max={72}
                                step={2}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive"
                        onClick={() => {
                          setBannerSegments((prev) =>
                            prev.filter((s) => s.id !== selectedBannerSegment)
                          );
                          setSelectedBannerSegment(null);
                        }}
                      >
                        <X className="mr-2 size-4" />
                        Remove banner
                      </Button>
                    </div>
                  );
                })()}

                {!selectedBannerSegment && bannerSegments.length > 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Click a segment above or on the timeline to edit
                  </p>
                )}
              </TabsContent>

				  <TabsContent
				  value="timeline"
				  className="mt-0 outline-none px-0 overflow-auto h-max-content"
				  >
				    <Timeline
				      alwaysExpanded
				      hidePlayButton
				      initialZoomMultiplier={2.5}
				      subtitles={subtitles}
				      setSubtitles={setSubtitles}
				      selectedSubtitle={selectedSubtitle}
				      setSelectedSubtitle={(id) => {
				        setSelectedSubtitle(id);
				        setSelectedVideoSegment(null);
				        setSelectedTextSegment(null);
				        setSelectedBannerSegment(null);
				        if (id) playerRef.current?.seekTo(subtitles.find((s) => s.id === id)?.startFrame ?? 0);
				      }}
				      videoSegments={videoSegments}
				      setVideoSegments={setVideoSegments}
				      deletedRanges={deletedRanges}
				      setDeletedRanges={setDeletedRanges}
				      selectedVideoSegment={selectedVideoSegment}
				      setSelectedVideoSegment={(id) => {
				        setSelectedVideoSegment(id);
				        setSelectedSubtitle(null);
				        setSelectedTextSegment(null);
				        setSelectedBannerSegment(null);
				      }}
				      playerRef={playerRef}
				      videoDuration={compositionDuration}
				      fps={FPS}
				      videoUrl={videoUrl}
				      onSeek={handleSeek}
				      onDeleteRequest={handleDeleteRequest}
				      onDeleteTextSegment={(id) => {
				        setCustomTextSegments((prev) => prev.filter((s) => s.id !== id));
				        setSelectedTextSegment(null);
				      }}
				      onCropClick={() => {
				        if (!videoUrl) return;
				        if (videoSegments.length > 0) {
				          const seg = selectedVideoSegment
				            ? videoSegments.find((s) => s.id === selectedVideoSegment)
				            : null;
				          if (!seg) return;
				          setCropDialogClip({
				            url: seg.sourceVideoUrl,
				            trimStartSeconds: seg.sourceStartFrame / FPS,
				            trimEndSeconds: seg.sourceEndFrame / FPS,
				            segmentId: seg.id,
				          });
				        } else {
				          setCropDialogClip({
				            url: videoUrl,
				            trimStartSeconds: 0,
				            trimEndSeconds: undefined,
				          });
				        }
				        setShowCropDialog(true);
				      }}
				      onAddTextTrackClick={() => {
				        setLeftPanelTab("text");
				        setMobilePanelTab("text");
				      }}
				      setRawSegmentSubtitles={setRawSegmentSubtitles}
				      setWordSubtitles={setWordSubtitles}
				      customTextTracks={customTextTracks}
				      setCustomTextTracks={setCustomTextTracks}
				      customTextSegments={customTextSegments}
				      setCustomTextSegments={setCustomTextSegments}
				      selectedTextSegment={selectedTextSegment}
				      setSelectedTextSegment={(id) => {
				        setSelectedTextSegment(id);
				        setSelectedSubtitle(null);
				        setSelectedVideoSegment(null);
				        setSelectedBannerSegment(null);
				        if (id) {
				          setLeftPanelTab("text");
				          setMobilePanelTab("text");
				          const seg = customTextSegments.find((s) => s.id === id);
				          if (seg) {
				            setCollapsedTextTrackIds((prev) => {
				              const next = new Set(prev);
				              next.delete(seg.trackId);
				              return next;
				            });
				          }
				        }
				      }}
				      onAddBannerClick={() => {
				        setLeftPanelTab("banners");
				        setMobilePanelTab("banners");
				      }}
				      onDeleteBannerSegment={(id) => {
				        setBannerSegments((prev) => prev.filter((s) => s.id !== id));
				        setSelectedBannerSegment(null);
				      }}
				      bannerTracks={bannerTracks}
				      setBannerTracks={setBannerTracks}
				      bannerSegments={bannerSegments}
				      setBannerSegments={setBannerSegments}
				      selectedBannerSegment={selectedBannerSegment}
				      setSelectedBannerSegment={(id) => {
				        setSelectedBannerSegment(id);
				        setSelectedSubtitle(null);
				        setSelectedVideoSegment(null);
				        setSelectedTextSegment(null);
				        if (id) {
				          const seg = bannerSegments.find((s) => s.id === id);
				          if (seg) playerRef.current?.seekTo(seg.startFrame);
				        }
				      }}
				    />
				  </TabsContent>
              </div>
            </div>
          </Tabs>
			 </div>


        {/* Center - Video Preview */}
        <main className="flex min-h-0 flex-1 flex-col min-w-0 items-center justify-center bg-black/20 dark:bg-white/20 sm:flex-2 transition-[height] duration-300 ease-out sm:transition-none">
          <div
            className="h-full max-h-full max-w-full mx-4 mt-4 sm:m-4 transition-[width,height] duration-300 ease-out sm:transition-none"
            style={{ aspectRatio: "9 / 16" }}
          >
            <Player
              key={videoUrl ?? "no-video"}
              ref={playerRef}
              component={SubtitleComposition}
              inputProps={{
                videoUrl,
                videoSegments: videoSegments.length > 0 ? videoSegments : undefined,
                subtitles,
                style,
                videoStartFrom,
                subtitleMode,
                highlightColor,
                videoTransform,
                videoAspectRatio,
                customTextSegments,
                customTextTracks,
                bannerSegments,
                bannerTracks,
              }}
              durationInFrames={compositionDuration}
              fps={FPS}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{ width: "100%", height: "100%" }}
              loop
            />
          </div>
          {/* Mobile play control - below video, above timeline in aside */}
          <div className="flex sm:hidden w-full justify-center px-4">
            <Button
              variant="ghost"
              size="lg"
              className="h-12 w-12 rounded-full"
              onClick={() => {
                if (!playerRef.current) return;
                if (isPlaying) {
                  playerRef.current.pause();
                } else {
                  playerRef.current.play();
                }
              }}
              disabled={!videoUrl}
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="size-6" />
              ) : (
                <Play className="size-6" />
              )}
            </Button>
          </div>
          <VideoCropDialog
            open={showCropDialog}
            onOpenChange={(open) => {
              setShowCropDialog(open);
              if (!open) setCropDialogClip(null);
            }}
            videoUrl={cropDialogClip?.url ?? videoUrl}
            currentTransform={
              cropDialogClip?.segmentId
                ? (videoSegments.find(
                    (s) => s.id === cropDialogClip.segmentId
                  )?.transform ?? videoTransform)
                : videoTransform
            }
            onApply={(transform) => {
              if (cropDialogClip?.segmentId) {
                setVideoSegments((prev) =>
                  prev.map((s) =>
                    s.id === cropDialogClip.segmentId
                      ? { ...s, transform }
                      : s
                  )
                );
              } else {
                setVideoTransform(transform);
              }
            }}
            compositionWidth={1080}
            compositionHeight={1920}
            initialVideoAspectRatio={videoAspectRatio}
            onVideoDimensionsLoaded={(w, h) =>
              setVideoAspectRatio(h > 0 ? w / h : 16 / 9)
            }
            trimStartSeconds={cropDialogClip?.trimStartSeconds ?? 0}
            trimEndSeconds={cropDialogClip?.trimEndSeconds}
          />
			 <div className="hidden sm:flex sm:w-full">
          <Timeline
            subtitles={subtitles}
            setSubtitles={setSubtitles}
            selectedSubtitle={selectedSubtitle}
            setSelectedSubtitle={(id) => {
              setSelectedSubtitle(id);
              setSelectedVideoSegment(null);
              setSelectedTextSegment(null);
              setSelectedBannerSegment(null);
              if (id) {
                setLeftPanelCollapsed(false);
                setLeftPanelTab("subtitles");
              }
            }}
            videoSegments={videoSegments}
            setVideoSegments={setVideoSegments}
            deletedRanges={deletedRanges}
            setDeletedRanges={setDeletedRanges}
            selectedVideoSegment={selectedVideoSegment}
            setSelectedVideoSegment={(id) => {
              setSelectedVideoSegment(id);
              setSelectedSubtitle(null);
              setSelectedTextSegment(null);
              setSelectedBannerSegment(null);
            }}
            playerRef={playerRef}
            videoDuration={compositionDuration}
            fps={FPS}
            videoUrl={videoUrl}
            onSeek={handleSeek}
            onDeleteRequest={handleDeleteRequest}
            onDeleteTextSegment={(id) => {
              setCustomTextSegments((prev) => prev.filter((s) => s.id !== id));
              setSelectedTextSegment(null);
            }}
            onCropClick={() => {
              if (!videoUrl) return;
              if (videoSegments.length > 0) {
                const seg = selectedVideoSegment
                  ? videoSegments.find((s) => s.id === selectedVideoSegment)
                  : null;
                if (!seg) return;
                setCropDialogClip({
                  url: seg.sourceVideoUrl,
                  trimStartSeconds: seg.sourceStartFrame / FPS,
                  trimEndSeconds: seg.sourceEndFrame / FPS,
                  segmentId: seg.id,
                });
              } else {
                setCropDialogClip({
                  url: videoUrl,
                  trimStartSeconds: 0,
                  trimEndSeconds: undefined,
                });
              }
              setShowCropDialog(true);
            }}
            onAddTextTrackClick={() => {
              setLeftPanelCollapsed(false);
              setLeftPanelTab("text");
            }}
            setRawSegmentSubtitles={setRawSegmentSubtitles}
            setWordSubtitles={setWordSubtitles}
            customTextTracks={customTextTracks}
            setCustomTextTracks={setCustomTextTracks}
            customTextSegments={customTextSegments}
            setCustomTextSegments={setCustomTextSegments}
            selectedTextSegment={selectedTextSegment}
            setSelectedTextSegment={(id) => {
              setSelectedTextSegment(id);
              setSelectedSubtitle(null);
              setSelectedVideoSegment(null);
              setSelectedBannerSegment(null);
              if (id) {
                setLeftPanelCollapsed(false);
                setLeftPanelTab("text");
                const seg = customTextSegments.find((s) => s.id === id);
                if (seg) {
                  setCollapsedTextTrackIds((prev) => {
                    const next = new Set(prev);
                    next.delete(seg.trackId);
                    return next;
                  });
                }
              }
            }}
            onAddBannerClick={() => {
              setLeftPanelCollapsed(false);
              setLeftPanelTab("banners");
            }}
            onDeleteBannerSegment={(id) => {
              setBannerSegments((prev) => prev.filter((s) => s.id !== id));
              setSelectedBannerSegment(null);
            }}
            bannerTracks={bannerTracks}
            setBannerTracks={setBannerTracks}
            bannerSegments={bannerSegments}
            setBannerSegments={setBannerSegments}
            selectedBannerSegment={selectedBannerSegment}
            setSelectedBannerSegment={(id) => {
              setSelectedBannerSegment(id);
              setSelectedSubtitle(null);
              setSelectedVideoSegment(null);
              setSelectedTextSegment(null);
              if (id) {
                setLeftPanelCollapsed(false);
                setLeftPanelTab("banners");
                const seg = bannerSegments.find((s) => s.id === id);
                if (seg) {
                  setCollapsedBannerTrackIds((prev) => {
                    const next = new Set(prev);
                    next.delete(seg.trackId);
                    return next;
                  });
                }
              }
            }}
          />
			 </div>
          <DeletionDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            type="subtitle"
            onConfirm={(deleteVideo) => {
              handleDeleteConfirm(deleteVideo, pendingDeleteSubtitleId);
            }}
            onCancel={() => {
              setPendingDeleteSubtitleId(null);
              setShowDeleteDialog(false);
            }}
          />
        </main>
      </div>
    </div>
  );
}
