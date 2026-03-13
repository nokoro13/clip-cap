# Timeline Component Structure

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ TIMELINE HEADER                                          [▼] [S] [Zoom] │
├─────────────────────────────────────────────────────────────────────┤
│ RULER: 0:00.0    0:01.0    0:02.0    0:03.0    0:04.0    [▼]      │
├─────────────────────────────────────────────────────────────────────┤
│ VIDEO TRACK:  [████████████████████████████████████████████]       │
├─────────────────────────────────────────────────────────────────────┤
│ SUBTITLE:     [Seg1] [Seg2]    [Segment 3]  [S4] [Segment 5]       │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
Timeline (Main Container)
│
├─ TimelineHeader
│  ├─ ExpandButton (▼/▲)
│  ├─ SplitButton (✂️)
│  └─ ZoomControls
│     ├─ ZoomOutButton (-)
│     ├─ ZoomSlider
│     ├─ ZoomInButton (+)
│     └─ ZoomToFitButton (⛶)
│
├─ TimelineRuler
│  ├─ TimeMarkers (0:00, 0:01, etc.)
│  ├─ GridLines (vertical)
│  └─ Playhead (red indicator)
│
└─ TracksContainer
   ├─ VideoTrack
   │  └─ VideoDurationBar
   │
   └─ SubtitleTrack
      ├─ SubtitleSegment #1
      │  ├─ TrimHandleLeft
      │  ├─ SegmentBody (draggable)
      │  └─ TrimHandleRight
      │
      ├─ SubtitleSegment #2
      └─ SubtitleSegment #N...
```

## State Flow

```
EditorPage (Parent)
│
├─ State: subtitles[]
├─ State: selectedSubtitle
├─ State: currentFrame
│
└─ <Timeline>
   │
   ├─ Local State: zoom
   ├─ Local State: isExpanded
   ├─ Local State: dragState
   │
   └─ Updates parent via:
      ├─ setSubtitles()
      ├─ setSelectedSubtitle()
      └─ onSeek()
```

## Interaction Flow

### Drag to Move
```
1. User clicks segment body
2. onMouseDown → setDragState({ type: 'move', ... })
3. onMouseMove → calculate new position → update subtitles
4. onMouseUp → clear dragState
```

### Trim Edge
```
1. User clicks left/right edge handle
2. onMouseDown → setDragState({ type: 'trim-start/trim-end', ... })
3. onMouseMove → calculate new start/end → update subtitles
4. onMouseUp → clear dragState
```

### Split Subtitle
```
1. User clicks Split button or presses 'S'
2. Find subtitle containing currentFrame
3. Create two new subtitles at playhead
4. Redistribute word timings
5. Update subtitles array
```

### Zoom
```
1. User adjusts zoom slider
2. onZoomChange(newZoom)
3. Recalculate all segment positions
4. Update timeline width
5. Adjust visible area
```

## Data Flow Diagram

```
┌─────────────┐
│ Editor Page │
│   State     │
└──────┬──────┘
       │
       ├─ subtitles ───────────┐
       ├─ selectedSubtitle ────┤
       ├─ currentFrame ────────┤
       │                       │
       ▼                       ▼
┌──────────────┐        ┌────────────┐
│   Timeline   │───────▶│ SubTrack   │
│              │        └─────┬──────┘
│  - zoom      │              │
│  - expanded  │              ▼
│  - dragState │        ┌────────────┐
└──────┬───────┘        │  Segment   │
       │                │  (each)    │
       │                └────────────┘
       │
       ├─ onSeek() ──────────┐
       ├─ setSubtitles() ────┤
       └─ setSelected() ─────┤
                             │
                             ▼
                      ┌──────────────┐
                      │ Editor State │
                      │   Updated    │
                      └──────────────┘
```

## File Dependencies

```
Timeline.tsx
├── imports: TimelineRuler
├── imports: VideoTrack
├── imports: SubtitleTrack
├── imports: ZoomControls
├── imports: types
├── imports: constants
└── imports: utils

SubtitleTrack.tsx
├── imports: SubtitleSegment
└── imports: constants

SubtitleSegment.tsx
├── imports: utils
└── imports: constants

All components:
├── @/lib/utils (cn)
├── @/components/ui/* (Button, Slider, etc.)
└── lucide-react (icons)
```

## Key Functions

### Position Calculations
```typescript
// Convert frames to pixel position
framesToPixels(frame, fps, zoom)
  → pixels = (frame / fps) * zoom

// Convert pixel position back to frames  
pixelsToFrames(pixels, fps, zoom)
  → frames = (pixels / zoom) * fps

// Calculate timeline width
calculateTimelineWidth(duration, fps, zoom)
  → width = framesToPixels(duration, fps, zoom)
```

### Constraints
```typescript
// Prevent segment overflow
clamp(newPosition, 0, videoDuration)

// Maintain minimum duration
MIN_SEGMENT_FRAMES = 15

// Trim limits
newStart = clamp(value, 0, endFrame - MIN_SEGMENT_FRAMES)
newEnd = clamp(value, startFrame + MIN_SEGMENT_FRAMES, videoDuration)
```

## CSS Classes (Tailwind)

```css
/* Timeline Container */
.timeline { bg-secondary, border-t, border-border }

/* Header */
.header { h-[40px], border-b, border-border }

/* Ruler */
.ruler { h-[32px], bg-secondary }

/* Track */
.track { h-[48px], bg-secondary/30 }

/* Segment */
.segment { 
  absolute, rounded, 
  ring-2 (selected),
  opacity-70 (default)
}

/* Playhead */
.playhead { w-0.5, bg-destructive }
```

This structure provides maximum flexibility while maintaining clean separation of concerns!
