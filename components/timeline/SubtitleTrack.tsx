"use client";

import React from "react";
import type { Subtitle } from "../../remotion/Composition";
import { SubtitleSegment } from "./SubtitleSegment";
import { TRACK_HEIGHT, SUBTITLE_COLORS } from "./constants";

interface SubtitleTrackProps {
  subtitles: Subtitle[];
  selectedSubtitle: string | null;
  videoDuration: number;
  fps: number;
  zoom: number;
  onSelectSubtitle: (id: string) => void;
  onDragStart: (
    e: React.MouseEvent | React.TouchEvent | { clientX: number },
    id: string,
    type: "move" | "trim-start" | "trim-end"
  ) => void;
}

export const SubtitleTrack: React.FC<SubtitleTrackProps> = ({
  subtitles,
  selectedSubtitle,
  videoDuration,
  fps,
  zoom,
  onSelectSubtitle,
  onDragStart,
}) => {
  return (
	<div>
	{/* Track label */}
	<div>
	Subtitles
 </div>
    <div
      className="relative bg-secondary/30 border-b border-border"
      style={{ height: TRACK_HEIGHT }}
    >

      {/* Subtitle segments */}
      {subtitles.map((subtitle, index) => (
        <SubtitleSegment
          key={subtitle.id}
          subtitle={subtitle}
          index={index}
          isSelected={selectedSubtitle === subtitle.id}
          videoDuration={videoDuration}
          fps={fps}
          zoom={zoom}
          color={SUBTITLE_COLORS[index % SUBTITLE_COLORS.length]}
          onSelect={onSelectSubtitle}
          onDragStart={onDragStart}
        />
      ))}
    </div>
	 </div>
  );
};
