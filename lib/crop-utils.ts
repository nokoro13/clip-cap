/**
 * Shared crop/pan math for VideoCropDialog preview and Remotion split-screen canvas.
 * Keep this identical to the export pipeline so WYSIWYG holds.
 */

export type CropVideoTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function getCoverDimensions(
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

export function hasCustomVideoTransform(
  t: CropVideoTransform | undefined
): t is CropVideoTransform {
  return Boolean(
    t && (t.scale !== 1 || t.offsetX !== 0 || t.offsetY !== 0)
  );
}

export function getIntrinsicMediaSize(
  source: CanvasImageSource
): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) {
    return { w: source.videoWidth, h: source.videoHeight };
  }
  if (source instanceof HTMLImageElement) {
    return { w: source.naturalWidth, h: source.naturalHeight };
  }
  if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) {
    return { w: source.width, h: source.height };
  }
  if (
    'width' in source &&
    'height' in source &&
    typeof (source as { width: unknown }).width === 'number'
  ) {
    const src = source as { width: number; height: number };
    return { w: src.width, h: src.height };
  }
  return { w: 0, h: 0 };
}

/**
 * Paint one viewport (e.g. split half 1080×960) to match wrapper + object-fit cover
 * used in Remotion's SplitScreenVideoHalves.
 */
export function paintCropToCanvas(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  vw: number,
  vh: number,
  t: CropVideoTransform,
  videoAspectRatio: number,
  isPortrait: boolean
) {
  const { w: vidW, h: vidH } = getIntrinsicMediaSize(source);
  if (vidW <= 0 || vidH <= 0) {
    return;
  }

  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, vw, vh);
  ctx.beginPath();
  ctx.rect(0, 0, vw, vh);
  ctx.clip();

  const custom = hasCustomVideoTransform(t);
  if (custom) {
    const { coverWidth, coverHeight } = getCoverDimensions(
      vw,
      vh,
      videoAspectRatio
    );
    const boxW = coverWidth * t.scale;
    const boxH = coverHeight * t.scale;
    const cx = vw / 2 + t.offsetX;
    const cy = vh / 2 + t.offsetY;
    ctx.translate(cx - boxW / 2, cy - boxH / 2);
    const s = Math.max(boxW / vidW, boxH / vidH);
    const dw = vidW * s;
    const dh = vidH * s;
    const dx = (boxW - dw) / 2;
    const dy = (boxH - dh) / 2;
    ctx.drawImage(source, 0, 0, vidW, vidH, dx, dy, dw, dh);
  } else {
    const useCover = isPortrait;
    const s = useCover
      ? Math.max(vw / vidW, vh / vidH)
      : Math.min(vw / vidW, vh / vidH);
    const dw = vidW * s;
    const dh = vidH * s;
    const dx = (vw - dw) / 2;
    const dy = (vh - dh) / 2;
    ctx.drawImage(source, 0, 0, vidW, vidH, dx, dy, dw, dh);
  }
  ctx.restore();
}
