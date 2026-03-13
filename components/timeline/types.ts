import type { Subtitle } from "../../remotion/Composition";
import type { PlayerRef } from "@remotion/player";

export interface TimelineProps {
  subtitles: Subtitle[];
  setSubtitles: React.Dispatch<React.SetStateAction<Subtitle[]>>;
  selectedSubtitle: string | null;
  setSelectedSubtitle: React.Dispatch<React.SetStateAction<string | null>>;
  /** When provided, timeline syncs playhead from the player (no parent re-renders). Otherwise use currentFrame prop. */
  playerRef?: React.RefObject<PlayerRef | null>;
  /** Fallback when playerRef is not provided */
  currentFrame?: number;
  videoDuration: number;
  fps: number;
  videoUrl: string | null;
  onSeek: (frame: number) => void;
}

export interface DragState {
  id: string;
  type: "move" | "trim-start" | "trim-end";
  startX: number;
  startFrame: number;
  endFrame: number;
}

export interface TimelineState {
  zoom: number; // pixels per second
  scrollLeft: number;
  isExpanded: boolean;
}

export interface TrackProps {
  videoDuration: number;
  fps: number;
  zoom: number;
}

export interface SubtitleSegmentProps {
  subtitle: Subtitle;
  index: number;
  isSelected: boolean;
  videoDuration: number;
  fps: number;
  zoom: number;
  color: string;
  onSelect: (id: string) => void;
  onDragStart: (
    e: React.MouseEvent,
    id: string,
    type: "move" | "trim-start" | "trim-end"
  ) => void;
}

export interface TimelineRulerProps {
  videoDuration: number;
  fps: number;
  zoom: number;
  currentFrame: number;
  onSeek: (frame: number) => void;
}
