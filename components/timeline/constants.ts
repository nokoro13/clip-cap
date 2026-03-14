// Timeline dimensions
export const COLLAPSED_HEIGHT = 40;
export const EXPANDED_HEIGHT = 'max-content';
/** Max height for ruler + tracks area when expanded; prevents timeline from shrinking video player */
export const TRACKS_MAX_HEIGHT = 240;
export const TRACK_HEIGHT = 48;
export const RULER_HEIGHT = 32;
export const HEADER_HEIGHT = 40;

// Zoom levels
export const MIN_ZOOM = 10; // pixels per second
export const MAX_ZOOM = 200; // pixels per second
export const DEFAULT_ZOOM = 50; // pixels per second

// Segment constraints
export const MIN_SEGMENT_FRAMES = 15;
export const TRIM_HANDLE_WIDTH = 8;

// Colors for subtitle segments (from editor page)
export const SUBTITLE_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#22c55e",
  "#06b6d4",
];

// Colors for custom text tracks
export const TEXT_TRACK_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

// Colors for banner tracks
export const BANNER_TRACK_COLORS = [
  "#14b8a6",
  "#6366f1",
  "#f97316",
  "#ec4899",
  "#22c55e",
];

// Colors for video segments
export const VIDEO_SEGMENT_COLORS = [
  "#1e40af",
  "#7c3aed",
  "#be185d",
  "#ea580c",
  "#15803d",
  "#0e7490",
];

// Interaction
export const SNAP_THRESHOLD = 5; // frames

// Animation
export const TRANSITION_DURATION = 300; // ms
