"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { framesToPixels, calculateTimelineWidth } from "./utils";
import type { TrackProps } from "./types";
import { TRACK_HEIGHT } from "./constants";

export const VideoTrack: React.FC<TrackProps> = ({
  videoDuration,
  fps,
  zoom,
}) => {
  const width = calculateTimelineWidth(videoDuration, fps, zoom);

  return (
	<div>
	 {/* Track label */}
	 <div >
	 Video
  </div>
    <div
      className="relative bg-secondary/50 border-b border-border"
      style={{ height: TRACK_HEIGHT }}
    >

      {/* Video duration bar */}
      <div
        className="absolute top-2 bottom-2 left-0 bg-primary/20 border border-primary/40 rounded"
        style={{ width }}
      />
    </div>
	 </div>
  );
};
