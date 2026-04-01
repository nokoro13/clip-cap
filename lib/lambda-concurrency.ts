/**
 * Optimal framesPerLambda for Remotion Lambda (balanced speed vs quota).
 * ClipCap typical range: ~15s (450 frames) to ~90s (2700 frames) at 30fps.
 *
 * @see https://www.remotion.dev/docs/lambda/concurrency
 * Constraints: min framesPerLambda 5, max concurrency 200.
 */

export function calculateFramesPerLambda(frameCount: number): number {
  const safeFrameCount = Math.max(1, Math.floor(frameCount));

  // Very short clips: maximize parallelism without trivially violating min chunk size
  if (safeFrameCount < 300) {
    return Math.max(Math.ceil(safeFrameCount / 15), 5);
  }

  // Scale target concurrency with length; floor((count-450)/100) can go negative — clamp at 15
  const targetConcurrency = Math.min(
    Math.max(15, 15 + Math.floor((safeFrameCount - 450) / 100)),
    40
  );

  const framesPerLambda = Math.ceil(safeFrameCount / targetConcurrency);
  return Math.max(framesPerLambda, 5);
}

/**
 * Matches remotion/Root.tsx calculateMetadata for EditorVideo duration.
 */
export function calculateDurationFromSegments(
  videoSegments: Array<{ endFrame: number }> | undefined
): number {
  if (!videoSegments || videoSegments.length === 0) {
    return 300;
  }
  return Math.max(...videoSegments.map((s) => s.endFrame));
}
