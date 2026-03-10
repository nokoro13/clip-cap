import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** yt-dlp JSON format entry (subset we use) */
type YtDlpFormat = {
  url?: string;
  vcodec?: string;
  acodec?: string;
  height?: number;
  width?: number;
  audio_bitrate?: number;
};

/** yt-dlp -j output (subset we use) */
type YtDlpJson = {
  id?: string;
  title?: string;
  description?: string;
  duration?: number;
  thumbnail?: string;
  channel?: string;
  view_count?: number;
  upload_date?: string;
  formats?: YtDlpFormat[];
};

export type YouTubeInfoFromYtDlp = {
  id: string;
  title: string;
  description: string;
  duration: number;
  thumbnailUrl: string;
  channelName: string;
  viewCount: number;
  uploadDate: string;
  videoUrl: string;
  audioUrl: string;
};

/**
 * Fetch YouTube video metadata and stream URLs using yt-dlp.
 * Returns null if the video is unavailable or yt-dlp fails.
 */
export async function getYouTubeInfoFromYtDlp(
  standardUrl: string
): Promise<YouTubeInfoFromYtDlp | null> {
  try {
    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['-j', '--no-warnings', '--no-check-certificate', standardUrl],
      { timeout: 45_000, maxBuffer: 2 * 1024 * 1024 }
    );
    const data = JSON.parse(stdout) as YtDlpJson;
    const formats = data.formats?.filter((f) => f.url) ?? [];
    const id = data.id ?? '';
    const title = data.title ?? '';
    const description = data.description ?? '';
    const duration = data.duration ?? 0;
    const thumbnailUrl = data.thumbnail ?? '';
    const channelName = data.channel ?? '';
    const viewCount = data.view_count ?? 0;
    const uploadDate = data.upload_date ?? '';

    const combined = formats.filter(
      (f) =>
        f.vcodec &&
        f.vcodec !== 'none' &&
        f.acodec &&
        f.acodec !== 'none'
    );
    let videoUrl = '';
    let audioUrl = '';

    if (combined.length > 0) {
      const sorted = [...combined].sort((a, b) => {
        const aH = a.height ?? 0;
        const bH = b.height ?? 0;
        return Math.abs(aH - 720) - Math.abs(bH - 720);
      });
      videoUrl = sorted[0]?.url ?? '';
    }
    if (!videoUrl) {
      const videoOnly = formats.filter(
        (f) =>
          f.vcodec &&
          f.vcodec !== 'none' &&
          (f.height ?? 0) > 0
      );
      if (videoOnly.length > 0) {
        const best = videoOnly.sort(
          (a, b) => (b.height ?? 0) - (a.height ?? 0)
        )[0];
        videoUrl = best?.url ?? '';
      }
    }
    const audioOnly = formats.filter(
      (f) =>
        f.acodec &&
        f.acodec !== 'none' &&
        (!f.vcodec || f.vcodec === 'none')
    );
    if (audioOnly.length > 0) {
      const best = audioOnly.sort(
        (a, b) => (b.audio_bitrate ?? 0) - (a.audio_bitrate ?? 0)
      )[0];
      audioUrl = best?.url ?? '';
    }
    if (!audioUrl && videoUrl) audioUrl = videoUrl;

    if (!videoUrl && !audioUrl) return null;

    return {
      id,
      title,
      description,
      duration,
      thumbnailUrl,
      channelName,
      viewCount,
      uploadDate,
      videoUrl,
      audioUrl,
    };
  } catch (e) {
    console.error('yt-dlp error (binary may be missing or video unavailable):', e);
    return null;
  }
}
