"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Crop, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VideoTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

// Min scale so full 16:9 video fits in 9:16 frame: coverWidth*scale <= 1080 => scale <= 1080/3413 ≈ 0.32
const MIN_SCALE = 0.315;
const MAX_SCALE = 3;
const SCALE_STEP = 0.1;

const VIDEO_ASPECT_LANDSCAPE = 16 / 9;
const PORTRAIT_THRESHOLD = 0.7; // aspect width/height < this => 9:16
// For 16:9 container, 9:16 frame height=100%, frame width = (9/16)^2 of container ≈ 31.64%
const FRAME_WIDTH_PERCENT = (9 / 16) * (9 / 16) * 100;

/** For landscape 16:9, the scaled video is centered and has width (scale*100%) of container. Return [min, max] for frameXPercent so the 9:16 frame stays within the video. */
function landscapeFrameXBounds(
  scale: number,
  frameWidthPercent: number = FRAME_WIDTH_PERCENT
): [number, number] {
  const slot = 100 - frameWidthPercent; // horizontal travel range for frame (in %)
  const videoLeft = 50 * (1 - scale);
  const videoRight = 50 * (1 + scale);
  const min = Math.max(0, videoLeft / slot);
  const max = Math.min(1, (videoRight - frameWidthPercent) / slot);
  return [min, max];
}

type VideoCropDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string | null;
  currentTransform: VideoTransform;
  onApply: (transform: VideoTransform) => void;
  compositionWidth?: number;
  compositionHeight?: number;
  initialVideoAspectRatio?: number;
  onVideoDimensionsLoaded?: (width: number, height: number) => void;
};

function transformToFramePosition(
  transform: VideoTransform,
  compositionWidth: number,
  compositionHeight: number,
  videoAspectRatio: number = VIDEO_ASPECT_LANDSCAPE
): { frameXPercent: number; frameYPercent: number; scale: number } {
  const coverWidth =
    compositionHeight * videoAspectRatio > compositionWidth
      ? compositionHeight * videoAspectRatio
      : compositionWidth;
  const coverHeight =
    compositionHeight * videoAspectRatio > compositionWidth
      ? compositionHeight
      : compositionWidth / videoAspectRatio;

  const panRangeX = Math.max(0, coverWidth * transform.scale - compositionWidth);
  const panRangeY = Math.max(0, coverHeight * transform.scale - compositionHeight);

  const frameXPercent =
    panRangeX > 0 ? 0.5 - transform.offsetX / panRangeX : 0.5;
  const frameYPercent =
    panRangeY > 0 ? 0.5 - transform.offsetY / panRangeY : 0.5;

  return {
    frameXPercent: Math.max(0, Math.min(1, frameXPercent)),
    frameYPercent: Math.max(0, Math.min(1, frameYPercent)),
    scale: transform.scale,
  };
}

function framePositionToTransform(
  frameXPercent: number,
  frameYPercent: number,
  scale: number,
  compositionWidth: number,
  compositionHeight: number,
  videoAspectRatio: number = VIDEO_ASPECT_LANDSCAPE
): VideoTransform {
  const coverWidth =
    compositionHeight * videoAspectRatio > compositionWidth
      ? compositionHeight * videoAspectRatio
      : compositionWidth;
  const coverHeight =
    compositionHeight * videoAspectRatio > compositionWidth
      ? compositionHeight
      : compositionWidth / videoAspectRatio;

  const panRangeX = Math.max(0, coverWidth * scale - compositionWidth);
  const panRangeY = Math.max(0, coverHeight * scale - compositionHeight);

  return {
    scale,
    offsetX: (0.5 - frameXPercent) * panRangeX,
    offsetY: (0.5 - frameYPercent) * panRangeY,
  };
}

