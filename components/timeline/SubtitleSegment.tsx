"use client";

import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { framesToPixels, getReactClientX } from "./utils";
import type { SubtitleSegmentProps } from "./types";
import { TRIM_HANDLE_WIDTH } from "./constants";

export const SubtitleSegment: React.FC<SubtitleSegmentProps> = ({
  subtitle,
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

  const leftPosition = framesToPixels(subtitle.startFrame, fps, zoom);
  const width = framesToPixels(
    subtitle.endFrame - subtitle.startFrame,
    fps,
    zoom
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, type: "move" | "trim-start" | "trim-end") => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(subtitle.id);
      onDragStart({ clientX: getReactClientX(e) }, subtitle.id, type);
    },
    [subtitle.id, onSelect, onDragStart]
  );

  return (
    <div
      className={cn(
        "absolute top-2 bottom-2 rounded overflow-hidden transition-opacity flex items-center",
        subtitle.isDeleted && "opacity-30 bg-muted-foreground/50",
        !subtitle.isDeleted && isSelected && "ring-2 ring-white z-10",
        !subtitle.isDeleted && !isSelected && "opacity-70 hover:opacity-90"
      )}
      style={{
        left: leftPosition,
        width: Math.max(width, 20), // Minimum visible width
        backgroundColor: color,
        cursor: "grab",
        touchAction: "none",
      }}
      onMouseDown={(e) => handlePointerDown(e, "move")}
      onTouchStart={(e) => handlePointerDown(e, "move")}
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
        onMouseDown={(e) => handlePointerDown(e, "trim-start")}
        onTouchStart={(e) => handlePointerDown(e, "trim-start")}
      />

      {/* Segment content */}
      <div className="flex-1 truncate px-3 text-[11px] font-medium text-white drop-shadow select-none pointer-events-none">
        {subtitle.text}
      </div>

      {/* Right trim handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 bg-black/30 cursor-ew-resize hover:bg-black/50 transition-colors",
          isHovered || isSelected ? "opacity-100" : "opacity-0"
        )}
        style={{ width: TRIM_HANDLE_WIDTH }}
        onMouseDown={(e) => handlePointerDown(e, "trim-end")}
        onTouchStart={(e) => handlePointerDown(e, "trim-end")}
      />
    </div>
  );
};
