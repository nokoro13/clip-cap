import type { Subtitle } from "../../remotion/Composition";
import type { PlayerRef } from "@remotion/player";

/** Pan/zoom transform for video cropping */
export interface VideoTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Video segment - represents a portion of the source video on the timeline */
export interface VideoSegment {
  id: string;
  startFrame: number; // Position in timeline
  endFrame: number; // Position in timeline
  sourceStartFrame: number; // Where in source video
  sourceEndFrame: number; // Where in source video
  sourceVideoUrl: string; // Original video URL
  /** Per-segment crop/pan/zoom. When set, overrides global videoTransform for this segment. */
  transform?: VideoTransform;
}

/** Style for custom text overlay segments */
export interface CustomTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  lineHeight?: number;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOpacity?: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  position: "top" | "center" | "bottom";
  positionY?: number;
  animation: "none" | "fade" | "pop" | "slide" | "typewriter";
  borderRadius: number;
  paddingX: number;
  paddingY: number;
  containerMarginX?: number;
  uppercase?: boolean;
}

/** Custom text segment - overlay text at specific time range */
export interface CustomTextSegment {
  id: string;
  trackId: string;
  text: string;
  startFrame: number;
  endFrame: number;
  style: CustomTextStyle;
}

/** Custom text track - container for text segments */
export interface CustomTextTrack {
  id: string;
  name: string;
  visible: boolean;
  color: string;
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
  /** Callback when user wants to delete selected custom text segment */
  onDeleteTextSegment?: (segmentId: string) => void;
  /** Callback when user wants to open crop dialog */
  onCropClick?: () => void;
  /** Callback when user clicks Add text track (e.g. to expand timeline and switch sidebar to text tab) */
  onAddTextTrackClick?: () => void;
  /** Optional: sync raw/word subtitle sources when video cuts occur (for preset switching) */
  setRawSegmentSubtitles?: React.Dispatch<React.SetStateAction<EnhancedSubtitle[]>>;
  setWordSubtitles?: React.Dispatch<React.SetStateAction<EnhancedSubtitle[]>>;
  /** Custom text tracks */
  customTextTracks?: CustomTextTrack[];
  setCustomTextTracks?: React.Dispatch<React.SetStateAction<CustomTextTrack[]>>;
  customTextSegments?: CustomTextSegment[];
  setCustomTextSegments?: React.Dispatch<React.SetStateAction<CustomTextSegment[]>>;
  selectedTextSegment?: string | null;
  setSelectedTextSegment?: React.Dispatch<React.SetStateAction<string | null>>;
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
  /** For custom text segments */
  isTextSegment?: boolean;
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

export interface CustomTextSegmentProps {
  segment: CustomTextSegment;
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

export interface CustomTextTrackProps {
  track: CustomTextTrack;
  segments: CustomTextSegment[];
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
