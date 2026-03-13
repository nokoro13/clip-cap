import type { Subtitle } from "../../remotion/Composition";

export interface TimelineProps {
  subtitles: Subtitle[];
  setSubtitles: React.Dispatch<React.SetStateAction<Subtitle[]>>;
  selectedSubtitle: string | null;
  setSelectedSubtitle: React.Dispatch<React.SetStateAction<string | null>>;
  currentFrame: number;
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
