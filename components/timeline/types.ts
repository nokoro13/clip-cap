import type { Subtitle } from "../../remotion/Composition";
import type { PlayerRef } from "@remotion/player";

/** Video segment - represents a portion of the source video on the timeline */
export interface VideoSegment {
  id: string;
  startFrame: number; // Position in timeline
  endFrame: number; // Position in timeline
  sourceStartFrame: number; // Where in source video
  sourceEndFrame: number; // Where in source video
  sourceVideoUrl: string; // Original video URL
}

/** Deleted time range - persists across preset changes */
export interface DeletedRange {
  id: string;
  startFrame: number;
  endFrame: number;
  affectsVideo: boolean; // true = video cut, false = subtitle only
}

/** Enhanced subtitle with soft-delete flag */
export type EnhancedSubtitle = Subtitle & {
  isDeleted?: boolean;
};

export interface TimelineProps {
  subtitles: EnhancedSubtitle[];
  setSubtitles: React.Dispatch<React.SetStateAction<EnhancedSubtitle[]>>;
  selectedSubtitle: string | null;
  setSelectedSubtitle: React.Dispatch<React.SetStateAction<string | null>>;
  /** Video segments for multi-segment editing */
  videoSegments?: VideoSegment[];
  setVideoSegments?: React.Dispatch<React.SetStateAction<VideoSegment[]>>;
  /** Deleted ranges for preset switching preservation */
  deletedRanges?: DeletedRange[];
  setDeletedRanges?: React.Dispatch<React.SetStateAction<DeletedRange[]>>;
  selectedVideoSegment?: string | null;
  setSelectedVideoSegment?: React.Dispatch<React.SetStateAction<string | null>>;
  /** When provided, timeline syncs playhead from the player (no parent re-renders). Otherwise use currentFrame prop. */
  playerRef?: React.RefObject<PlayerRef | null>;
  /** Fallback when playerRef is not provided */
  currentFrame?: number;
  videoDuration: number;
  fps: number;
  videoUrl: string | null;
  onSeek: (frame: number) => void;
  /** Callback when user wants to delete (opens dialog) */
  onDeleteRequest?: (subtitleId: string | null, videoSegmentId: string | null) => void;
  /** Optional: sync raw/word subtitle sources when video cuts occur (for preset switching) */
  setRawSegmentSubtitles?: React.Dispatch<React.SetStateAction<EnhancedSubtitle[]>>;
  setWordSubtitles?: React.Dispatch<React.SetStateAction<EnhancedSubtitle[]>>;
}

export interface DragState {
  id: string;
  type: "move" | "trim-start" | "trim-end";
  startX: number;
  startFrame: number;
  endFrame: number;
  /** For video segments: source frame bounds */
  sourceStartFrame?: number;
  sourceEndFrame?: number;
  isVideoSegment?: boolean;
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
  subtitle: EnhancedSubtitle;
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

export interface VideoSegmentProps {
  segment: VideoSegment;
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

export interface VideoTrackProps {
  videoSegments: VideoSegment[];
  selectedSegment: string | null;
  onSelectSegment: (id: string) => void;
  videoDuration: number;
  fps: number;
  zoom: number;
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
