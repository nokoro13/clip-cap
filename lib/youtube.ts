import { parseYouTubeUrl } from './video-utils';
import { getYouTubeInfoFromYtDlp } from './yt-dlp';

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

function toStandardUrl(url: string): string | null {
  const videoId = parseYouTubeUrl(url);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

/**
 * Get video information from YouTube URL (via yt-dlp)
 */
export async function getYouTubeVideoInfo(
  url: string
): Promise<YouTubeVideoInfo> {
  const standardUrl = toStandardUrl(url);
  if (!standardUrl) {
    throw new Error('Invalid YouTube URL');
  }
  const info = await getYouTubeInfoFromYtDlp(standardUrl);
  if (!info) {
    throw new Error('Unable to get video info from YouTube');
  }
  return {
    id: info.id,
    title: info.title,
    description: info.description,
    duration: info.duration,
    thumbnailUrl: info.thumbnailUrl,
    channelName: info.channelName,
    viewCount: info.viewCount,
    uploadDate: info.uploadDate,
  };
}

/**
 * Get the best audio stream URL from YouTube video (via yt-dlp)
 */
export async function getYouTubeAudioUrl(url: string): Promise<string> {
  const standardUrl = toStandardUrl(url);
  if (!standardUrl) {
    throw new Error('Invalid YouTube URL');
  }
  const info = await getYouTubeInfoFromYtDlp(standardUrl);
  if (!info || !info.audioUrl) {
    throw new Error('No audio stream found for this video');
  }
  return info.audioUrl;
}

/**
 * Get the best video stream URL for preview/playback (via yt-dlp)
 */
export async function getYouTubeVideoUrl(url: string): Promise<string> {
  const standardUrl = toStandardUrl(url);
  if (!standardUrl) {
    throw new Error('Invalid YouTube URL');
  }
  const info = await getYouTubeInfoFromYtDlp(standardUrl);
  if (!info || !info.videoUrl) {
    throw new Error('No suitable video format found');
  }
  return info.videoUrl;
}

/**
 * Validate if a YouTube URL is accessible (via yt-dlp)
 */
export async function validateYouTubeUrl(url: string): Promise<boolean> {
  const standardUrl = toStandardUrl(url);
  if (!standardUrl) return false;
  const info = await getYouTubeInfoFromYtDlp(standardUrl);
  return info !== null;
}
