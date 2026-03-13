"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Scissors } from "lucide-react";
import { TimelineRuler } from "./TimelineRuler";
import { VideoTrack } from "./VideoTrack";
import { SubtitleTrack } from "./SubtitleTrack";
import { ZoomControls } from "./ZoomControls";
import type { TimelineProps, DragState } from "./types";
import {
  COLLAPSED_HEIGHT,
  EXPANDED_HEIGHT,
  HEADER_HEIGHT,
  RULER_HEIGHT,
  MIN_SEGMENT_FRAMES,
  DEFAULT_ZOOM,
  TRANSITION_DURATION,
} from "./constants";
import {
  calculateTimelineWidth,
  pixelsToFrames,
  framesToPixels,
  clamp,
  calculateZoomToFit,
} from "./utils";

export const Timeline: React.FC<TimelineProps> = ({
  subtitles,
  setSubtitles,
  selectedSubtitle,
  setSelectedSubtitle,
  playerRef,
  currentFrame: currentFrameProp = 0,
  videoDuration,
  fps,
  videoUrl,
  onSeek,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);

  // Playhead: when playerRef is provided, subscribe to player here so only Timeline re-renders on frame update (editor + Player stay stable)
  const [syncedFrame, setSyncedFrame] = useState(0);
  useEffect(() => {
    if (!playerRef?.current) return;
    const player = playerRef.current;
    const handleFrameUpdate = () => setSyncedFrame(player.getCurrentFrame());
    setSyncedFrame(player.getCurrentFrame());
    player.addEventListener("frameupdate", handleFrameUpdate);
    return () => player.removeEventListener("frameupdate", handleFrameUpdate);
  }, [playerRef, videoUrl, videoDuration]);

  const currentFrame = playerRef ? syncedFrame : currentFrameProp;

  // Draggable playhead: convert mouse X to frame and seek
  useEffect(() => {
    if (!isDraggingPlayhead || !tracksRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!tracksRef.current) return;
      const rect = tracksRef.current.getBoundingClientRect();
      const timelineX = e.clientX - rect.left + tracksRef.current.scrollLeft;
      const frame = Math.round(
        clamp(
          pixelsToFrames(timelineX, fps, zoom),
          0,
          videoDuration
        )
      );
      onSeek(frame);
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingPlayhead, fps, zoom, videoDuration, onSeek]);

  // Initialize zoom to fit on mount
  useEffect(() => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      const fitZoom = calculateZoomToFit(videoDuration, fps, width);
      setZoom(Math.max(10, Math.min(fitZoom, 200)));
    }
  }, [videoDuration, fps]);

  const timelineWidth = calculateTimelineWidth(videoDuration, fps, zoom);

  const handleDragStart = useCallback(
    (e: React.MouseEvent, id: string, type: "move" | "trim-start" | "trim-end") => {
      const subtitle = subtitles.find((s) => s.id === id);
      if (!subtitle || !tracksRef.current) return;

      const rect = tracksRef.current.getBoundingClientRect();
      const startX = e.clientX - rect.left + tracksRef.current.scrollLeft;

      setDragState({
        id,
        type,
        startX,
        startFrame: subtitle.startFrame,
        endFrame: subtitle.endFrame,
      });

      document.body.style.cursor =
        type === "move" ? "grabbing" : "ew-resize";
    },
    [subtitles]
  );

  useEffect(() => {
    if (!dragState || !tracksRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!tracksRef.current) return;

      const rect = tracksRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left + tracksRef.current.scrollLeft;
      const deltaPixels = currentX - dragState.startX;
      const deltaFrames = pixelsToFrames(deltaPixels, fps, zoom);

      setSubtitles((prev) =>
        prev.map((sub) => {
          if (sub.id !== dragState.id) return sub;

          const duration = dragState.endFrame - dragState.startFrame;

          if (dragState.type === "move") {
            const newStart = clamp(
              dragState.startFrame + deltaFrames,
              0,
              videoDuration - duration
            );
            return {
              ...sub,
              startFrame: Math.round(newStart),
              endFrame: Math.round(newStart + duration),
            };
          } else if (dragState.type === "trim-start") {
            const newStart = clamp(
              dragState.startFrame + deltaFrames,
              0,
              dragState.endFrame - MIN_SEGMENT_FRAMES
            );
            return {
              ...sub,
              startFrame: Math.round(newStart),
            };
          } else if (dragState.type === "trim-end") {
            const newEnd = clamp(
              dragState.endFrame + deltaFrames,
              dragState.startFrame + MIN_SEGMENT_FRAMES,
              videoDuration
            );
            return {
              ...sub,
              endFrame: Math.round(newEnd),
            };
          }

          return sub;
        })
      );
    };

    const handleMouseUp = () => {
      setDragState(null);
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, fps, zoom, videoDuration, setSubtitles]);

  const handleSplit = useCallback(() => {
    // Find subtitle at current frame
    const subtitleAtFrame = subtitles.find(
      (s) => currentFrame >= s.startFrame && currentFrame < s.endFrame
    );

    if (!subtitleAtFrame || currentFrame <= subtitleAtFrame.startFrame + 2) {
      return;
    }

    const duration = subtitleAtFrame.endFrame - subtitleAtFrame.startFrame;
    if (duration < MIN_SEGMENT_FRAMES * 2) {
      return; // Too short to split
    }

    setSubtitles((prev) => {
      const index = prev.findIndex((s) => s.id === subtitleAtFrame.id);
      if (index === -1) return prev;

      // Create two new segments
      const firstPart = {
        ...subtitleAtFrame,
        id: `${subtitleAtFrame.id}-split-1-${Date.now()}`,
        endFrame: currentFrame,
      };

      const secondPart = {
        ...subtitleAtFrame,
        id: `${subtitleAtFrame.id}-split-2-${Date.now()}`,
        startFrame: currentFrame,
      };

      // Redistribute words if they exist
      if (subtitleAtFrame.words && subtitleAtFrame.words.length > 0) {
        const splitTimeMs = (currentFrame / fps) * 1000;
        const firstWords = subtitleAtFrame.words.filter(
          (w) => w.startMs < splitTimeMs
        );
        const secondWords = subtitleAtFrame.words.filter(
          (w) => w.startMs >= splitTimeMs
        );

        firstPart.words = firstWords;
        firstPart.text = firstWords.map((w) => w.text).join(" ");

        secondPart.words = secondWords;
        secondPart.text = secondWords.map((w) => w.text).join(" ");
      }

      const newSubtitles = [...prev];
      newSubtitles.splice(index, 1, firstPart, secondPart);
      return newSubtitles;
    });

    setSelectedSubtitle(null);
  }, [subtitles, currentFrame, fps, setSubtitles, setSelectedSubtitle]);

  const height = isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="shrink-0 border-t border-border bg-secondary w-full flex flex-col transition-all duration-300"
      style={{ height }}
    >
      {/* Header with controls */}
      <div
        className="flex items-center justify-between px-4 border-b border-border"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Collapse Timeline" : "Expand Timeline"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>

          <span className="text-sm font-medium">Timeline</span>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 ml-2"
            onClick={handleSplit}
            disabled={
              !subtitles.some(
                (s) => currentFrame >= s.startFrame && currentFrame < s.endFrame
              )
            }
            title="Split subtitle at playhead (S)"
          >
            <Scissors className="h-3 w-3 mr-1" />
            Split
          </Button>
        </div>

        <ZoomControls
          zoom={zoom}
          onZoomChange={setZoom}
          videoDuration={videoDuration}
          fps={fps}
          containerWidth={containerRef.current?.clientWidth || 0}
        />
      </div>

      {/* Ruler + Tracks share the same horizontal scroll area */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={tracksRef}
          className="overflow-x-auto overflow-y-auto h-full relative"
          style={{ width: "100%" }}
        >
          <div
            className="relative"
            style={{ width: timelineWidth, minWidth: "100%" }}
          >
            {/* Full-height playhead: syncs with Remotion Player, draggable to scrub */}
            <div
              className={cn(
                "absolute top-0 bottom-0 z-20 flex justify-center",
                "cursor-ew-resize select-none touch-none",
                isDraggingPlayhead && "pointer-events-none"
              )}
              style={{
                left: framesToPixels(currentFrame, fps, zoom),
                transform: "translateX(-50%)",
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingPlayhead(true);
              }}
              aria-hidden
              title={`Frame ${currentFrame} – drag to scrub`}
            >
              {/* Wider hit area for easier grabbing */}
              <div className="absolute inset-y-0 w-6 -left-3" />
              {/* Line */}
              <div className="absolute top-0 bottom-0 w-0.5 rounded-full bg-primary shadow-md" />
              {/* Head */}
              <div
                className="absolute top-0 left-1/2 w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow-md"
                aria-hidden
              />
            </div>
            <TimelineRuler
              videoDuration={videoDuration}
              fps={fps}
              zoom={zoom}
              currentFrame={currentFrame}
              onSeek={onSeek}
            />
            <VideoTrack videoDuration={videoDuration} fps={fps} zoom={zoom} />
            <SubtitleTrack
              subtitles={subtitles}
              selectedSubtitle={selectedSubtitle}
              videoDuration={videoDuration}
              fps={fps}
              zoom={zoom}
              onSelectSubtitle={setSelectedSubtitle}
              onDragStart={handleDragStart}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
