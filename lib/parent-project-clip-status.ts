import { saveProjectToApi } from '@/lib/project-api';

type StoredClip = { id: string; status?: string };

/**
 * Sets a clip's `status` to `exported` in the parent viral project's `clips` array
 * (localStorage + API) so the gallery "Exported" tab updates.
 */
export function markClipExportedInParent(
  parentProjectId: string,
  clipEditorProjectId: string
): void {
  if (typeof window === 'undefined' || !parentProjectId || !clipEditorProjectId) {
    return;
  }
  const raw = localStorage.getItem(`project-${parentProjectId}`);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const clips = parsed.clips as StoredClip[] | undefined;
    if (!Array.isArray(clips)) return;

    let changed = false;
    const nextClips = clips.map((c) => {
      if (c.id !== clipEditorProjectId) return c;
      if (c.status === 'exported') return c;
      changed = true;
      return { ...c, status: 'exported' };
    });
    if (!changed) return;

    const updated = { ...parsed, clips: nextClips };
    localStorage.setItem(`project-${parentProjectId}`, JSON.stringify(updated));

    const expId =
      typeof parsed.experienceId === 'string' && parsed.experienceId.length > 0
        ? parsed.experienceId
        : undefined;
    if (!expId) return;

    void saveProjectToApi(expId, {
      id: parentProjectId,
      experienceId: expId,
      title: typeof parsed.title === 'string' ? parsed.title : 'Untitled',
      type: 'project',
      status: 'completed',
      progress: 100,
      duration:
        typeof parsed.duration === 'number' && Number.isFinite(parsed.duration)
          ? parsed.duration
          : undefined,
      clipsCount: nextClips.length,
      videoUrl:
        typeof parsed.videoUrl === 'string' && !parsed.videoUrl.startsWith('blob:')
          ? parsed.videoUrl
          : undefined,
      captions: parsed.captions,
      segmentCaptions: parsed.segmentCaptions,
      clips: nextClips,
      fullTranscript:
        typeof parsed.fullTranscript === 'string' ? parsed.fullTranscript : undefined,
      youtubeVideoId:
        typeof parsed.youtubeVideoId === 'string' ? parsed.youtubeVideoId : undefined,
    });
  } catch {
    // ignore corrupt storage
  }
}

/** Resolve parent id from the clip editor's saved project JSON. */
export function markClipExportedFromEditorLocalProject(
  clipEditorProjectId: string
): void {
  if (typeof window === 'undefined' || !clipEditorProjectId) return;
  const raw = localStorage.getItem(`project-${clipEditorProjectId}`);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as {
      sourceProjectId?: string;
      parentProjectId?: string;
    };
    const parentId =
      (typeof parsed.sourceProjectId === 'string' &&
      parsed.sourceProjectId.length > 0)
        ? parsed.sourceProjectId
        : typeof parsed.parentProjectId === 'string' &&
            parsed.parentProjectId.length > 0
          ? parsed.parentProjectId
          : undefined;
    if (parentId) {
      markClipExportedInParent(parentId, clipEditorProjectId);
    }
  } catch {
    // ignore
  }
}

/** Prefer API `parentProjectId`; otherwise read from clip project in localStorage. */
export function markClipExportedAfterExport(
  clipEditorProjectId: string,
  apiParentId?: string | null
): void {
  if (typeof apiParentId === 'string' && apiParentId.length > 0) {
    markClipExportedInParent(apiParentId, clipEditorProjectId);
    return;
  }
  markClipExportedFromEditorLocalProject(clipEditorProjectId);
}
