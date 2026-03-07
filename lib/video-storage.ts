const DB_NAME = 'clipcap-videos';
const STORE_NAME = 'videos';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Not in browser'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Store a video blob so it survives page refresh. Call this when creating a project.
 */
export async function saveVideoBlob(projectId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({ id: projectId, blob, savedAt: Date.now() });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

/**
 * Get a blob URL for a stored video, or null if not found. Use this when sessionStorage
 * no longer has the URL (e.g. after refresh).
 */
export async function getVideoBlobUrl(projectId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(projectId);
      request.onerror = () => {
        db.close();
        resolve(null);
      };
      request.onsuccess = () => {
        db.close();
        const row = request.result as { blob: Blob } | undefined;
        if (!row?.blob) {
          resolve(null);
          return;
        }
        const url = URL.createObjectURL(row.blob);
        resolve(url);
      };
    });
  } catch {
    return null;
  }
}
