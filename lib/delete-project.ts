/**
 * Delete a project: remove from localStorage, IndexedDB, and S3.
 */

import { removeProjectFromIndex, notifyProjectIndexUpdate } from '@/lib/project-index';

/**
 * Delete the S3 object for a project's videoUrl.
 */
async function deleteS3Video(videoUrl: string | null | undefined): Promise<void> {
  if (!videoUrl) return;
  
  // Only delete if it's an S3 URL from our bucket
  if (!videoUrl.includes('.s3.') && !videoUrl.includes('amazonaws.com')) {
    return;
  }

  try {
    // Extract the key from the S3 URL
    // e.g. https://bucket.s3.region.amazonaws.com/uploads/uuid → uploads/uuid
    const url = new URL(videoUrl);
    const key = url.pathname.slice(1); // remove leading /

    const res = await fetch('/api/upload/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });

    if (!res.ok) {
      console.error('Failed to delete S3 object:', await res.text());
    }
  } catch (err) {
    console.error('Error deleting S3 video:', err);
  }
}

/**
 * Delete video blob from IndexedDB.
 */
async function deleteVideoBlob(projectId: string): Promise<void> {
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
 * Delete a project completely.
 */
export async function deleteProject(experienceId: string, projectId: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // 1. Get project data to find S3 URL
  const projectKey = `project-${projectId}`;
  const stored = localStorage.getItem(projectKey);
  let videoUrl: string | null = null;
  if (stored) {
    try {
      const data = JSON.parse(stored);
      videoUrl = data.videoUrl || null;
    } catch {
      // ignore
    }
  }

  // 2. Delete from localStorage
  localStorage.removeItem(projectKey);
  sessionStorage.removeItem(`video-${projectId}`);

  // 3. Delete from IndexedDB
  await deleteVideoBlob(projectId);

  // 4. Delete from S3
  await deleteS3Video(videoUrl);

  // 5. Remove from project index
  removeProjectFromIndex(experienceId, projectId);
  notifyProjectIndexUpdate();
}
