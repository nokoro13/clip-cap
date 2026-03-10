import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseYouTubeUrl } from './video-utils';

const execFileAsync = promisify(execFile);

type YtDlpFormat = {
  url?: string;
  height?: number;
  acodec?: string;
  vcodec?: string;
  abr?: number;
  tbr?: number;
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

export type YouTubeVideoInfo = {
  id: string;
  title: string;
  description: string;
  duration: number;
  thumbnailUrl: string;
  channelName: string;
  viewCount: number;
  uploadDate: string;
};

async function getYtDlpInfo(url: string): Promise<YtDlpInfo> {
  const { stdout } = await execFileAsync('yt-dlp', [
    '-J',
    '--no-warnings',
    '--no-call-home',
    '--no-playlist',
    url,
  ], {
    maxBuffer: 1024 * 1024 * 10,
  });

  return JSON.parse(stdout) as YtDlpInfo;
}

/**
 * Get video information from YouTube URL
 */
export async function getYouTubeVideoInfo(url: string): Promise<YouTubeVideoInfo> {
  const videoId = parseYouTubeUrl(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  const info = await getYtDlpInfo(url);

  return {
    id: videoId,
    title: info.title,
    description: info.description || '',
    duration: info.duration ?? 0,
    thumbnailUrl:
      info.thumbnail ??
      (info.thumbnails && info.thumbnails.length > 0
        ? info.thumbnails[info.thumbnails.length - 1]?.url
        : undefined) ??
      '',
    channelName: info.uploader || info.channel || '',
    viewCount: info.view_count ?? 0,
    uploadDate: info.upload_date ?? '',
  };
}

/**
 * Get the best audio stream URL from YouTube video
 * This can be used to extract audio for transcription
 */
export async function getYouTubeAudioUrl(url: string): Promise<string> {
  const info = await getYtDlpInfo(url);
  const formats = info.formats ?? [];

  const audioFormats = formats.filter(
    (f) =>
      f.url &&
      f.acodec &&
      f.acodec !== 'none' &&
      (!f.vcodec || f.vcodec === 'none')
  );
  if (audioFormats.length === 0) {
    throw new Error('No audio stream found for this video');
  }

  // Sort by audio quality and get the best one
  const sortedFormats = audioFormats.sort((a, b) => {
    const aBitrate = a.abr ?? a.tbr ?? 0;
    const bBitrate = b.abr ?? b.tbr ?? 0;
    return bBitrate - aBitrate;
  });

  const bestAudio = sortedFormats[0];
  if (!bestAudio.url) {
    throw new Error('Could not get audio URL');
  }

  return bestAudio.url;
}

/**
 * Get the best video stream URL (for preview/playback)
 */
export async function getYouTubeVideoUrl(url: string): Promise<string> {
  const info = await getYtDlpInfo(url);
  const formats = (info.formats ?? []).filter(
    (f) =>
      f.url &&
      f.vcodec &&
      f.vcodec !== 'none' &&
      f.acodec &&
      f.acodec !== 'none'
  );

  if (formats.length === 0) {
    // Fallback to any format with video
    const videoFormats = (info.formats ?? []).filter(
      (f) => f.url && f.vcodec && f.vcodec !== 'none'
    );
    if (videoFormats.length > 0 && videoFormats[0].url) {
      return videoFormats[0].url;
    }
    throw new Error('No suitable video format found');
  }

  // Sort by quality (prefer 720p or lower for faster loading)
  const sortedFormats = formats.sort((a, b) => {
    const aHeight = a.height || 0;
    const bHeight = b.height || 0;
    // Prefer 720p
    const aScore = Math.abs(aHeight - 720);
    const bScore = Math.abs(bHeight - 720);
    return aScore - bScore;
  });

  const bestFormat = sortedFormats[0];
  if (!bestFormat.url) {
    throw new Error('Could not get video URL');
  }

  return bestFormat.url;
}

/**
 * Validate if a YouTube URL is accessible and get basic info
 */
export async function validateYouTubeUrl(url: string): Promise<boolean> {
  try {
    const videoId = parseYouTubeUrl(url);
    if (!videoId) return false;

    await getYtDlpInfo(url);
    return true;
  } catch {
    return false;
  }
}
