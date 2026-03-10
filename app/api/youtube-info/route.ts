import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeInfoFromYtDlp } from '@/lib/yt-dlp';
import { parseYouTubeUrl } from '@/lib/video-utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    const standardUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const video = await getYouTubeInfoFromYtDlp(standardUrl);

    if (!video) {
      console.error('YouTube info: yt-dlp returned no video for', standardUrl);
      return NextResponse.json(
        {
          error:
            'Unable to extract video from YouTube. This video may have restrictions or be unavailable. Try a different video or upload a file directly.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      video,
    });
  } catch (error) {
    console.error('YouTube info error:', error);
    return NextResponse.json(
      {
        error:
          'Failed to get YouTube video info. Try uploading a video file directly.',
      },
      { status: 500 }
    );
  }
}
