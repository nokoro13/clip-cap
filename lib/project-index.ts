const INDEX_KEY_PREFIX = 'clipcap-projects-';
const MAX_PROJECTS = 20;

export type ProjectIndexEntry = {
  id: string;
  title: string;
  createdAt: number;
  type: 'editor' | 'project';
  duration?: number;
  clipsCount?: number;
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
