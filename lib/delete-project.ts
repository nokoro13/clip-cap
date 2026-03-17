/**
 * Delete a project: call API (handles DB + S3), then clean up client storage.
 * For gallery delete flow, use DELETE /api/projects/:id directly and clean up locally.
 * This helper is for programmatic delete (e.g. from editor or other callers).
 */

import { notifyProjectIndexUpdate } from '@/lib/project-index';

/**
 * Delete video blob from IndexedDB. Exported for use when deleting via API.
 */
export async function deleteVideoBlob(projectId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const DB_NAME = 'clipcap-videos';
    const STORE_NAME = 'videos';
    const DB_VERSION = 1;

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(projectId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error('Error deleting video blob:', err);
  }
}

/**
 * Delete a project completely. Calls API (handles DB + S3), then cleans up client storage.
 */
export async function deleteProject(experienceId: string, projectId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || 'Failed to delete project');
    }
  } catch (err) {
    throw err;
  }

  localStorage.removeItem(`project-${projectId}`);
  sessionStorage.removeItem(`video-${projectId}`);
  await deleteVideoBlob(projectId);
  notifyProjectIndexUpdate();
}
