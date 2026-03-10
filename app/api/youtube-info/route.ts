import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const runtime = 'nodejs';
export const maxDuration = 60;

const execFileAsync = promisify(execFile);

type YtDlpFormat = {
  url?: string;
  height?: number;
  acodec?: string;
  vcodec?: string;
  abr?: number;
  tbr?: number;
  format_id?: string;
  quality?: string;
};

type YtDlpInfo = {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  view_count?: number;
  upload_date?: string;
  uploader?: string;
  channel?: string;
  thumbnails?: { url: string }[];
  thumbnail?: string;
  formats?: YtDlpFormat[];
};

function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

async function getYtDlpInfo(url: string): Promise<YtDlpInfo> {
  const { stdout } = await execFileAsync('yt-dlp', [
    '-J',
    '--no-warnings',
    '--no-call-home',
    '--no-playlist',
    url,
  ], {
    maxBuffer: 1024 * 1024 * 10, // 10MB buffer for large JSON
  });

  return JSON.parse(stdout) as YtDlpInfo;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'No URL provided' },
        { status: 400 }
      );
    }

    const videoId = parseYouTubeUrl(url);
    if (!videoId) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
    }

    // Use yt-dlp CLI to get detailed information and formats
    const info = await getYtDlpInfo(`https://www.youtube.com/watch?v=${videoId}`);

    const formats = info.formats ?? [];

    // Try multiple strategies to find a playable format
    let videoUrl = '';
    let audioUrl = '';

    // Strategy 1: Look for formats with both video and audio
    const combinedFormats = formats.filter(
      (f) =>
        f.url &&
        f.vcodec &&
        f.vcodec !== 'none' &&
        f.acodec &&
        f.acodec !== 'none'
    );

    if (combinedFormats.length > 0) {
      // Prefer around 720p (or nearest)
      const sortedFormats = combinedFormats.sort((a, b) => {
        const aHeight = a.height ?? 0;
        const bHeight = b.height ?? 0;
        const aScore = Math.abs(aHeight - 720);
        const bScore = Math.abs(bHeight - 720);
        return aScore - bScore;
      });
      videoUrl = sortedFormats[0]?.url ?? '';
    }

    // Strategy 2: If no combined format, try video-only
    if (!videoUrl) {
      const videoOnlyFormats = formats.filter(
        (f) =>
          f.url &&
          f.vcodec &&
          f.vcodec !== 'none' &&
          (!f.acodec || f.acodec === 'none')
      );
      if (videoOnlyFormats.length > 0) {
        const sortedVideo = videoOnlyFormats.sort((a, b) => {
          const aHeight = a.height ?? 0;
          const bHeight = b.height ?? 0;
          return bHeight - aHeight; // Prefer higher quality
        });
        videoUrl = sortedVideo[0]?.url ?? '';
      }
    }

    // Strategy 3: Get audio-only format for transcription
    const audioFormats = formats.filter(
      (f) =>
        f.url &&
        f.acodec &&
        f.acodec !== 'none' &&
        (!f.vcodec || f.vcodec === 'none')
    );

    if (audioFormats.length > 0) {
      const sortedAudio = audioFormats.sort((a, b) => {
        const aBitrate = a.abr ?? a.tbr ?? 0;
        const bBitrate = b.abr ?? b.tbr ?? 0;
        return bBitrate - aBitrate;
      });
      audioUrl = sortedAudio[0]?.url ?? '';
    }

    // Fallback: If still no audio URL, use the combined format
    if (!audioUrl && videoUrl) {
      audioUrl = videoUrl;
    }

    // If we still don't have any URL, throw an error with helpful message
    if (!videoUrl && !audioUrl) {
      console.error('Available formats:', formats.map(f => ({
        format_id: f.format_id,
        hasVideo: f.vcodec && f.vcodec !== 'none',
        hasAudio: f.acodec && f.acodec !== 'none',
        height: f.height,
        abr: f.abr,
        tbr: f.tbr,
        hasUrl: !!f.url,
      })));
      
      return NextResponse.json(
        { 
          error: 'Unable to extract video from YouTube. This video may have restrictions or the YouTube API has changed. Try a different video or upload a file directly.',
        },
        { status: 422 }
      );
    }

    const durationSeconds = info.duration ?? 0;
    const thumbnailUrl =
      info.thumbnail ??
      (info.thumbnails && info.thumbnails.length > 0
        ? info.thumbnails[info.thumbnails.length - 1]?.url
        : '');

    return NextResponse.json({
      success: true,
      video: {
        id: videoId,
        title: info.title,
        description: info.description ?? '',
        duration: durationSeconds,
        thumbnailUrl: thumbnailUrl || '',
        channelName: info.uploader || info.channel || '',
        viewCount: info.view_count ?? 0,
        uploadDate: info.upload_date ?? '',
        videoUrl,
        audioUrl,
      },
    });
  } catch (error) {
    console.error('YouTube info error:', error);

    if (error instanceof Error) {
      const message = error.message || '';

      // Map common yt-dlp errors to user-friendly messages
      if (message.includes('This video is private') || message.includes('private video')) {
        return NextResponse.json(
          { error: 'This video is unavailable or private' },
          { status: 404 }
        );
      }
      if (
        message.includes('Sign in to confirm your age') ||
        message.toLowerCase().includes('age-restricted')
      ) {
        return NextResponse.json(
          { error: 'This video is age-restricted and cannot be processed' },
          { status: 403 }
        );
      }
      if (
        message.toLowerCase().includes('unable to download video data') ||
        message.toLowerCase().includes('no such format') ||
        message.toLowerCase().includes('requested format')
      ) {
        return NextResponse.json(
          { error: 'Unable to extract video. YouTube may have blocked this request. Try uploading a video file directly instead.' },
          { status: 422 }
        );
      }
      if (message.includes('HTTP Error 429') || message.includes('Too Many Requests')) {
        return NextResponse.json(
          { error: 'Too many requests to YouTube. Please wait a moment and try again.' },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get YouTube video info. Try uploading a video file directly.' },
      { status: 500 }
    );
  }
}
