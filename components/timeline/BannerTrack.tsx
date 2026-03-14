"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { calculateTimelineWidth } from "./utils";
import { BannerSegment } from "./BannerSegment";
import type { BannerTrackProps } from "./types";
import { TRACK_HEIGHT } from "./constants";

export const BannerTrack: React.FC<BannerTrackProps> = ({
  track,
  segments,
  selectedSegment,
  onSelectSegment,
  videoDuration,
  fps,
  zoom,
  onDragStart,
}) => {
  const width = calculateTimelineWidth(videoDuration, fps, zoom);

  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground px-1 py-1 flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: track.color }}
        />
        {track.name}
      </div>
      <div
        className={cn(
          "relative border-b border-border",
          !track.visible && "opacity-50"
        )}
        style={{
          height: TRACK_HEIGHT,
          backgroundColor: track.visible
            ? "hsl(var(--secondary) / 0.4)"
            : "hsl(var(--secondary) / 0.2)",
        }}
      >
        {segments.length > 0 ? (
          segments.map((segment, index) => (
            <BannerSegment
              key={segment.id}
              segment={segment}
              index={index}
              isSelected={selectedSegment === segment.id}
              videoDuration={videoDuration}
              fps={fps}
              zoom={zoom}
              color={track.color}
              onSelect={onSelectSegment}
              onDragStart={onDragStart}
            />
          ))
        ) : (
          <div
            className={cn(
              "absolute top-2 bottom-2 left-0 rounded border border-dashed border-muted-foreground/30",
              "flex items-center justify-center text-xs text-muted-foreground"
            )}
            style={{ width: Math.min(width, 200) }}
          >
            Empty track
          </div>
        )}
      </div>
    </div>
  );
};
