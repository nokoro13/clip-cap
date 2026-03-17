import { notifyProjectIndexUpdate } from '@/lib/project-index';

export async function saveProjectToApi(
  experienceId: string,
  data: {
    id: string;
    experienceId: string;
    title: string;
    type: 'editor' | 'project';
    status: 'processing' | 'completed' | 'error';
    progress?: number;
    duration?: number;
    clipsCount?: number;
    videoUrl?: string;
    captions?: unknown;
    segmentCaptions?: unknown;
    clips?: unknown;
    fullTranscript?: string;
    youtubeVideoId?: string;
  }
): Promise<void> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to save project');
  }
  notifyProjectIndexUpdate();
}
