"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Trash2, ScissorsLineDashed, Type, Crop, Play, Pause } from "lucide-react";
import { TimelineRuler } from "./TimelineRuler";
import { VideoTrack } from "./VideoTrack";
import { SubtitleTrack } from "./SubtitleTrack";
import { CustomTextTrack } from "./CustomTextTrack";
import { ZoomControls } from "./ZoomControls";
import type { TimelineProps, DragState, VideoSegment } from "./types";
import {
  COLLAPSED_HEIGHT,
  EXPANDED_HEIGHT,
  HEADER_HEIGHT,
  RULER_HEIGHT,
  MIN_SEGMENT_FRAMES,
  DEFAULT_ZOOM,
  TRANSITION_DURATION,
  TEXT_TRACK_COLORS,
} from "./constants";
import {
  calculateTimelineWidth,
  pixelsToFrames,
  framesToPixels,
  clamp,
  calculateZoomToFit,
} from "./utils";
import {
  removeSubtitlesInRangeAndShift,
  updateDeletedRangesAfterCut,
} from "@/lib/timeline-state";

export const Timeline: React.FC<TimelineProps> = ({
  subtitles,
  setSubtitles,
  selectedSubtitle,
  setSelectedSubtitle,
  videoSegments = [],
  setVideoSegments,
  deletedRanges = [],
  setDeletedRanges,
  selectedVideoSegment,
  setSelectedVideoSegment,
  playerRef,
  currentFrame: currentFrameProp = 0,
  videoDuration,
  fps,
  videoUrl,
  onSeek,
  onDeleteRequest,
  onDeleteTextSegment,
  onCropClick,
  onAddTextTrackClick,
  setRawSegmentSubtitles,
  setWordSubtitles,
  customTextTracks = [],
  setCustomTextTracks,
  customTextSegments = [],
  setCustomTextSegments,
  selectedTextSegment,
  setSelectedTextSegment,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);

  // Playhead: when playerRef is provided, subscribe to player here so only Timeline re-renders on frame update (editor + Player stay stable)
  const [syncedFrame, setSyncedFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => {
    if (!playerRef?.current) return;
    const player = playerRef.current;
    const handleFrameUpdate = () => setSyncedFrame(player.getCurrentFrame());
    setSyncedFrame(player.getCurrentFrame());
    player.addEventListener("frameupdate", handleFrameUpdate);
    return () => player.removeEventListener("frameupdate", handleFrameUpdate);
  }, [playerRef, videoUrl, videoDuration]);

  useEffect(() => {
    if (!playerRef?.current) return;
    const player = playerRef.current;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
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
      if (!tracksRef.current) return;

      const rect = tracksRef.current.getBoundingClientRect();
      const startX = e.clientX - rect.left + tracksRef.current.scrollLeft;

      const subtitle = subtitles.find((s) => s.id === id);
      const videoSegment = videoSegments.find((s) => s.id === id);
      const textSegment = customTextSegments.find((s) => s.id === id);

      if (subtitle) {
        setDragState({
          id,
          type,
          startX,
          startFrame: subtitle.startFrame,
          endFrame: subtitle.endFrame,
        });
      } else if (videoSegment && setVideoSegments) {
        setDragState({
          id,
          type,
          startX,
          startFrame: videoSegment.startFrame,
          endFrame: videoSegment.endFrame,
          sourceStartFrame: videoSegment.sourceStartFrame,
          sourceEndFrame: videoSegment.sourceEndFrame,
          isVideoSegment: true,
        });
      } else if (textSegment) {
        setDragState({
          id,
          type,
          startX,
          startFrame: textSegment.startFrame,
          endFrame: textSegment.endFrame,
          isTextSegment: true,
        });
      } else {
        return;
      }

      document.body.style.cursor =
        type === "move" ? "grabbing" : "ew-resize";
    },
    [subtitles, videoSegments, customTextSegments, setVideoSegments]
  );

  useEffect(() => {
    if (!dragState || !tracksRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!tracksRef.current) return;

      const rect = tracksRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left + tracksRef.current.scrollLeft;
      const deltaPixels = currentX - dragState.startX;
      const deltaFrames = pixelsToFrames(deltaPixels, fps, zoom);

      if (dragState.isVideoSegment && setVideoSegments) {
        setVideoSegments((prev) =>
          prev.map((seg) => {
            if (seg.id !== dragState.id) return seg;

            const srcStart = dragState.sourceStartFrame ?? seg.sourceStartFrame;
            const srcEnd = dragState.sourceEndFrame ?? seg.sourceEndFrame;

            if (dragState.type === "trim-start") {
              const newStart = clamp(
                dragState.startFrame + deltaFrames,
                0,
                dragState.endFrame - MIN_SEGMENT_FRAMES
              );
              const trimAmount = newStart - dragState.startFrame;
              return {
                ...seg,
                startFrame: Math.round(newStart),
                sourceStartFrame: Math.round(srcStart + trimAmount),
              };
            } else if (dragState.type === "trim-end") {
              const newEnd = clamp(
                dragState.endFrame + deltaFrames,
                dragState.startFrame + MIN_SEGMENT_FRAMES,
                videoDuration
              );
              const trimAmount = newEnd - dragState.endFrame;
              return {
                ...seg,
                endFrame: Math.round(newEnd),
                sourceEndFrame: Math.round(srcEnd + trimAmount),
              };
            }
            return seg;
          })
        );
      } else if (dragState.isTextSegment && setCustomTextSegments) {
        setCustomTextSegments((prev) =>
          prev.map((seg) => {
            if (seg.id !== dragState.id) return seg;

            const duration = dragState.endFrame - dragState.startFrame;

            if (dragState.type === "move") {
              const newStart = clamp(
                dragState.startFrame + deltaFrames,
                0,
                videoDuration - duration
              );
              return {
                ...seg,
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
                ...seg,
                startFrame: Math.round(newStart),
              };
            } else if (dragState.type === "trim-end") {
              const newEnd = clamp(
                dragState.endFrame + deltaFrames,
                dragState.startFrame + MIN_SEGMENT_FRAMES,
                videoDuration
              );
              return {
                ...seg,
                endFrame: Math.round(newEnd),
              };
            }
            return seg;
          })
        );
      } else {
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
      }
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
  }, [dragState, fps, zoom, videoDuration, setSubtitles, setVideoSegments, setCustomTextSegments]);

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
        firstPart.text = firstWords.map((w) => w.text.trim()).join(" ");

        secondPart.words = secondWords;
        secondPart.text = secondWords.map((w) => w.text.trim()).join(" ");
      }

      const newSubtitles = [...prev];
      newSubtitles.splice(index, 1, firstPart, secondPart);
      return newSubtitles;
    });

    setSelectedSubtitle(null);
  }, [subtitles, currentFrame, fps, setSubtitles, setSelectedSubtitle]);

  const handleSplitText = useCallback(() => {
    if (!setCustomTextSegments || customTextSegments.length === 0) return;

    const segment = customTextSegments.find(
      (s) => currentFrame >= s.startFrame && currentFrame < s.endFrame
    );
    if (!segment) return;

    const segmentDuration = segment.endFrame - segment.startFrame;
    if (segmentDuration < MIN_SEGMENT_FRAMES * 2) return;

    const firstPart = {
      ...segment,
      id: `${segment.id}-split-1-${Date.now()}`,
      endFrame: currentFrame,
    };

    const secondPart = {
      ...segment,
      id: `${segment.id}-split-2-${Date.now()}`,
      startFrame: currentFrame,
    };

    setCustomTextSegments((prev) =>
      prev.flatMap((s) => (s.id === segment.id ? [firstPart, secondPart] : [s]))
    );
    setSelectedTextSegment?.(null);
  }, [
    customTextSegments,
    currentFrame,
    setCustomTextSegments,
    setSelectedTextSegment,
  ]);

  const handleSplitVideo = useCallback(() => {
    if (!setVideoSegments || videoSegments.length === 0) return;

    const segment = videoSegments.find(
      (s) => currentFrame >= s.startFrame && currentFrame < s.endFrame
    );
    if (!segment) return;

    const segmentDuration = segment.endFrame - segment.startFrame;
    if (segmentDuration < MIN_SEGMENT_FRAMES * 2) return;

    const sourceFrame =
      segment.sourceStartFrame +
      (currentFrame - segment.startFrame);

    const firstPart: VideoSegment = {
      ...segment,
      id: `${segment.id}-split-1-${Date.now()}`,
      endFrame: currentFrame,
      sourceEndFrame: sourceFrame,
    };

    const secondPart: VideoSegment = {
      ...segment,
      id: `${segment.id}-split-2-${Date.now()}`,
      startFrame: currentFrame,
      sourceStartFrame: sourceFrame,
    };

    setVideoSegments((prev) =>
      prev.flatMap((s) => (s.id === segment.id ? [firstPart, secondPart] : [s]))
    );
    setSelectedVideoSegment?.(null);
  }, [
    videoSegments,
    currentFrame,
    setVideoSegments,
    setSelectedVideoSegment,
  ]);

  const handleDeleteClick = useCallback(() => {
    if (selectedSubtitle && onDeleteRequest) {
      onDeleteRequest(selectedSubtitle, null);
    } else if (selectedTextSegment && (onDeleteTextSegment || setCustomTextSegments)) {
      if (onDeleteTextSegment) {
        onDeleteTextSegment(selectedTextSegment);
      } else {
        setCustomTextSegments?.((prev) =>
          prev.filter((s) => s.id !== selectedTextSegment)
        );
        setSelectedTextSegment?.(null);
      }
    } else if (selectedVideoSegment && setVideoSegments) {
      const seg = videoSegments.find((s) => s.id === selectedVideoSegment);
      if (!seg) return;

      const cutStart = seg.startFrame;
      const cutEnd = seg.endFrame;
      const newRange = {
        id: `deleted-${Date.now()}`,
        startFrame: cutStart,
        endFrame: cutEnd,
        affectsVideo: true,
      };

      // Remove subtitles in deleted range and shift remaining left (including word-level cleanup)
      const shiftSubtitles = (prev: typeof subtitles) =>
        removeSubtitlesInRangeAndShift(prev, cutStart, cutEnd, fps);
      setSubtitles(shiftSubtitles);
      setRawSegmentSubtitles?.((prev) => shiftSubtitles(prev));
      setWordSubtitles?.((prev) => shiftSubtitles(prev));

      // Update deleted ranges (add new, shift/remove overlapping)
      if (setDeletedRanges) {
        setDeletedRanges((prev) =>
          updateDeletedRangesAfterCut(prev, cutStart, cutEnd, newRange)
        );
      }

      // Remove video segment and snap remaining segments left
      setVideoSegments((prev) => {
        const filtered = prev.filter((s) => s.id !== selectedVideoSegment);
        let currentPos = 0;
        return filtered.map((s) => {
          const duration = s.sourceEndFrame - s.sourceStartFrame;
          const updated = {
            ...s,
            startFrame: currentPos,
            endFrame: currentPos + duration,
          };
          currentPos += duration;
          return updated;
        });
      });
      setSelectedVideoSegment?.(null);
    }
  }, [
    selectedSubtitle,
    selectedVideoSegment,
    selectedTextSegment,
    videoSegments,
    onDeleteRequest,
    onDeleteTextSegment,
    setSubtitles,
    setRawSegmentSubtitles,
    setWordSubtitles,
    setVideoSegments,
    setCustomTextSegments,
    setDeletedRanges,
    setSelectedVideoSegment,
    setSelectedTextSegment,
    fps,
  ]);

  const height = isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;

  return (
    <div
      ref={containerRef}
      className="shrink-0 border-t border-border bg-secondary w-full flex flex-col transition-all duration-300"
      style={{ height }}
    >
      {/* Header with controls */}
      <div
        className="relative flex items-center justify-between px-4 border-b border-border"
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

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              handleSplit();
              handleSplitVideo();
              handleSplitText();
            }}
            disabled={
              !subtitles.some(
                (s) => currentFrame >= s.startFrame && currentFrame < s.endFrame
              ) &&
              !(
                videoSegments.length > 0 &&
                videoSegments.some(
                  (s) =>
                    currentFrame >= s.startFrame && currentFrame < s.endFrame
                )
              ) &&
              !(
                customTextSegments.length > 0 &&
                customTextSegments.some(
                  (s) =>
                    currentFrame >= s.startFrame && currentFrame < s.endFrame
                )
              )
            }
            title="Split subtitle and video at playhead (S / Ctrl+K)"
          >
            <ScissorsLineDashed size="6" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteClick}
            disabled={
              !selectedSubtitle &&
              !selectedVideoSegment &&
              !selectedTextSegment
            }
            title="Delete selected (Delete key)"
          >
            <Trash2 size="6" />
          </Button>

          {setCustomTextTracks && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsExpanded(true);
                onAddTextTrackClick?.();
                const newTrack = {
                  id: `text-track-${Date.now()}`,
                  name: `Text ${customTextTracks.length + 1}`,
                  visible: true,
                  color: TEXT_TRACK_COLORS[customTextTracks.length % TEXT_TRACK_COLORS.length],
                };
                setCustomTextTracks((prev) => [...prev, newTrack]);
              }}
              title="Add text track"
            >
              <Type size="6" />
            </Button>
          )}

          {onCropClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCropClick}
              disabled={
                !videoUrl ||
                (videoSegments.length > 0 && !selectedVideoSegment)
              }
              title={
                videoSegments.length > 0 && !selectedVideoSegment
                  ? "Select a video segment to crop"
                  : "Crop video"
              }
            >
              <Crop size="6" />
            </Button>
          )}
        </div>

        {playerRef && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!playerRef.current) return;
                if (isPlaying) {
                  playerRef.current.pause();
                } else {
                  playerRef.current.play();
                }
              }}
              disabled={!videoUrl}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size="6" />
              ) : (
                <Play size="6" />
              )}
            </Button>
          </div>
        )}

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
            style={{ width: timelineWidth, minWidth: "100%", maxHeight: "184px" }}
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
            <VideoTrack
              videoSegments={videoSegments}
              selectedSegment={selectedVideoSegment ?? null}
              onSelectSegment={(id) => setSelectedVideoSegment?.(id)}
              videoDuration={videoDuration}
              fps={fps}
              zoom={zoom}
              onDragStart={handleDragStart}
            />
            <SubtitleTrack
              subtitles={subtitles}
              selectedSubtitle={selectedSubtitle}
              videoDuration={videoDuration}
              fps={fps}
              zoom={zoom}
              onSelectSubtitle={setSelectedSubtitle}
              onDragStart={handleDragStart}
            />
            {customTextTracks.map((track) => (
              <CustomTextTrack
                key={track.id}
                track={track}
                segments={customTextSegments.filter((s) => s.trackId === track.id)}
                selectedSegment={selectedTextSegment ?? null}
                onSelectSegment={(id) => {
                  setSelectedTextSegment?.(id);
                  setSelectedSubtitle?.(null);
                  setSelectedVideoSegment?.(null);
                }}
                videoDuration={videoDuration}
                fps={fps}
                zoom={zoom}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
