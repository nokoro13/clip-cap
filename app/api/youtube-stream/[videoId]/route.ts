import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeInfoFromYtDlp } from '@/lib/yt-dlp';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Proxies YouTube video stream so the browser can play it (same-origin).
 * Direct yt-dlp stream URLs are blocked in the browser by CORS/referrer.
 * Supports Range requests for video seeking.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await context.params;
  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  const standardUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const info = await getYouTubeInfoFromYtDlp(standardUrl);
  if (!info?.videoUrl) {
    return NextResponse.json(
      { error: 'Could not get stream URL for this video' },
      { status: 502 }
    );
  }

  const range = request.headers.get('range');
  const headers: Record<string, string> = {};
  if (range) headers['Range'] = range;

  const streamRes = await fetch(info.videoUrl, {
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
