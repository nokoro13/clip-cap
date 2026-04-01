"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
const SCALE_STEP_SPLIT = 0.05;

const VIDEO_ASPECT_LANDSCAPE = 16 / 9;
const PORTRAIT_THRESHOLD = 0.7; // aspect width/height < this => 9:16
// For 16:9 container, 9:16 frame height=100%, frame width = (9/16)^2 of container ≈ 31.64%
const FRAME_WIDTH_PERCENT = (9 / 16) * (9 / 16) * 100;

/** For landscape 16:9 preview, scaled video centered with width (scale×100%). Return [min, max] for frameXPercent so the crop frame (output aspect) stays within the video. */
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

/** Crop frame width as % of 16:9 preview width; crop aspect = composition (e.g. 9:16 full or 1080/960 split half). */
function landscapeCropFrameWidthPercentFor(
  compositionWidth: number,
  compositionHeight: number
): number {
  return (compositionWidth / compositionHeight) * (9 / 16) * 100;
}

function coverDimensionsForComposition(
  compositionWidth: number,
  compositionHeight: number,
  videoAspectRatio: number
) {
  const coverWidth =
    compositionHeight * videoAspectRatio > compositionWidth
      ? compositionHeight * videoAspectRatio
      : compositionWidth;
  const coverHeight =
    compositionHeight * videoAspectRatio > compositionWidth
      ? compositionHeight
      : compositionWidth / videoAspectRatio;
  return { coverWidth, coverHeight };
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
  /** Trim the video to this range (seconds). When set, the crop dialog shows and loops this clip. */
  trimStartSeconds?: number;
  trimEndSeconds?: number;
  /** Split-screen: edit one stacked half. Parent should pass composition matching that half (e.g. 1080×960). */
  splitMode?: boolean;
  activeSplitHalf?: "top" | "bottom";
  onActiveSplitHalfChange?: (half: "top" | "bottom") => void;
};

function transformToFramePosition(
  transform: VideoTransform,
  compositionWidth: number,
  compositionHeight: number,
  videoAspectRatio: number = VIDEO_ASPECT_LANDSCAPE
): { frameXPercent: number; frameYPercent: number; scale: number } {
  const { coverWidth, coverHeight } = coverDimensionsForComposition(
    compositionWidth,
    compositionHeight,
    videoAspectRatio
  );

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
  const { coverWidth, coverHeight } = coverDimensionsForComposition(
    compositionWidth,
    compositionHeight,
    videoAspectRatio
  );

  const panRangeX = Math.max(0, coverWidth * scale - compositionWidth);
  const panRangeY = Math.max(0, coverHeight * scale - compositionHeight);

  return {
    scale,
    offsetX: (0.5 - frameXPercent) * panRangeX,
    offsetY: (0.5 - frameYPercent) * panRangeY,
  };
}

function panRanges(
  scale: number,
  compositionWidth: number,
  compositionHeight: number,
  videoAspectRatio: number
) {
  const { coverWidth, coverHeight } = coverDimensionsForComposition(
    compositionWidth,
    compositionHeight,
    videoAspectRatio
  );
  return {
    panRangeX: Math.max(0, coverWidth * scale - compositionWidth),
    panRangeY: Math.max(0, coverHeight * scale - compositionHeight),
  };
}

function clampSplitOffsets(
  offsetX: number,
  offsetY: number,
  panRangeX: number,
  panRangeY: number
): { offsetX: number; offsetY: number } {
  const hx = panRangeX / 2;
  const hy = panRangeY / 2;
  return {
    offsetX:
      panRangeX > 1e-6 ? Math.max(-hx, Math.min(hx, offsetX)) : 0,
    offsetY:
      panRangeY > 1e-6 ? Math.max(-hy, Math.min(hy, offsetY)) : 0,
  };
}

function offsetsToFramePercents(
  offsetX: number,
  offsetY: number,
  panRangeX: number,
  panRangeY: number
): { frameXPercent: number; frameYPercent: number } {
  return {
    frameXPercent:
      panRangeX > 1e-6
        ? Math.max(0, Math.min(1, 0.5 - offsetX / panRangeX))
        : 0.5,
    frameYPercent:
      panRangeY > 1e-6
        ? Math.max(0, Math.min(1, 0.5 - offsetY / panRangeY))
        : 0.5,
  };
}

