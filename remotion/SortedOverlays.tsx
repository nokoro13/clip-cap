import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { Subtitle, SubtitleStyle } from './Composition';
import type {
  CustomTextSegment,
  BannerSegment,
  DraggablePosition,
} from '@/components/timeline/types';
import { DraggableOverlay } from './DraggableOverlay';
import {
  getSubtitleDragBounds,
  getCustomTextDragBounds,
  getBannerDragBounds,
} from './drag-bounds';

const COMPOSITION_WIDTH = 1080;
const COMPOSITION_HEIGHT = 1920;

export const subtitleCompositeId = (id: string) => `sub:${id}`;
export const customTextCompositeId = (id: string) => `ctext:${id}`;
export const bannerCompositeId = (id: string) => `banner:${id}`;

type OverlayRow = {
  compositeId: string;
  changeItem: (updater: (pos: DraggablePosition) => DraggablePosition) => void;
  left: number;
  top: number;
  width: number;
  height: number;
  from: number;
  durationInFrames: number;
  verticalOnly?: boolean;
};

export type SortedOverlaysProps = {
  subtitles: Subtitle[];
  subtitleStyle: SubtitleStyle;
  customTextSegments: CustomTextSegment[];
  bannerSegments: BannerSegment[];
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  onSubtitlePositionChange?: (
    id: string,
    updater: (pos: DraggablePosition) => DraggablePosition
  ) => void;
  onCustomTextPositionChange?: (
    id: string,
    updater: (pos: DraggablePosition) => DraggablePosition
  ) => void;
  onBannerPositionChange?: (
    id: string,
    updater: (pos: DraggablePosition) => DraggablePosition
  ) => void;
};

function displaySelectedLast(rows: OverlayRow[], selectedItemId: string | null): OverlayRow[] {
  if (!selectedItemId) {
    return rows;
  }
  const selected = rows.filter((r) => r.compositeId === selectedItemId);
  const unselected = rows.filter((r) => r.compositeId !== selectedItemId);
  return [...unselected, ...selected];
}

/**
 * Interactive drag overlays on top of subtitle / custom text / banner layers.
 */
export const SortedOverlays: React.FC<SortedOverlaysProps> = ({
  subtitles,
  subtitleStyle,
  customTextSegments,
  bannerSegments,
  selectedItemId,
  setSelectedItemId,
  onSubtitlePositionChange,
  onCustomTextPositionChange,
  onBannerPositionChange,
}) => {
  const isDraggingAny = useMemo(
    () =>
      subtitles.some((s) => s.isDragging) ||
      customTextSegments.some((s) => s.isDragging) ||
      bannerSegments.some((s) => s.isDragging),
    [subtitles, customTextSegments, bannerSegments]
  );

  const rows = useMemo(() => {
    const list: OverlayRow[] = [];

    if (onSubtitlePositionChange) {
      for (const s of subtitles) {
        if (s.endFrame <= s.startFrame) continue;
        const b = getSubtitleDragBounds(s.text, subtitleStyle);
        list.push({
          compositeId: subtitleCompositeId(s.id),
          changeItem: (up) => onSubtitlePositionChange(s.id, up),
          left: s.left ?? b.left,
          top: s.top ?? b.top,
          width: b.width,
          height: b.height,
          from: s.startFrame,
          durationInFrames: Math.max(1, s.endFrame - s.startFrame),
      });
      }
    }

    if (onCustomTextPositionChange) {
      for (const s of customTextSegments) {
        if (s.endFrame <= s.startFrame) continue;
        const b = getCustomTextDragBounds(s.text, s.style);
        list.push({
          compositeId: customTextCompositeId(s.id),
          changeItem: (up) => onCustomTextPositionChange(s.id, up),
          left: s.left ?? b.left,
          top: s.top ?? b.top,
          width: b.width,
          height: b.height,
          from: s.startFrame,
          durationInFrames: Math.max(1, s.endFrame - s.startFrame),
        });
      }
    }

    if (onBannerPositionChange) {
      for (const s of bannerSegments) {
        if (s.endFrame <= s.startFrame) continue;
        const b = getBannerDragBounds(s.text, s.style, s.logoUrl);
        list.push({
          compositeId: bannerCompositeId(s.id),
          changeItem: (up) => onBannerPositionChange(s.id, up),
          left: 0,
          top: s.top ?? b.top,
          width: b.width,
          height: b.height,
          from: s.startFrame,
          durationInFrames: Math.max(1, s.endFrame - s.startFrame),
          verticalOnly: true,
        });
      }
    }

    return list;
  }, [
    subtitles,
    subtitleStyle,
    customTextSegments,
    bannerSegments,
    onSubtitlePositionChange,
    onCustomTextPositionChange,
    onBannerPositionChange,
  ]);

  const sorted = useMemo(
    () => displaySelectedLast(rows, selectedItemId),
    [rows, selectedItemId]
  );

  return (
    <AbsoluteFill style={{ overflow: 'visible', pointerEvents: 'none' }}>
      {sorted.map((row) => (
        <DraggableOverlay
          key={row.compositeId}
          compositeId={row.compositeId}
          left={row.left}
          top={row.top}
          width={row.width}
          height={row.height}
          selectedItemId={selectedItemId}
          setSelectedItemId={setSelectedItemId}
          changeItem={row.changeItem}
          compositionWidth={COMPOSITION_WIDTH}
          compositionHeight={COMPOSITION_HEIGHT}
          isDraggingAny={isDraggingAny}
          from={row.from}
          durationInFrames={row.durationInFrames}
          verticalOnly={row.verticalOnly}
        />
      ))}
    </AbsoluteFill>
  );
};
