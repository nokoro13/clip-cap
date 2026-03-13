"use client";

import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { framesToPixels } from "./utils";
import type { VideoSegmentProps } from "./types";
import { TRIM_HANDLE_WIDTH } from "./constants";

export const VideoSegment: React.FC<VideoSegmentProps> = ({
  segment,
  index,
  isSelected,
  videoDuration,
  fps,
  zoom,
  color,
  onSelect,
  onDragStart,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const leftPosition = framesToPixels(segment.startFrame, fps, zoom);
  const width = framesToPixels(
    segment.endFrame - segment.startFrame,
    fps,
    zoom
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(segment.id);
      onDragStart(e, segment.id, "move");
    },
    [segment.id, onSelect, onDragStart]
  );

  const handleTrimStartMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(segment.id);
      onDragStart(e, segment.id, "trim-start");
    },
    [segment.id, onSelect, onDragStart]
  );

  const handleTrimEndMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(segment.id);
      onDragStart(e, segment.id, "trim-end");
    },
    [segment.id, onSelect, onDragStart]
  );

  const durationFrames = segment.endFrame - segment.startFrame;
  const durationSec = (durationFrames / fps).toFixed(1);

  return (
    <div
      className={cn(
        "absolute top-2 bottom-2 rounded overflow-hidden transition-opacity flex items-center",
        isSelected ? "ring-2 ring-white z-10" : "opacity-90 hover:opacity-100"
      )}
      style={{
        left: leftPosition,
        width: Math.max(width, 24),
        backgroundColor: color,
        cursor: "grab",
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left trim handle */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 bg-black/30 cursor-ew-resize hover:bg-black/50 transition-colors",
          isHovered || isSelected ? "opacity-100" : "opacity-0"
        )}
        style={{ width: TRIM_HANDLE_WIDTH }}
        onMouseDown={handleTrimStartMouseDown}
      />

      {/* Segment content - duration label */}
      <div className="flex-1 truncate px-2 text-[10px] font-medium text-white/90 drop-shadow select-none pointer-events-none text-center">
        {durationSec}s
      </div>

      {/* Right trim handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 bg-black/30 cursor-ew-resize hover:bg-black/50 transition-colors",
          isHovered || isSelected ? "opacity-100" : "opacity-0"
        )}
        style={{ width: TRIM_HANDLE_WIDTH }}
        onMouseDown={handleTrimEndMouseDown}
      />
    </div>
  );
};
