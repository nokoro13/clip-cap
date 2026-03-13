"use client";

import { Player, PlayerRef } from "@remotion/player";
import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { X, Plus, Download, ArrowLeft, Palette, Crop, PanelLeftClose, PanelLeft, Captions, Type, Highlighter, SquareCenterlineDashedVerticalIcon, WandSparkles, Pencil } from "lucide-react";
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
import { Timeline } from "@/components/timeline/Timeline";
import { VideoCropDialog } from "@/components/video-crop-dialog";

const FPS = 30;

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
      animation: "fade",
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
      fontFamily: "Poppins",
      fontSize: 56,
      fontWeight: 700,
      textColor: "#ffffff",
      backgroundColor: "#000000",
      backgroundOpacity: 0,
      strokeWidth: 0,
      borderRadius: 4,
      animation: "pop",
      positionY: 70,
      fontStyle: "italic",
      lineHeight: 1.3,
      wordSpacing: 0,
      uppercase: true,
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
      fontFamily: "Rubik",
      fontSize: 58,
      fontWeight: 700,
      textColor: "#00ffff",
      backgroundColor: "transparent",
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowColor: "#00ffff",
      shadowBlur: 20,
      shadowOpacity: 1,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      animation: "none",
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
        words: segment.words,
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
      text: chunkWords.map((w) => w.text).join(" "),
      startFrame,
      endFrame: endFrame <= startFrame ? startFrame + 1 : endFrame,
      words: chunkWords,
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
          .map((c) => c.text)
          .join(" ")
          .trim(),
        startFrame,
        endFrame: endFrame <= startFrame ? startFrame + 1 : endFrame,
        words: currentGroup.map((c) => ({
          text: c.text,
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
        .map((c) => c.text)
        .join(" ")
        .trim(),
      startFrame,
      endFrame: endFrame <= startFrame ? startFrame + 1 : endFrame,
      words: currentGroup.map((c) => ({
        text: c.text,
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

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(300); // Default 10 seconds at 30fps
  const [videoStartFrom, setVideoStartFrom] = useState(0); // Start offset in ms for clips
  const [isLoading, setIsLoading] = useState(true);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [customizePanelOpen, setCustomizePanelOpen] = useState(false);
  /** Weights supported by the currently selected font (for Google Fonts). */
  const [availableWeights, setAvailableWeights] = useState<number[]>([
    400, 700,
  ]);
  const [leftPanelWidth, setLeftPanelWidth] = useState(420);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [resizingPanel, setResizingPanel] = useState(false);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
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

      // Resolve video URL: prefer IndexedDB (fresh blob URL that survives refresh). Stale blob URLs
      // in sessionStorage still exist after refresh but fail to play, so we try IndexedDB first.
      let initialVideoUrl: string | null = null;
      if (projectId) {
        const fromIdb = await getVideoBlobUrl(projectId);
        if (fromIdb) {
          initialVideoUrl = fromIdb;
          if (typeof sessionStorage !== "undefined") {
            sessionStorage.setItem(`video-${projectId}`, fromIdb);
          }
        }
      }
      if (!initialVideoUrl && typeof sessionStorage !== "undefined") {
        initialVideoUrl = sessionStorage.getItem(`video-${projectId}`);
      }
      if (!initialVideoUrl && storedProject) {
        try {
          const p = JSON.parse(storedProject);
          initialVideoUrl = p.videoUrl || p.blobUrl || null;
        } catch {
          // ignore
        }
      }
      // For YouTube-sourced clips, use our stream proxy (raw yt-dlp URLs are blocked in browser by CORS).
      // Use absolute URL so Remotion OffthreadVideo can load the video reliably.
      if (storedProject) {
        try {
          const p = JSON.parse(storedProject);
          if (p.youtubeVideoId) {
            const origin =
              typeof window !== "undefined" ? window.location.origin : "";
            initialVideoUrl = `${origin}/api/youtube-stream/${p.youtubeVideoId}`;
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem(`video-${projectId}`, initialVideoUrl);
            }
          }
        } catch {
          // keep existing initialVideoUrl
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

  // Persist videoTransform and videoAspectRatio to project in localStorage
  useEffect(() => {
    const projectId = params.id as string;
    if (!projectId || typeof localStorage === "undefined") return;
    const stored = localStorage.getItem(`project-${projectId}`);
    if (!stored) return;
    try {
      const project = JSON.parse(stored);
      localStorage.setItem(
        `project-${projectId}`,
        JSON.stringify({ ...project, videoTransform, videoAspectRatio })
      );
    } catch {
      // ignore
    }
  }, [params.id, videoTransform, videoAspectRatio]);

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
      if (preset.subtitleMode !== undefined) {
        setSubtitleMode(preset.subtitleMode);
        if (preset.subtitleMode === "word") {
          if (wordSubtitles.length > 0) setSubtitles(wordSubtitles);
        } else {
          if (segmentSubtitles.length > 0) setSubtitles(segmentSubtitles);
        }
      }
      if (preset.maxWordsPerSegment !== undefined)
        setMaxWordsPerSegment(preset.maxWordsPerSegment);
      if (preset.highlightColor !== undefined)
        setHighlightColor(preset.highlightColor);
      setActivePreset(preset.id);
    },
    [wordSubtitles, segmentSubtitles]
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

  const removeSubtitle = useCallback(
    (id: string) => {
      setSubtitles((prev) => prev.filter((s) => s.id !== id));
      if (selectedSubtitle === id) setSelectedSubtitle(null);
    },
    [selectedSubtitle]
  );

  const MIN_LEFT_PANEL = 260;
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
      playerRef.current?.seekTo(Math.max(0, Math.min(frame, videoDuration)));
    },
    [videoDuration]
  );

  // Keyboard shortcut for splitting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "s" || e.key === "S") {
        const activeElement = document.activeElement;
        // Don't trigger if user is typing in an input/textarea
        if (
          activeElement?.tagName === "INPUT" ||
          activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }
        e.preventDefault();
        // Trigger split - the Timeline component will handle it
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      <div className="flex min-h-0 flex-1">
        {/* Left Panel - Tabs: Styling & Subtitles (resizable, collapsible) */}
        <aside
          style={{
            width: leftPanelCollapsed ? 48 : leftPanelWidth,
            transition: "width 0.2s ease-out",
          }}
          className="relative flex min-h-0 flex-shrink-0 flex-col overflow-hidden border-r border-border"
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
              <PanelLeft className="size-6" />
            ) : (
              <PanelLeftClose className="size-6" />
            )}
          </Button>

          {!leftPanelCollapsed && (
            <>
          <Tabs
            defaultValue="styling"
            className="flex flex-1 flex-row overflow-hidden pt-10"
				orientation="vertical"
          >
            <TabsList variant="line" className="shrink-0 mt-4 gap-4">
              <TabsTrigger value="styling" className="border-none">
                <Palette className="size-6" />
              </TabsTrigger>
              <TabsTrigger value="subtitles" className="border-none">
                <Captions className="size-6" />
              </TabsTrigger>
            </TabsList>
            <div className="relative flex-1 flex min-h-0 flex-col">
              <TabsContent
                value="styling"
                className="mt-0 flex flex-1 flex-col outline-none p-4 gap-4"
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
                <div className="flex-1 overflow-y-auto">
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
                            <Type className="size-6" />
                          </TabsTrigger>
                          <TabsTrigger
                            value="background"
                            className="border-none"
                            style={{ justifyContent: "center" }}
                          >
                            <Highlighter
                              className="size-6"
                            />
                          </TabsTrigger>
                          <TabsTrigger
                            value="alignment"
                            className="border-none"
                            style={{ justifyContent: "center" }}
                          >
                            <SquareCenterlineDashedVerticalIcon
                              className="size-6"
                            />
                          </TabsTrigger>
                          <TabsTrigger value="effects" className="border-none" style={{ justifyContent: "center" }}>
                            <WandSparkles className="size-6" />
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
                                  Stroke Width
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
                                  Word spacing
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
                                  Shadow Blur
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
                      onClick={() => {
                        setSelectedSubtitle(sub.id);
                        playerRef.current?.seekTo(sub.startFrame);
                      }}
                      className={cn(
                        "cursor-pointer rounded-lg border bg-secondary p-3 transition-colors hover:bg-secondary/80",
                        selectedSubtitle === sub.id
                          ? "border-primary"
                          : "border-transparent"
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

        {/* Center - Video Preview */}
        <main className="flex flex-col min-w-0 flex-2 items-center justify-center bg-black/20 dark:bg-white/20">
          <div
            className="h-full max-h-full max-w-full m-4"
            style={{ aspectRatio: "9 / 16" }}
          >
            <Player
              key={videoUrl ?? "no-video"}
              ref={playerRef}
              component={SubtitleComposition}
              inputProps={{
                videoUrl,
                subtitles,
                style,
                videoStartFrom,
                subtitleMode,
                highlightColor,
                videoTransform,
                videoAspectRatio,
              }}
              durationInFrames={videoDuration}
              fps={FPS}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{ width: "100%", height: "100%" }}
              controls
              loop
            />
          </div>
          {/* Crop controls - between player and timeline */}
          <div className="flex items-center justify-center pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCropDialog(true)}
              disabled={!videoUrl}
            >
              <Crop className="h-4 w-4" />
            </Button>
          </div>
          <VideoCropDialog
            open={showCropDialog}
            onOpenChange={setShowCropDialog}
            videoUrl={videoUrl}
            currentTransform={videoTransform}
            onApply={setVideoTransform}
            compositionWidth={1080}
            compositionHeight={1920}
            initialVideoAspectRatio={videoAspectRatio}
            onVideoDimensionsLoaded={(w, h) =>
              setVideoAspectRatio(h > 0 ? w / h : 16 / 9)
            }
          />
          <Timeline
            subtitles={subtitles}
            setSubtitles={setSubtitles}
            selectedSubtitle={selectedSubtitle}
            setSelectedSubtitle={setSelectedSubtitle}
            playerRef={playerRef}
            videoDuration={videoDuration}
            fps={FPS}
            videoUrl={videoUrl}
            onSeek={handleSeek}
          />
        </main>
      </div>
    </div>
  );
}