export function VideoCropDialog({
  open,
  onOpenChange,
  videoUrl,
  currentTransform,
  onApply,
  compositionWidth = 1080,
  compositionHeight = 1920,
  initialVideoAspectRatio,
  onVideoDimensionsLoaded,
}: VideoCropDialogProps) {
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const effectiveAspect =
    initialVideoAspectRatio ?? videoAspectRatio ?? VIDEO_ASPECT_LANDSCAPE;
  const isPortrait = effectiveAspect < PORTRAIT_THRESHOLD;
  const minScale = MIN_SCALE;

  // For 16:9 in 9:16, the editor shows "contain" (letterbox) when transform is identity (1,0,0).
  // The dialog uses cover math, so scale=1 would show zoomed. Use contain scale so preview matches editor.
  const isLandscapeIdentity =
    !isPortrait &&
    currentTransform.scale === 1 &&
    currentTransform.offsetX === 0 &&
    currentTransform.offsetY === 0;

  const { frameXPercent: initX, frameYPercent: initY, scale: initScale } =
    isLandscapeIdentity
      ? { frameXPercent: 0.5, frameYPercent: 0.5, scale: minScale }
      : transformToFramePosition(
          currentTransform,
          compositionWidth,
          compositionHeight,
          effectiveAspect
        );

  const [scale, setScale] = useState(initScale);
  const [frameXPercent, setFrameXPercent] = useState(initX);
  const [frameYPercent, setFrameYPercent] = useState(initY);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    frameX: number;
    frameY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (h > 0) {
      setVideoAspectRatio(w / h);
      onVideoDimensionsLoaded?.(w, h);
    }
    v.play().catch(() => {});
  }, [onVideoDimensionsLoaded]);

  useEffect(() => {
    if (open) {
      const isLandscapeIdentitySync =
        !isPortrait &&
        currentTransform.scale === 1 &&
        currentTransform.offsetX === 0 &&
        currentTransform.offsetY === 0;
      const { frameXPercent: x, frameYPercent: y, scale: s } =
        isLandscapeIdentitySync
          ? { frameXPercent: 0.5, frameYPercent: 0.5, scale: minScale }
          : transformToFramePosition(
              currentTransform,
              compositionWidth,
              compositionHeight,
              effectiveAspect
            );
      setScale(s);
      if (!isPortrait) {
        const [minX, maxX] = landscapeFrameXBounds(s);
        setFrameXPercent(Math.max(minX, Math.min(maxX, x)));
      } else {
        setFrameXPercent(x);
      }
      setFrameYPercent(y);
    }
  }, [open, currentTransform, compositionWidth, compositionHeight, effectiveAspect, isPortrait, minScale]);

  // When scale changes in landscape mode, clamp frame X so the 9:16 frame stays within the video
  useEffect(() => {
    if (open && !isPortrait) {
      setFrameXPercent((prev) => {
        const [minX, maxX] = landscapeFrameXBounds(scale);
        return Math.max(minX, Math.min(maxX, prev));
      });
    }
  }, [scale, open, isPortrait]);

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(minScale, s - SCALE_STEP));
  }, [minScale]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) handleZoomIn();
      else handleZoomOut();
    },
    [handleZoomIn, handleZoomOut]
  );

  const handleFrameMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        frameX: frameXPercent,
        frameY: frameYPercent,
      };
    },
    [frameXPercent, frameYPercent]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const frameWidth = rect.height * (9 / 16);
      const panRange = rect.width - frameWidth;
      if (panRange <= 0) return;
      const dx = (e.clientX - start.x) / panRange;
      const dy = (e.clientY - start.y) / rect.height;
      let newX = start.frameX + dx;
      let newY = Math.max(0, Math.min(1, start.frameY + dy));
      if (!isPortrait) {
        const [minX, maxX] = landscapeFrameXBounds(scale);
        newX = Math.max(minX, Math.min(maxX, newX));
      } else {
        newX = Math.max(0, Math.min(1, newX));
      }
      setFrameXPercent(newX);
      setFrameYPercent(newY);
    },
    [isPortrait, scale]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleApply = useCallback(() => {
    let transform = framePositionToTransform(
      frameXPercent,
      frameYPercent,
      scale,
      compositionWidth,
      compositionHeight,
      effectiveAspect
    );
    if (isPortrait) {
      transform = { ...transform, offsetX: 0, offsetY: 0 };
    }
    onApply(transform);
    onOpenChange(false);
  }, [frameXPercent, frameYPercent, scale, compositionWidth, compositionHeight, effectiveAspect, isPortrait, onApply, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Adjust Video Position</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Crop className="size-4" />
              Scroll or click to adjust face size
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleZoomOut}
                disabled={scale <= minScale}
                aria-label="Zoom out"
              >
                <ZoomOut className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleZoomIn}
                disabled={scale >= MAX_SCALE}
                aria-label="Zoom in"
              >
                <ZoomIn className="size-4" />
              </Button>
            </div>
          </div>

          <div
            ref={containerRef}
            className={cn(
              "relative overflow-hidden rounded-lg border border-border bg-black",
              isPortrait ? "mx-auto h-[50vh]" : "w-full",
              "cursor-default"
            )}
            style={{
              aspectRatio: isPortrait ? `${9} / ${16}` : `${16} / ${9}`,
            }}
            onWheel={handleWheel}
          >
            {videoUrl ? (
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "center center",
                  }}
                >
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className={cn(
                      "absolute inset-0 w-full h-full",
                      isPortrait ? "object-cover" : "object-contain"
                    )}
                    muted
                    playsInline
                    onLoadedMetadata={handleVideoLoadedMetadata}
                  />
                </div>

                {isPortrait ? (
                  <div
                    className="absolute inset-0 pointer-events-none opacity-30"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)
                      `,
                      backgroundSize: "33.33% 33.33%",
                    }}
                  />
                ) : (
                  <>
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `linear-gradient(to right, 
                          rgba(0,0,0,0.5) 0%, 
                          rgba(0,0,0,0.5) ${frameXPercent * (100 - FRAME_WIDTH_PERCENT)}%, 
                          transparent ${frameXPercent * (100 - FRAME_WIDTH_PERCENT)}%, 
                          transparent ${frameXPercent * (100 - FRAME_WIDTH_PERCENT) + FRAME_WIDTH_PERCENT}%, 
                          rgba(0,0,0,0.5) ${frameXPercent * (100 - FRAME_WIDTH_PERCENT) + FRAME_WIDTH_PERCENT}%, 
                          rgba(0,0,0,0.5) 100%)`,
                      }}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "absolute border-2 border-white shadow-lg cursor-grab active:cursor-grabbing",
                        "flex flex-col overflow-hidden"
                      )}
                      style={{
                        aspectRatio: `${9} / ${16}`,
                        height: "100%",
                        left: `${frameXPercent * (100 - FRAME_WIDTH_PERCENT)}%`,
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                      onMouseDown={handleFrameMouseDown}
                    >
                      <div
                        className="absolute inset-0 pointer-events-none opacity-30"
                        style={{
                          backgroundImage: `
                            linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)
                          `,
                          backgroundSize: "33.33% 33.33%",
                        }}
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                No video loaded
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleApply}>
            Apply Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
