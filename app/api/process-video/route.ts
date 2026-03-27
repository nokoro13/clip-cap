import fs from 'node:fs';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { analyzeViralFromInput } from '@/lib/analyze-viral';
import { downloadYouTubeAudioToFile } from '@/lib/download-youtube-audio';
import { getYouTubeInfoFromYtDlp } from '@/lib/yt-dlp';
import { parseYouTubeUrl } from '@/lib/video-utils';
import { whopsdk } from '@/lib/whop-sdk';
import { canUpload, incrementUsage } from '@/lib/user-service';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { youtubeUrl, videoUrl, projectId, topics: topicsFromBody } = body;
    const topics = Array.isArray(topicsFromBody) ? topicsFromBody : ['auto'];

    if (!youtubeUrl && !videoUrl) {
      return NextResponse.json(
        { error: 'No video source provided' },
        { status: 400 }
      );
    }

    const id = projectId || `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // If YouTube URL, get video info directly (no internal fetch — avoids SSL issues on Railway)
    if (youtubeUrl) {
      const { userId } = await whopsdk.verifyUserToken(await headers());
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const gate = await canUpload(userId, 'bulk');
      if (!gate.allowed) {
        return NextResponse.json(
          {
            error: gate.reason ?? 'Upload limit reached',
            requiresUpgrade: gate.requiresUpgrade ?? false,
          },
          { status: 403 }
        );
      }

      const videoId = parseYouTubeUrl(youtubeUrl);
      if (!videoId) {
        return NextResponse.json(
          { error: 'Invalid YouTube URL' },
          { status: 400 }
        );
      }

      const standardUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const video = await getYouTubeInfoFromYtDlp(standardUrl);

      if (!video) {
        console.error('Process video: yt-dlp returned no video for', standardUrl);
        return NextResponse.json(
          {
            error:
              'Unable to extract video from YouTube. This video may have restrictions or be unavailable. Try a different video or upload a file directly.',
          },
          { status: 422 }
        );
      }

      // Download audio with yt-dlp to a temp file (avoids long streaming fetch that can drop)
      const { filePath, cleanup } = await downloadYouTubeAudioToFile(standardUrl);
      try {
        const buffer = fs.readFileSync(filePath);
        const audioFile = new File([buffer], 'audio.mp3', { type: 'audio/mpeg' });

        const analysis = await analyzeViralFromInput({
          file: audioFile,
          videoDuration: video.duration?.toString(),
          topics,
        });

        await incrementUsage(userId, 'bulk');

        return NextResponse.json({
          success: true,
          project: {
            id,
            title: video.title,
            videoUrl: video.videoUrl,
            audioUrl: video.audioUrl,
            thumbnailUrl: video.thumbnailUrl,
            duration: video.duration,
            channelName: video.channelName,
            captions: analysis.captions,
            segmentCaptions: analysis.segmentCaptions,
            clips: analysis.clips,
            fullTranscript: analysis.fullTranscript,
            status: 'completed',
            createdAt: Date.now(),
            youtubeVideoId: video.id,
          },
        });
      } finally {
        cleanup();
      }
    }

    // For direct video URL, return a simpler response
    // The client would need to handle file upload separately
    return NextResponse.json({
      success: true,
      project: {
        id,
        videoUrl,
        status: 'pending',
        createdAt: Date.now(),
      },
    });
  } catch (error) {
    console.error('Process video error:', error);

    if (error instanceof Error && error.message?.includes('verifyUserToken')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process video' },
      { status: 500 }
    );
  }
}
