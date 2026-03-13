"use client";

import React, { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { formatTime, framesToPixels, pixelsToFrames } from "./utils";
import type { TimelineRulerProps } from "./types";
import { RULER_HEIGHT } from "./constants";

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  videoDuration,
  fps,
  zoom,
  currentFrame,
  onSeek,
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);

  // Calculate number of time markers based on zoom
  const calculateMarkers = () => {
    const totalSeconds = videoDuration / fps;
    const pixelsPerSecond = zoom;

    // Determine interval based on zoom level
    let interval: number;
    if (pixelsPerSecond < 20) {
      interval = 10; // Every 10 seconds
    } else if (pixelsPerSecond < 50) {
      interval = 5; // Every 5 seconds
    } else if (pixelsPerSecond < 100) {
      interval = 2; // Every 2 seconds
    } else {
      interval = 1; // Every second
    }

    const markers: Array<{ frame: number; label: string; position: number }> =
      [];

    for (let seconds = 0; seconds <= totalSeconds; seconds += interval) {
      const frame = Math.round(seconds * fps);
      const position = framesToPixels(frame, fps, zoom);
      markers.push({
        frame,
        label: formatTime(frame, fps),
        position,
      });
    }

    return markers;
  };

  const markers = calculateMarkers();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!rulerRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + rulerRef.current.scrollLeft;
      const frame = pixelsToFrames(x, fps, zoom);
      onSeek(Math.max(0, Math.min(frame, videoDuration)));
    },
    [fps, zoom, videoDuration, onSeek]
  );

  return (
    <div
      ref={rulerRef}
      className="relative h-8 bg-secondary border-b border-border cursor-pointer overflow-hidden"
      style={{ height: RULER_HEIGHT }}
      onClick={handleClick}
    >
      {/* Grid lines and markers */}
      {markers.map((marker, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0"
          style={{ left: marker.position }}
        >
          {/* Grid line */}
          <div className="absolute w-px h-full bg-border" />
          {/* Time label */}
          <span className="absolute top-1 left-1 text-[10px] text-muted-foreground select-none">
            {marker.label}
          </span>
        </div>
      ))}
    </div>
  );
};
