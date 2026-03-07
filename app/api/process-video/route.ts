import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { youtubeUrl, videoUrl, projectId } = body;

    if (!youtubeUrl && !videoUrl) {
      return NextResponse.json(
        { error: 'No video source provided' },
        { status: 400 }
      );
    }

    const id = projectId || `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // If YouTube URL, first get the video info
    if (youtubeUrl) {
      // Get video info from our youtube-info endpoint
      const infoResponse = await fetch(new URL('/api/youtube-info', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      if (!infoResponse.ok) {
        const error = await infoResponse.json();
        return NextResponse.json(
          { error: error.error || 'Failed to get YouTube video info' },
          { status: infoResponse.status }
        );
      }

      const { video } = await infoResponse.json();

      // Create form data for viral analysis
      const formData = new FormData();
      if (video.audioUrl) {
        formData.append('audioUrl', video.audioUrl);
        formData.append('duration', video.duration.toString());
      }

      // Analyze for viral moments
      const analyzeResponse = await fetch(new URL('/api/analyze-viral', request.url), {
        method: 'POST',
        body: formData,
      });

      if (!analyzeResponse.ok) {
        const error = await analyzeResponse.json();
        return NextResponse.json(
          { error: error.error || 'Failed to analyze video' },
          { status: analyzeResponse.status }
        );
      }

      const analysis = await analyzeResponse.json();

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
          clips: analysis.clips,
          fullTranscript: analysis.fullTranscript,
          status: 'completed',
          createdAt: Date.now(),
        },
      });
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