/** Zoom toward container-local focal px; uniform preview scale u matches Remotion cover + translate. */
function zoomSplitTowardFocal(
  scale: number,
  frameXPercent: number,
  frameYPercent: number,
  newScale: number,
  focalX: number,
  focalY: number,
  previewW: number,
  previewH: number,
  compositionWidth: number,
  compositionHeight: number,
  videoAspectRatio: number
): { scale: number; frameXPercent: number; frameYPercent: number } {
  const s0 = scale;
  const s1 = newScale;
  if (s0 < 1e-6 || previewW < 1 || previewH < 1) {
    return { scale: s1, frameXPercent, frameYPercent };
  }
  const ratio = s1 / s0;
  const u = Math.min(
    previewW / compositionWidth,
    previewH / compositionHeight
  );
  const t = framePositionToTransform(
    frameXPercent,
    frameYPercent,
    s0,
    compositionWidth,
    compositionHeight,
    videoAspectRatio
  );
  const ox0 = t.offsetX * u;
  const oy0 = t.offsetY * u;
  const ox1 = (focalX - previewW / 2) * (1 - ratio) + ox0 * ratio;
  const oy1 = (focalY - previewH / 2) * (1 - ratio) + oy0 * ratio;
  let oX = ox1 / u;
  let oY = oy1 / u;
  const { panRangeX, panRangeY } = panRanges(
    s1,
    compositionWidth,
    compositionHeight,
    videoAspectRatio
  );
  ({ offsetX: oX, offsetY: oY } = clampSplitOffsets(
    oX,
    oY,
    panRangeX,
    panRangeY
  ));
  const { frameXPercent: fx, frameYPercent: fy } = offsetsToFramePercents(
    oX,
    oY,
    panRangeX,
    panRangeY
  );
  return { scale: s1, frameXPercent: fx, frameYPercent: fy };
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
  trimStartSeconds = 0,
  trimEndSeconds,
  splitMode = false,
  activeSplitHalf = "top",
  onActiveSplitHalfChange,
}: VideoCropDialogProps) {
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const effectiveAspect =
    initialVideoAspectRatio ?? videoAspectRatio ?? VIDEO_ASPECT_LANDSCAPE;
  const isPortrait = effectiveAspect < PORTRAIT_THRESHOLD;
  /** Width of sliding crop frame as % of 16:9 preview (output = composition aspect: 9:16 or 1080/960). */
  const landscapeCropFrameWidthPercent = landscapeCropFrameWidthPercentFor(
    compositionWidth,
    compositionHeight
  );
  const outputFrameAspect = compositionWidth / compositionHeight;

  const effectiveMinScale = useMemo(() => {
    if (!splitMode) return MIN_SCALE;
    const { coverWidth, coverHeight } = coverDimensionsForComposition(
      compositionWidth,
      compositionHeight,
      effectiveAspect
    );
    return Math.max(
      0.15,
      Math.min(
        compositionWidth / coverWidth,
        compositionHeight / coverHeight
      ) * 0.999
    );
  }, [splitMode, compositionWidth, compositionHeight, effectiveAspect]);

  // Full 9:16 only: identity uses minScale so preview matches editor contain. Split half (1080×960): identity uses scale 1 + centered frame.
  const isLandscapeIdentity =
    !isPortrait &&
    currentTransform.scale === 1 &&
    currentTransform.offsetX === 0 &&
    currentTransform.offsetY === 0;

  const { frameXPercent: initX, frameYPercent: initY, scale: initScale } =
    isLandscapeIdentity && !splitMode
      ? { frameXPercent: 0.5, frameYPercent: 0.5, scale: MIN_SCALE }
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
    offsetX?: number;
    offsetY?: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  /** Realistic default so split preview math is never ~1×1 before layout (avoids “white dot” crop). */
  const [containerSize, setContainerSize] = useState({ w: 560, h: 315 });

  useLayoutEffect(() => {
    if (!open) return;
    const el = containerRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      if (w < 2 || h < 2) return;
      setContainerSize({ w, h });
    };
    read();
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      read();
      raf2 = requestAnimationFrame(read);
    });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
    };
  }, [open]);

  const scaleStep = splitMode ? SCALE_STEP_SPLIT : SCALE_STEP;

  const handleVideoLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (h > 0) {
      setVideoAspectRatio(w / h);
      onVideoDimensionsLoaded?.(w, h);
    }
    v.currentTime = trimStartSeconds;
    v.play().catch(() => {});
  }, [onVideoDimensionsLoaded, trimStartSeconds]);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || trimEndSeconds == null) return;
    if (v.currentTime >= trimEndSeconds) {
      v.currentTime = trimStartSeconds;
    }
  }, [trimStartSeconds, trimEndSeconds]);

  // When dialog opens, ensure video plays (handles case where metadata already loaded)
  useEffect(() => {
    if (open && videoUrl) {
      const v = videoRef.current;
      if (v && v.readyState >= 2) {
        v.currentTime = trimStartSeconds;
        v.play().catch(() => {});
      }
    }
  }, [open, videoUrl, trimStartSeconds]);

  useEffect(() => {
    if (open) {
      const isLandscapeIdentitySync =
        !isPortrait &&
        currentTransform.scale === 1 &&
        currentTransform.offsetX === 0 &&
        currentTransform.offsetY === 0;
      const { frameXPercent: x, frameYPercent: y, scale: s } =
        isLandscapeIdentitySync && !splitMode
          ? { frameXPercent: 0.5, frameYPercent: 0.5, scale: MIN_SCALE }
          : transformToFramePosition(
              currentTransform,
              compositionWidth,
              compositionHeight,
              effectiveAspect
            );
      setScale(s);
      if (!isPortrait) {
        if (splitMode) {
          setFrameXPercent(Math.max(0, Math.min(1, x)));
        } else {
          const [minX, maxX] = landscapeFrameXBounds(s, landscapeCropFrameWidthPercent);
          setFrameXPercent(Math.max(minX, Math.min(maxX, x)));
        }
      } else {
        setFrameXPercent(x);
      }
      setFrameYPercent(y);
    }
  }, [
    open,
    currentTransform,
    compositionWidth,
    compositionHeight,
    effectiveAspect,
    isPortrait,
    landscapeCropFrameWidthPercent,
    splitMode,
  ]);

  // Non-split landscape: clamp X for sliding-band crop strip
  useEffect(() => {
    if (open && !isPortrait && !splitMode) {
      setFrameXPercent((prev) => {
        const [minX, maxX] = landscapeFrameXBounds(scale, landscapeCropFrameWidthPercent);
        return Math.max(minX, Math.min(maxX, prev));
      });
    }
  }, [scale, open, isPortrait, splitMode, landscapeCropFrameWidthPercent]);

  const applySplitZoom = useCallback(
    (nextScale: number, focalX: number, focalY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const W = Math.max(1, r.width);
      const H = Math.max(1, r.height);
      const o = zoomSplitTowardFocal(
        scale,
        frameXPercent,
        frameYPercent,
        nextScale,
        focalX,
        focalY,
        W,
        H,
        compositionWidth,
        compositionHeight,
        effectiveAspect
      );
      setScale(o.scale);
      setFrameXPercent(o.frameXPercent);
      setFrameYPercent(o.frameYPercent);
    },
    [
      scale,
      frameXPercent,
      frameYPercent,
      compositionWidth,
      compositionHeight,
      effectiveAspect,
    ]
  );

  const handleZoomIn = useCallback(() => {
    if (!splitMode || isPortrait) {
      setScale((s) => Math.min(MAX_SCALE, s + scaleStep));
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = Math.max(1, r.width);
    const H = Math.max(1, r.height);
    const next = Math.min(MAX_SCALE, scale + scaleStep);
    if (next <= scale) return;
    applySplitZoom(next, W / 2, H / 2);
  }, [
    splitMode,
    isPortrait,
    scaleStep,
    scale,
    applySplitZoom,
  ]);

  const handleZoomOut = useCallback(() => {
    if (!splitMode || isPortrait) {
      setScale((s) => Math.max(effectiveMinScale, s - scaleStep));
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = Math.max(1, r.width);
    const H = Math.max(1, r.height);
    const next = Math.max(effectiveMinScale, scale - scaleStep);
    if (next >= scale) return;
    applySplitZoom(next, W / 2, H / 2);
  }, [
    splitMode,
    isPortrait,
    scaleStep,
    effectiveMinScale,
    scale,
    applySplitZoom,
  ]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const W = Math.max(1, rect.width);
      const H = Math.max(1, rect.height);
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;

      if (splitMode && !isPortrait) {
        const next =
          e.deltaY < 0
            ? Math.min(MAX_SCALE, scale + scaleStep)
            : Math.max(effectiveMinScale, scale - scaleStep);
        if (next !== scale) applySplitZoom(next, fx, fy);
        return;
      }

      if (e.deltaY < 0)
        setScale((s) => Math.min(MAX_SCALE, s + scaleStep));
      else
        setScale((s) => Math.max(effectiveMinScale, s - scaleStep));
    },
    [
      splitMode,
      isPortrait,
      scale,
      scaleStep,
      effectiveMinScale,
      applySplitZoom,
    ]
  );

  const handleFrameMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.button !== 0 || (splitMode && !isPortrait)) return;
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        frameX: frameXPercent,
        frameY: frameYPercent,
      };
    },
    [frameXPercent, frameYPercent, splitMode, isPortrait]
  );

  const handleSplitPanMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!splitMode || isPortrait || e.button !== 0) return;
      e.stopPropagation();
      const t = framePositionToTransform(
        frameXPercent,
        frameYPercent,
        scale,
        compositionWidth,
        compositionHeight,
        effectiveAspect
      );
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        frameX: frameXPercent,
        frameY: frameYPercent,
        offsetX: t.offsetX,
        offsetY: t.offsetY,
      };
    },
    [
      splitMode,
      isPortrait,
      frameXPercent,
      frameYPercent,
      scale,
      compositionWidth,
      compositionHeight,
      effectiveAspect,
    ]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const start = dragStartRef.current;
      if (!start || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const W = Math.max(1, rect.width);
      const H = Math.max(1, rect.height);
      const uPan = Math.min(W / compositionWidth, H / compositionHeight);

      if (splitMode && !isPortrait && start.offsetX !== undefined && start.offsetY !== undefined) {
        const dcx = e.clientX - start.x;
        const dcy = e.clientY - start.y;
        let oX = start.offsetX + dcx / uPan;
        let oY = start.offsetY + dcy / uPan;
        const { panRangeX, panRangeY } = panRanges(
          scale,
          compositionWidth,
          compositionHeight,
          effectiveAspect
        );
        ({ offsetX: oX, offsetY: oY } = clampSplitOffsets(oX, oY, panRangeX, panRangeY));
        const { frameXPercent: fx, frameYPercent: fy } = offsetsToFramePercents(
          oX,
          oY,
          panRangeX,
          panRangeY
        );
        setFrameXPercent(fx);
        setFrameYPercent(fy);
        return;
      }

      const frameWidth = rect.height * outputFrameAspect;
      const panRange = rect.width - frameWidth;
      if (panRange <= 0) return;
      const dx = (e.clientX - start.x) / panRange;
      const dy = (e.clientY - start.y) / rect.height;
      let newX = start.frameX + dx;
      let newY = Math.max(0, Math.min(1, start.frameY + dy));
      if (!isPortrait) {
        const [minX, maxX] = landscapeFrameXBounds(scale, landscapeCropFrameWidthPercent);
        newX = Math.max(minX, Math.min(maxX, newX));
      } else {
        newX = Math.max(0, Math.min(1, newX));
      }
      setFrameXPercent(newX);
      setFrameYPercent(newY);
    },
    [
      splitMode,
      isPortrait,
      scale,
      compositionWidth,
      compositionHeight,
      effectiveAspect,
      outputFrameAspect,
      landscapeCropFrameWidthPercent,
    ]
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
    if (isPortrait && !splitMode) {
      transform = { ...transform, offsetX: 0, offsetY: 0 };
    }
    onApply(transform);
    onOpenChange(false);
  }, [
    frameXPercent,
    frameYPercent,
    scale,
    compositionWidth,
    compositionHeight,
    effectiveAspect,
    isPortrait,
    splitMode,
    onApply,
    onOpenChange,
  ]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const splitVideoWrapperStyle = useMemo(() => {
    if (!splitMode || isPortrait) return null;
    const t = framePositionToTransform(
      frameXPercent,
      frameYPercent,
      scale,
      compositionWidth,
      compositionHeight,
      effectiveAspect
    );
    const { coverWidth, coverHeight } = coverDimensionsForComposition(
      compositionWidth,
      compositionHeight,
      effectiveAspect
    );
    const W = Math.max(32, containerSize.w);
    const H = Math.max(32, containerSize.h);
    const u = Math.min(W / compositionWidth, H / compositionHeight);
    return {
      position: "absolute" as const,
      left: "50%",
      top: "50%",
      width: coverWidth * scale * u,
      height: coverHeight * scale * u,
      transform: `translate(calc(-50% + ${t.offsetX * u}px), calc(-50% + ${t.offsetY * u}px))`,
      zIndex: 1,
    };
  }, [
    splitMode,
    isPortrait,
    frameXPercent,
    frameYPercent,
    scale,
    compositionWidth,
    compositionHeight,
    effectiveAspect,
    containerSize.w,
    containerSize.h,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {splitMode
              ? `Adjust Video — ${activeSplitHalf === "top" ? "Top" : "Bottom"} half`
              : "Adjust Video Position"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {splitMode && onActiveSplitHalfChange ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={activeSplitHalf === "top" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => onActiveSplitHalfChange("top")}
              >
                Top half
              </Button>
              <Button
                type="button"
                variant={activeSplitHalf === "bottom" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => onActiveSplitHalfChange("bottom")}
              >
                Bottom half
              </Button>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="flex max-w-[min(420px,75vw)] items-center gap-2 leading-snug">
              <Crop className="size-4 shrink-0" />
              {splitMode && !isPortrait ? (
                <>
                  Scroll or pinch to zoom toward the pointer. Drag the video to pan in any direction.
                </>
              ) : (
                <>Scroll or pinch to zoom · drag the frame to pan</>
              )}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handleZoomOut}
                disabled={scale <= effectiveMinScale + 1e-4}
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
              "relative min-h-[180px] min-w-0 shrink-0 overflow-hidden rounded-lg border border-border bg-black",
              isPortrait ? "mx-auto h-[50vh]" : "w-full",
              splitMode && !isPortrait
                ? "cursor-grab active:cursor-grabbing touch-none"
                : "cursor-default"
            )}
            style={{
              aspectRatio: isPortrait ? `${9} / ${16}` : `${16} / ${9}`,
            }}
            onWheel={handleWheel}
          >
            {videoUrl ? (
              <>
                {isPortrait ? (
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
                        className="absolute inset-0 h-full w-full object-cover"
                        muted
                        playsInline
                        autoPlay
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onTimeUpdate={trimEndSeconds != null ? handleTimeUpdate : undefined}
                      />
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0 opacity-30"
                      style={{
                        backgroundImage: `
                        linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)
                      `,
                        backgroundSize: "33.33% 33.33%",
                      }}
                    />
                  </>
                ) : splitMode && splitVideoWrapperStyle ? (
                  <>
                    <div
                      className="will-change-transform"
                      style={splitVideoWrapperStyle}
                      onMouseDown={handleSplitPanMouseDown}
                    >
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover"
                        muted
                        playsInline
                        autoPlay
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onTimeUpdate={trimEndSeconds != null ? handleTimeUpdate : undefined}
                      />
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0 z-20 flex min-h-0 min-w-0 items-center justify-center"
                      aria-hidden
                    >
                      <div
                        className="box-border h-full w-auto max-h-full max-w-full rounded-sm border-2 border-white shadow-[0_0_0_100vmax_rgba(0,0,0,0.52)]"
                        style={{
                          aspectRatio: `${compositionWidth} / ${compositionHeight}`,
                        }}
                      />
                    </div>
                  </>
                ) : (
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
                        className="absolute inset-0 h-full w-full object-contain"
                        muted
                        playsInline
                        autoPlay
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onTimeUpdate={trimEndSeconds != null ? handleTimeUpdate : undefined}
                      />
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: `linear-gradient(to right, 
                          rgba(0,0,0,0.5) 0%, 
                          rgba(0,0,0,0.5) ${frameXPercent * (100 - landscapeCropFrameWidthPercent)}%, 
                          transparent ${frameXPercent * (100 - landscapeCropFrameWidthPercent)}%, 
                          transparent ${frameXPercent * (100 - landscapeCropFrameWidthPercent) + landscapeCropFrameWidthPercent}%, 
                          rgba(0,0,0,0.5) ${frameXPercent * (100 - landscapeCropFrameWidthPercent) + landscapeCropFrameWidthPercent}%, 
                          rgba(0,0,0,0.5) 100%)`,
                      }}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "absolute box-border flex flex-col overflow-hidden border-2 border-white shadow-lg",
                        "cursor-grab active:cursor-grabbing"
                      )}
                      style={{
                        aspectRatio: `${compositionWidth} / ${compositionHeight}`,
                        height: "100%",
                        maxWidth: "100%",
                        left: `${frameXPercent * (100 - landscapeCropFrameWidthPercent)}%`,
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                      onMouseDown={handleFrameMouseDown}
                    >
                      <div
                        className="pointer-events-none absolute inset-0 opacity-30"
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
