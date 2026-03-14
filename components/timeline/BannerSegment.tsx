"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { framesToPixels } from "./utils";
import type { BannerSegmentProps } from "./types";
import { TRIM_HANDLE_WIDTH } from "./constants";

const DRAG_THRESHOLD_PX = 4;

export const BannerSegment: React.FC<BannerSegmentProps> = ({
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
  const pendingDragRef = useRef<{ e: React.MouseEvent; id: string } | null>(null);

  const leftPosition = framesToPixels(segment.startFrame, fps, zoom);
  const width = framesToPixels(
    segment.endFrame - segment.startFrame,
    fps,
    zoom
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(segment.id);
    },
    [segment.id, onSelect]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(segment.id);
      pendingDragRef.current = { e, id: segment.id };
    },
    [segment.id, onSelect]
  );

  useEffect(() => {
    const handleMove = (moveEvent: MouseEvent) => {
      const p = pendingDragRef.current;
      if (!p) return;
      const dx = moveEvent.clientX - p.e.clientX;
      const dy = moveEvent.clientY - p.e.clientY;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        pendingDragRef.current = null;
        onDragStart(p.e, p.id, "move");
      }
    };

    const handleUp = () => {
      pendingDragRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [onDragStart]);

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

  const previewText =
    segment.text.length > 15 ? `${segment.text.slice(0, 15)}…` : segment.text || "Banner";

  return (
    <div
      className={cn(
        "absolute top-2 bottom-2 rounded overflow-hidden transition-opacity flex items-center",
        isSelected && "ring-2 ring-white z-10",
        !isSelected && "opacity-80 hover:opacity-100"
      )}
      style={{
        left: leftPosition,
        width: Math.max(width, 20),
        backgroundColor: color,
        cursor: "grab",
      }}
      onClick={handleClick}
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

      {/* Segment content - logo thumbnail + text preview */}
      <div className="flex-1 min-w-0 flex items-center gap-1.5 px-2">
        {segment.logoUrl ? (
          <img
            src={segment.logoUrl}
            alt=""
            className="w-5 h-5 object-contain rounded shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded bg-white/20 shrink-0" />
        )}
        <span className="truncate text-[11px] font-medium text-white drop-shadow select-none pointer-events-none">
          {previewText}
        </span>
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
