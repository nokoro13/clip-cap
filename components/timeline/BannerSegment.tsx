"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { framesToPixels, getReactClientX } from "./utils";
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
  const pendingDragRef = useRef<{ clientX: number; clientY: number; id: string } | null>(null);

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

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      onSelect(segment.id);
      const clientX = getReactClientX(e);
      const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      pendingDragRef.current = { clientX, clientY, id: segment.id };
    },
    [segment.id, onSelect]
  );

  useEffect(() => {
    const getClientX = (e: MouseEvent | TouchEvent) =>
      "touches" in e && e.touches[0] ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const getClientY = (e: MouseEvent | TouchEvent) =>
      "touches" in e && e.touches[0] ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const p = pendingDragRef.current;
      if (!p) return;
      const dx = getClientX(moveEvent) - p.clientX;
      const dy = getClientY(moveEvent) - p.clientY;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        pendingDragRef.current = null;
        onDragStart({ clientX: getClientX(moveEvent) }, p.id, "move");
      }
    };

    const handleUp = () => {
      pendingDragRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    window.addEventListener("touchcancel", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
      window.removeEventListener("touchcancel", handleUp);
    };
  }, [onDragStart]);

  const handleTrimPointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, type: "trim-start" | "trim-end") => {
      e.preventDefault();
      e.stopPropagation();
      onSelect(segment.id);
      onDragStart({ clientX: getReactClientX(e) }, segment.id, type);
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
        touchAction: "none",
      }}
      onClick={handleClick}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
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
        onMouseDown={(e) => handleTrimPointerDown(e, "trim-start")}
        onTouchStart={(e) => handleTrimPointerDown(e, "trim-start")}
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
        onMouseDown={(e) => handleTrimPointerDown(e, "trim-end")}
        onTouchStart={(e) => handleTrimPointerDown(e, "trim-end")}
      />
    </div>
  );
};
