/**
 * Client-side: get presigned URL from our API, upload file directly to S3,
 * return the read URL for use in Remotion Player and rendering.
 *
 * Matches Remotion's recommended flow: https://remotion.dev/docs/video-uploads
 * and https://remotion.dev/docs/presigned-urls
 */

export type UploadProgress = {
  progress: number;
  loadedBytes: number;
  totalBytes: number;
};

export type UploadToS3Options = {
  file: File;
  onProgress?: (options: UploadProgress) => void;
};

/**
 * Upload a Blob to S3 via presigned URL. Returns the permanent read URL.
 * Use when you have a Blob (e.g. from blob URL) that Lambda cannot fetch.
 */
export async function uploadBlobToS3(blob: Blob): Promise<string> {
  const contentType = blob.type || 'video/mp4';
  const size = blob.size;

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, size }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Upload failed: ${res.status}`);
  }

  const { presignedUrl, readUrl } = (await res.json()) as {
    presignedUrl: string;
    readUrl: string;
  };

  const putRes = await fetch(presignedUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });
  if (!putRes.ok) {
    throw new Error(`S3 upload failed: ${putRes.status}`);
  }

  return readUrl;
}

/**
 * Upload a video file via presigned URL. Returns the permanent read URL.
 * Use this URL in inputProps.videoUrl for Remotion Player and renderMedia().
 */
export async function uploadVideoToS3({
  file,
  onProgress,
}: UploadToS3Options): Promise<string> {
  const contentType = file.type || 'video/mp4';
  const size = file.size;

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, size }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Upload failed: ${res.status}`);
  }

  const { presignedUrl, readUrl } = (await res.json()) as {
    presignedUrl: string;
    readUrl: string;
  };

  if (onProgress) {
    await uploadWithProgress({
      file,
      url: presignedUrl,
      onProgress,
    });
  } else {
    const putRes = await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType },
    });
    if (!putRes.ok) {
      throw new Error(`S3 upload failed: ${putRes.status}`);
    }
  }

  return readUrl;
}

/**
 * Upload with progress (XHR) as in Remotion presigned-urls docs.
 */
function uploadWithProgress({
  file,
  url,
  onProgress,
}: {
  file: File;
  url: string;
  onProgress: (options: UploadProgress) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', url);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress({
          progress: event.loaded / event.total,
          loadedBytes: event.loaded,
          totalBytes: event.total,
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.send(file);
  });
}
