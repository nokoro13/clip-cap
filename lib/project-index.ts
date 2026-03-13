const INDEX_KEY_PREFIX = 'clipcap-projects-';
const MAX_PROJECTS = 20;

export type ProjectIndexEntry = {
  id: string;
  title: string;
  createdAt: number;
  type: 'editor' | 'project';
  duration?: number;
  clipsCount?: number;
  /** When processing, card shows loading state */
  status?: 'processing' | 'completed' | 'error';
  /** 0-100, for progress bar during processing */
  progress?: number;
};

function getIndexKey(experienceId: string): string {
  return `${INDEX_KEY_PREFIX}${experienceId}`;
}

export function getProjectIndex(experienceId: string): ProjectIndexEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getIndexKey(experienceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectIndexEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setProjectIndex(experienceId: string, entries: ProjectIndexEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getIndexKey(experienceId), JSON.stringify(entries));
  } catch {
    // ignore quota or other errors
  }
}

export function addProjectToIndex(
  experienceId: string,
  summary: Omit<ProjectIndexEntry, 'createdAt'> & { createdAt?: number }
): void {
  const entries = getProjectIndex(experienceId);
  const entry: ProjectIndexEntry = {
    ...summary,
    createdAt: summary.createdAt ?? Date.now(),
  };
  const next = [entry, ...entries.filter((e) => e.id !== entry.id)].slice(0, MAX_PROJECTS);
  setProjectIndex(experienceId, next);
}

export function updateProjectInIndex(
  experienceId: string,
  projectId: string,
  updates: Partial<Pick<ProjectIndexEntry, 'status' | 'progress' | 'title' | 'duration' | 'clipsCount'>>
): void {
  const entries = getProjectIndex(experienceId);
  const next = entries.map((e) =>
    e.id === projectId ? { ...e, ...updates } : e
  );
  setProjectIndex(experienceId, next);
}

/** Dispatch this event to notify galleries to refresh (e.g. after updating a processing project) */
export const PROJECT_INDEX_UPDATE_EVENT = 'clipcap-project-index-update';

export function notifyProjectIndexUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROJECT_INDEX_UPDATE_EVENT));
  }
}
