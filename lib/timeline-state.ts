import type {
  VideoSegment,
  DeletedRange,
  EnhancedSubtitle,
} from "@/components/timeline/types";
import type { WordTiming } from "@/remotion/Composition";

/** Create initial video segment from full video. When editing a clip from a longer video, pass sourceStartFrame (in frames) so the segment shows the correct portion. */
export function createInitialVideoSegment(
  videoUrl: string,
  durationFrames: number,
  sourceStartFrame = 0
): VideoSegment {
  return {
    id: `video-0-${Date.now()}`,
    startFrame: 0,
    endFrame: durationFrames,
    sourceStartFrame,
    sourceEndFrame: sourceStartFrame + durationFrames,
    sourceVideoUrl: videoUrl,
  };
}

/** Apply deleted ranges (subtitle-only) to subtitles - mark overlapping as deleted */
export function applyDeletedRangesToSubtitles(
  subtitles: EnhancedSubtitle[],
  deletedRanges: DeletedRange[]
): EnhancedSubtitle[] {
  const subtitleOnlyRanges = deletedRanges.filter((r) => !r.affectsVideo);
  if (subtitleOnlyRanges.length === 0) return subtitles;

  return subtitles.map((sub) => {
    const overlapsDeletedRange = subtitleOnlyRanges.some(
      (range) =>
        sub.startFrame < range.endFrame && sub.endFrame > range.startFrame
    );
    return { ...sub, isDeleted: overlapsDeletedRange };
  });
}

/** Check if a subtitle overlaps with a deleted range (for time-based matching) */
export function subtitleOverlapsDeletedRange(
  sub: { startFrame: number; endFrame: number },
  range: DeletedRange
): boolean {
  return sub.startFrame >= range.startFrame && sub.endFrame <= range.endFrame;
}

/** Check if a subtitle overlaps a time range [cutStart, cutEnd) */
function subtitleOverlapsRange(
  sub: { startFrame: number; endFrame: number },
  cutStart: number,
  cutEnd: number
): boolean {
  return sub.startFrame < cutEnd && sub.endFrame > cutStart;
}

/** Check if a word overlaps [cutStartMs, cutEndMs) */
function wordOverlapsRange(
  word: WordTiming,
  cutStartMs: number,
  cutEndMs: number
): boolean {
  return word.startMs < cutEndMs && word.endMs > cutStartMs;
}

/** Gap in ms between word groups to split into separate subtitles */
const WORD_GROUP_GAP_MS = 250;

/**
 * Process a subtitle with words: filter out words in the cut range, shift remaining,
 * and return new subtitle(s) - possibly split if there's a gap between word groups.
 */
function processSubtitleWithWords(
  sub: EnhancedSubtitle,
  cutStartMs: number,
  cutEndMs: number,
  cutDurationMs: number,
  fps: number
): EnhancedSubtitle[] {
  if (!sub.words || sub.words.length === 0) return [sub];

  // Filter out words in cut range and shift words after the cut
  const processedWords = sub.words
    .filter((w) => !wordOverlapsRange(w, cutStartMs, cutEndMs))
    .map((w) => {
      if (w.startMs >= cutEndMs) {
        return {
          ...w,
          startMs: w.startMs - cutDurationMs,
          endMs: w.endMs - cutDurationMs,
        };
      }
      return w;
    });

  if (processedWords.length === 0) return [];

  // Group words by continuity (gap > WORD_GROUP_GAP_MS = new group)
  const groups: WordTiming[][] = [];
  let current: WordTiming[] = [processedWords[0]];

  for (let i = 1; i < processedWords.length; i++) {
    const prev = processedWords[i - 1];
    const curr = processedWords[i];
    if (curr.startMs - prev.endMs > WORD_GROUP_GAP_MS) {
      groups.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  groups.push(current);

  // Create one subtitle per group
  const baseId = sub.id.replace(/-split-\d+-\d+$/, "");
  return groups.map((words, idx) => {
    const startMs = words[0].startMs;
    const endMs = words[words.length - 1].endMs;
    const startFrame = Math.round((startMs / 1000) * fps);
    const endFrame = Math.round((endMs / 1000) * fps);
    const text = words.map((w) => w.text).join(" ");
    return {
      ...sub,
      id: groups.length > 1 ? `${baseId}-split-${idx + 1}-${Date.now()}` : sub.id,
      text,
      startFrame,
      endFrame,
      words,
    };
  });
}

/**
 * Remove subtitles in [cutStart, cutEnd] and shift all subtitles after cutEnd to the left.
 * For subtitles with words: removes words in the cut range, shifts remaining words,
 * and splits into multiple subtitles if there's a gap. Keeps audio/video in sync.
 */
export function removeSubtitlesInRangeAndShift(
  subtitles: EnhancedSubtitle[],
  cutStart: number,
  cutEnd: number,
  fps: number
): EnhancedSubtitle[] {
  const duration = cutEnd - cutStart;
  const cutStartMs = (cutStart / fps) * 1000;
  const cutEndMs = (cutEnd / fps) * 1000;
  const cutDurationMs = cutEndMs - cutStartMs;

  const result: EnhancedSubtitle[] = [];

  for (const s of subtitles) {
    if (s.startFrame >= cutEnd) {
      // Entirely after cut: shift left
      result.push({
        ...s,
        startFrame: s.startFrame - duration,
        endFrame: s.endFrame - duration,
        words: s.words?.map((w) => ({
          ...w,
          startMs: w.startMs - cutDurationMs,
          endMs: w.endMs - cutDurationMs,
        })),
      });
    } else if (s.endFrame <= cutStart) {
      // Entirely before cut: no change
      result.push(s);
    } else {
      // Overlaps cut: process by words if available, else remove
      if (s.words && s.words.length > 0) {
        const newSubs = processSubtitleWithWords(
          s,
          cutStartMs,
          cutEndMs,
          cutDurationMs,
          fps
        );
        result.push(...newSubs);
      } else {
        // No words: remove if overlaps (entire subtitle is in/overlaps cut)
        if (!subtitleOverlapsRange(s, cutStart, cutEnd)) {
          result.push(s);
        }
      }
    }
  }

  return result;
}

/**
 * Update deleted ranges after cutting [cutStart, cutEnd]: remove overlapping ranges,
 * shift ranges that start after cutEnd, and optionally add the new cut range.
 */
export function updateDeletedRangesAfterCut(
  ranges: DeletedRange[],
  cutStart: number,
  cutEnd: number,
  newRange?: DeletedRange
): DeletedRange[] {
  const duration = cutEnd - cutStart;
  let result = ranges.filter((r) => {
    // Remove ranges that overlap the cut (redundant)
    const overlaps = r.startFrame < cutEnd && r.endFrame > cutStart;
    return !overlaps;
  });
  if (newRange) result = [...result, newRange];
  return result.map((r) => {
    if (r.startFrame >= cutEnd) {
      return {
        ...r,
        startFrame: r.startFrame - duration,
        endFrame: r.endFrame - duration,
      };
    }
    return r;
  });
}
