# Timeline Editor - Testing Checklist

## Overview
This document provides a comprehensive testing guide for the new Timeline Editor component.

## Manual Testing Checklist

### 1. Timeline Display

- [ ] Timeline renders at the bottom of the editor page
- [ ] Timeline starts in collapsed state (120px height)
- [ ] Video track displays above subtitle track
- [ ] Timeline matches app theme (light/dark mode)
- [ ] Time ruler shows appropriate time markers based on zoom level
- [ ] Playhead indicator (red line) is visible and positioned correctly

### 2. Expand/Collapse Functionality

- [ ] Click chevron button to expand timeline to 400px height
- [ ] Click chevron button again to collapse back to 120px
- [ ] Transition animation is smooth (300ms)
- [ ] All functionality works in both expanded and collapsed states

### 3. Zoom Controls

- [ ] Zoom slider adjusts zoom level smoothly
- [ ] Zoom In button (+ icon) increases zoom
- [ ] Zoom Out button (- icon) decreases zoom
- [ ] Zoom to Fit button (maximize icon) fits entire video in viewport
- [ ] Zoom percentage display updates correctly
- [ ] Timeline width adjusts based on zoom level
- [ ] Horizontal scrollbar appears when timeline width exceeds viewport

### 4. Subtitle Segment Display

- [ ] All subtitle segments render in correct positions
- [ ] Each segment has a different color (cycling through 6 colors)
- [ ] Segment text preview is visible and truncated with ellipsis
- [ ] Selected segment shows white ring outline
- [ ] Unselected segments have 70% opacity
- [ ] Hover on segment increases opacity to 90%

### 5. Drag and Drop (Move)

- [ ] Click and drag subtitle body to move entire segment
- [ ] Cursor changes to "grabbing" while dragging
- [ ] Segment follows mouse movement
- [ ] Segment cannot be dragged before frame 0
- [ ] Segment cannot be dragged past video duration
- [ ] Release mouse to commit new position
- [ ] Subtitle text in left panel updates with new timing

### 6. Trim (Resize) Functionality

#### Trim Start (Left Edge)
- [ ] Hover over left edge shows resize cursor (ew-resize)
- [ ] Left edge handle is visible on hover/selection
- [ ] Drag left edge to adjust start time
- [ ] Start time cannot go before frame 0
- [ ] Start time cannot move within 15 frames of end time (minimum duration)
- [ ] End time remains fixed while trimming start

#### Trim End (Right Edge)
- [ ] Hover over right edge shows resize cursor (ew-resize)
- [ ] Right edge handle is visible on hover/selection
- [ ] Drag right edge to adjust end time
- [ ] End time cannot go past video duration
- [ ] End time cannot move within 15 frames of start time (minimum duration)
- [ ] Start time remains fixed while trimming end

### 7. Split Functionality

- [ ] Click "Split" button in timeline header
- [ ] Button is disabled when playhead is not over any subtitle
- [ ] Click splits subtitle at playhead position
- [ ] Original subtitle is replaced with two new segments
- [ ] First segment: original start → playhead frame
- [ ] Second segment: playhead frame → original end
- [ ] Text is distributed between segments (if words array exists)
- [ ] Both segments appear in subtitle list on left panel
- [ ] Segments cannot be split if too short (< 30 frames)

### 8. Playhead and Seeking

- [ ] Playhead (red vertical line) moves as video plays
- [ ] Click anywhere on time ruler to seek video
- [ ] Video player updates to clicked frame
- [ ] Playhead position updates after seeking
- [ ] Playhead stays synchronized with video during playback

### 9. Selection and Interaction

- [ ] Click subtitle segment to select it
- [ ] Selected segment highlights in both timeline and left panel
- [ ] Click empty area deselects current subtitle
- [ ] Only one subtitle can be selected at a time
- [ ] Selection state persists during drag/trim operations

### 10. Keyboard Shortcuts

- [ ] Press 'S' key to split subtitle at playhead (when not typing)
- [ ] 'S' key does NOT trigger when typing in text inputs
- [ ] 'S' key does NOT trigger when editing subtitle text

### 11. Performance

- [ ] Timeline remains responsive with 50+ subtitles
- [ ] Dragging is smooth without lag
- [ ] Zoom changes are instant
- [ ] No visible frame drops during interactions
- [ ] Scrolling is smooth

### 12. Edge Cases

- [ ] Works correctly with empty subtitle list
- [ ] Handles very short subtitles (minimum 15 frames)
- [ ] Handles very long videos (10+ minutes)
- [ ] Handles subtitles at video boundaries (start/end)
- [ ] Word timings are preserved during splits (if present)
- [ ] Subtitle text updates correctly after manual edits in left panel

### 13. Visual Consistency

- [ ] Colors match reference image
- [ ] Spacing is consistent
- [ ] Fonts are readable at all zoom levels
- [ ] No visual glitches during expand/collapse
- [ ] Theme colors work in both light and dark modes

### 14. Integration with Existing Features

- [ ] Editing subtitle text in left panel updates timeline
- [ ] Deleting subtitle from left panel removes from timeline
- [ ] Adding new subtitle appears in timeline
- [ ] Style changes in left panel don't affect timeline
- [ ] Player controls (play/pause) work while using timeline

## Browser Compatibility

Test in the following browsers:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

## Known Limitations

1. No undo/redo for timeline operations (can be added later)
2. No multi-select for batch operations (can be added later)
3. No keyboard navigation (arrow keys) - can be enhancement
4. Minimum segment duration is hardcoded to 15 frames

## Bug Reporting

If you find any issues, please note:
- Steps to reproduce
- Expected vs actual behavior
- Browser and version
- Screenshot or video if possible

## Success Criteria

The timeline is considered complete and working when:
✓ All core features (drag, trim, split, zoom) work smoothly
✓ No linting errors
✓ Visual design matches reference image
✓ Performance is acceptable with typical subtitle counts (50-100)
✓ Edge cases are handled gracefully
