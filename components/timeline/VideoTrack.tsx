"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { calculateTimelineWidth } from "./utils";
import { VideoSegment } from "./VideoSegment";
import type { VideoTrackProps } from "./types";
import { TRACK_HEIGHT, VIDEO_SEGMENT_COLORS } from "./constants";

export const VideoTrack: React.FC<VideoTrackProps> = ({
  videoSegments,
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
      <div className="text-xs font-medium text-muted-foreground px-1 py-1">
        Video
      </div>
      <div
        className="relative bg-secondary/50 border-b border-border"
        style={{ height: TRACK_HEIGHT }}
      >
        {videoSegments.length > 0 ? (
          videoSegments.map((segment, index) => (
            <VideoSegment
              key={segment.id}
              segment={segment}
              index={index}
              isSelected={selectedSegment === segment.id}
              videoDuration={videoDuration}
              fps={fps}
              zoom={zoom}
              color={VIDEO_SEGMENT_COLORS[index % VIDEO_SEGMENT_COLORS.length]}
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
            No video
          </div>
        )}
      </div>
    </div>
  );
};
