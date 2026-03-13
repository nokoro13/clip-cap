# Timeline Editor Component

A professional, feature-rich timeline editor for Remotion video projects with subtitle editing capabilities.

## Features

✅ **Expandable Timeline** - Toggle between collapsed (120px) and expanded (400px) views
✅ **Drag and Drop** - Move subtitle segments by dragging
✅ **Trim Editing** - Resize segments by dragging edges
✅ **Split Tool** - Split subtitles at playhead position
✅ **Zoom Controls** - Adjustable zoom with slider and zoom-to-fit
✅ **Visual Feedback** - Selection states, hover effects, and smooth animations
✅ **Theme Support** - Automatically matches app light/dark theme
✅ **Keyboard Shortcuts** - Press 'S' to split at playhead
✅ **Multiple Tracks** - Video track and subtitle track visualization

## Components

### Timeline (Main Container)
The main component that orchestrates all timeline functionality.

**Props:**
- `subtitles` - Array of subtitle objects
- `setSubtitles` - State setter for subtitles
- `selectedSubtitle` - Currently selected subtitle ID
- `setSelectedSubtitle` - State setter for selection
- `currentFrame` - Current playhead position
- `videoDuration` - Total video duration in frames
- `fps` - Frames per second (typically 30)
- `videoUrl` - Video source URL
- `onSeek` - Callback for seeking video player

### TimelineRuler
Displays time markers and grid lines based on zoom level.

### VideoTrack
Shows video duration bar on the timeline.

### SubtitleTrack
Container for all subtitle segments.

### SubtitleSegment
Individual subtitle segment with drag and trim handles.

### ZoomControls
Zoom slider and zoom buttons.

## Usage

```tsx
import { Timeline } from "@/components/timeline/Timeline";

<Timeline
  subtitles={subtitles}
  setSubtitles={setSubtitles}
  selectedSubtitle={selectedSubtitle}
  setSelectedSubtitle={setSelectedSubtitle}
  currentFrame={currentFrame}
  videoDuration={videoDuration}
  fps={30}
  videoUrl={videoUrl}
  onSeek={(frame) => playerRef.current?.seekTo(frame)}
/>
```

## Architecture

```
Timeline (container)
├── Header
│   ├── Expand/Collapse Button
│   ├── Split Button
│   └── Zoom Controls
├── TimelineRuler (time markers + playhead)
└── Tracks Container
    ├── VideoTrack
    └── SubtitleTrack
        └── SubtitleSegment (multiple)
```

## Interactions

### Dragging Segments
1. Click and hold on segment body
2. Move mouse to desired position
3. Release to commit

### Trimming Edges
1. Hover over left/right edge of segment
2. Edge handle becomes visible
3. Click and drag to adjust start/end time
4. Release to commit

### Splitting
1. Move playhead to desired split point
2. Click "Split" button or press 'S' key
3. Segment splits into two parts at playhead

### Zooming
- Use zoom slider to adjust detail level
- Click zoom in (+) or zoom out (-) buttons
- Click zoom to fit button to see entire video

## Constants

Located in `constants.ts`:
- `COLLAPSED_HEIGHT` - 120px
- `EXPANDED_HEIGHT` - 400px
- `MIN_ZOOM` - 10px per second
- `MAX_ZOOM` - 200px per second
- `MIN_SEGMENT_FRAMES` - 15 frames minimum duration

## Utilities

Located in `utils.ts`:
- `framesToPixels()` - Convert frame position to pixels
- `pixelsToFrames()` - Convert pixel position to frames
- `formatTime()` - Format frames as MM:SS.f
- `calculateTimelineWidth()` - Get total timeline width
- `calculateZoomToFit()` - Calculate zoom level to fit video

## Styling

Uses Tailwind CSS classes and respects the app's theme:
- Background: `bg-secondary`
- Borders: `border-border`
- Text: `text-foreground` and `text-muted-foreground`
- Playhead: `bg-destructive` (red)

## Performance Considerations

- Uses `useCallback` for event handlers
- Uses `useMemo` for calculated values (in components)
- Minimal re-renders during drag operations
- Smooth 300ms transitions for expand/collapse

## Future Enhancements

Potential improvements for future versions:
- [ ] Undo/redo functionality
- [ ] Multi-select segments
- [ ] Keyboard navigation (arrow keys)
- [ ] Copy/paste segments
- [ ] Snap to grid option
- [ ] Waveform visualization on video track
- [ ] Thumbnails on video track
- [ ] Multiple subtitle tracks
- [ ] Track reordering

## Testing

See [TESTING.md](./TESTING.md) for comprehensive testing checklist.

## Dependencies

No additional dependencies required. Uses:
- React hooks (built-in)
- Tailwind CSS (already in project)
- lucide-react (already in project)
- Existing UI components (Button, Slider)
