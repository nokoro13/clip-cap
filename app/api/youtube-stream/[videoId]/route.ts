import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeInfoFromYtDlp } from '@/lib/yt-dlp';

export const runtime = 'nodejs';
export const maxDuration = 60;

const STREAM_URL_CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes (YouTube URLs expire)
const streamUrlCache = new Map<
  string,
  { url: string; expiresAt: number }
>();

function getCachedStreamUrl(videoId: string): string | null {
  const entry = streamUrlCache.get(videoId);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.url;
}

function setCachedStreamUrl(videoId: string, url: string): void {
  streamUrlCache.set(videoId, {
    url,
    expiresAt: Date.now() + STREAM_URL_CACHE_TTL_MS,
  });
}

/**
 * Proxies YouTube video stream so the browser can play it (same-origin).
 * Direct yt-dlp stream URLs are blocked in the browser by CORS/referrer.
 * Supports Range requests for video seeking. Caches stream URL to avoid
 * calling yt-dlp on every Range request (which would be slow and can timeout).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await context.params;
  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  let streamUrl = getCachedStreamUrl(videoId);
  if (!streamUrl) {
    const standardUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await getYouTubeInfoFromYtDlp(standardUrl);
    if (!info?.videoUrl) {
      return NextResponse.json(
        { error: 'Could not get stream URL for this video' },
        { status: 502 }
      );
    }
    streamUrl = info.videoUrl;
    setCachedStreamUrl(videoId, streamUrl);
  }

  const range = request.headers.get('range');
  const headers: Record<string, string> = {};
  if (range) headers['Range'] = range;

  const streamRes = await fetch(streamUrl, {
    headers,
    redirect: 'follow',
  });

  if (!streamRes.ok) {
    return NextResponse.json(
      { error: 'Upstream stream failed' },
      { status: 502 }
    );
  }

  const contentType =
    streamRes.headers.get('content-type') || 'video/mp4';
  const contentLength = streamRes.headers.get('content-length');
  const contentRange = streamRes.headers.get('content-range');
  const acceptRanges = streamRes.headers.get('accept-ranges') || 'bytes';

  const resHeaders: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': acceptRanges,
    'Cache-Control': 'private, no-cache',
  };
  if (contentLength) resHeaders['Content-Length'] = contentLength;
  if (contentRange) resHeaders['Content-Range'] = contentRange;

  return new NextResponse(streamRes.body, {
    status: streamRes.status,
    headers: resHeaders,
  });
}
