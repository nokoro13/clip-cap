"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { MIN_ZOOM, MAX_ZOOM } from "./constants";
import { calculateZoomToFit } from "./utils";

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  videoDuration: number;
  fps: number;
  containerWidth: number;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomChange,
  videoDuration,
  fps,
  containerWidth,
}) => {
  const handleZoomIn = useCallback(() => {
    onZoomChange(Math.min(zoom * 1.5, MAX_ZOOM));
  }, [zoom, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    onZoomChange(Math.max(zoom / 1.5, MIN_ZOOM));
  }, [zoom, onZoomChange]);

  const handleZoomToFit = useCallback(() => {
    const fitZoom = calculateZoomToFit(videoDuration, fps, containerWidth);
    onZoomChange(Math.max(MIN_ZOOM, Math.min(fitZoom, MAX_ZOOM)));
  }, [videoDuration, fps, containerWidth, onZoomChange]);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleZoomOut}
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleZoomIn}
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleZoomToFit}
        title="Zoom to Fit"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
};
