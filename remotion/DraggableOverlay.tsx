import React, { useCallback, useMemo, useState } from 'react';
import { useCurrentScale, Sequence } from 'remotion';
import type { DraggablePosition } from '@/components/timeline/types';

const OUTLINE_COLOR = '#0B84F3';

export type DraggableOverlayProps = {
  compositeId: string;
  left: number;
  top: number;
  width: number;
  height: number;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  changeItem: (updater: (pos: DraggablePosition) => DraggablePosition) => void;
  compositionWidth: number;
  compositionHeight: number;
  isDraggingAny: boolean;
  from: number;
  durationInFrames: number;
  /** Banner-style: span full width, only vertical drag; synced left is always 0. */
  verticalOnly?: boolean;
  /** Called when the user begins dragging (e.g. pause the preview player). */
  onDragStart?: () => void;
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Transparent hit target + selection outline for Remotion Player drag & drop.
 * @see https://www.remotion.dev/docs/player/drag-and-drop/
 */
export const DraggableOverlay: React.FC<DraggableOverlayProps> = ({
  compositeId,
  left,
  top,
  width,
  height,
  selectedItemId,
  setSelectedItemId,
  changeItem,
  compositionWidth,
  compositionHeight,
  isDraggingAny,
  from,
  durationInFrames,
  verticalOnly = false,
  onDragStart,
}) => {
  const scale = useCurrentScale();
  const scaledBorder = Math.ceil(2 / scale);

  const [hovered, setHovered] = useState(false);

  const isSelected = selectedItemId === compositeId;

  const effectiveLeft = verticalOnly ? 0 : left;
  const effectiveWidth = verticalOnly ? compositionWidth : width;

  const style: React.CSSProperties = useMemo(
    () => ({
      width: effectiveWidth,
      height,
      left: effectiveLeft,
      top,
      position: 'absolute',
      outline:
        (hovered && !isDraggingAny) || isSelected
          ? `${scaledBorder}px solid ${OUTLINE_COLOR}`
          : undefined,
      userSelect: 'none',
      touchAction: 'none',
      cursor: 'move',
      boxSizing: 'border-box',
      pointerEvents: 'auto',
    }),
    [
      effectiveWidth,
      height,
      effectiveLeft,
      top,
      hovered,
      isDraggingAny,
      isSelected,
      scaledBorder,
    ]
  );

  const startDragging = useCallback(
    (e: PointerEvent | React.MouseEvent) => {
      onDragStart?.();
      const initialX = e.clientX;
      const initialY = e.clientY;
      const startLeft = effectiveLeft;
      const startTop = top;

      const onPointerMove = (pointerMoveEvent: PointerEvent) => {
        const offsetX = (pointerMoveEvent.clientX - initialX) / scale;
        const offsetY = (pointerMoveEvent.clientY - initialY) / scale;
        const nextLeft = verticalOnly
          ? 0
          : Math.round(
              clamp(
                startLeft + offsetX,
                0,
                Math.max(0, compositionWidth - effectiveWidth)
              )
            );
        const nextTop = Math.round(
          clamp(startTop + offsetY, 0, Math.max(0, compositionHeight - height))
        );
        changeItem((prev) => ({
          ...prev,
          left: nextLeft,
          top: nextTop,
          isDragging: true,
        }));
      };

      const onPointerUp = () => {
        changeItem((prev) => ({
          ...prev,
          isDragging: false,
        }));
        window.removeEventListener('pointermove', onPointerMove);
      };

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { once: true });
    },
    [
      effectiveLeft,
      top,
      effectiveWidth,
      height,
      verticalOnly,
      scale,
      compositionWidth,
      compositionHeight,
      changeItem,
      onDragStart,
    ]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      if (e.button !== 0) {
        return;
      }
      setSelectedItemId(compositeId);
      // Persist default bounds into state on first interaction so the visual layer matches the overlay.
      changeItem((prev) => ({
        ...prev,
        left: verticalOnly ? 0 : (prev.left ?? effectiveLeft),
        top: prev.top ?? top,
      }));
      startDragging(e);
    },
    [
      compositeId,
      setSelectedItemId,
      changeItem,
      verticalOnly,
      effectiveLeft,
      top,
      startDragging,
    ]
  );

  return (
    <Sequence from={from} durationInFrames={durationInFrames} layout="none">
      <div
        onPointerDown={onPointerDown}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        style={style}
        role="presentation"
      />
    </Sequence>
  );
};
