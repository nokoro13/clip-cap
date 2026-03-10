import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

    // Use the standard YouTube URL format
    const standardUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Configure ytdl with options to help bypass restrictions
    const info = await ytdl.getInfo(standardUrl, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    });

    const videoDetails = info.videoDetails;

    // Try multiple strategies to find a playable format
    let videoUrl = '';
    let audioUrl = '';

    // Strategy 1: Look for formats with both video and audio (mp4)
    const combinedFormats = info.formats.filter(
      (f) => f.hasVideo && f.hasAudio && f.url
    );

    if (combinedFormats.length > 0) {
      // Prefer 720p or lower for better loading
      const sortedFormats = combinedFormats.sort((a, b) => {
        const aHeight = a.height || 0;
        const bHeight = b.height || 0;
        const aScore = Math.abs(aHeight - 720);
        const bScore = Math.abs(bHeight - 720);
        return aScore - bScore;
      });
      videoUrl = sortedFormats[0]?.url || '';
    }

    // Strategy 2: If no combined format, try video-only
    if (!videoUrl) {
      const videoOnlyFormats = info.formats.filter(
        (f) => f.hasVideo && f.url && f.qualityLabel
      );
      if (videoOnlyFormats.length > 0) {
        const sortedVideo = videoOnlyFormats.sort((a, b) => {
          const aHeight = a.height || 0;
          const bHeight = b.height || 0;
          return bHeight - aHeight; // Prefer higher quality
        });
        videoUrl = sortedVideo[0]?.url || '';
      }
    }

    // Strategy 3: Get audio format for transcription
    const audioFormats = info.formats.filter(
      (f) => f.hasAudio && !f.hasVideo && f.url
    );

    if (audioFormats.length > 0) {
      const sortedAudio = audioFormats.sort((a, b) => {
        const aBitrate = a.audioBitrate || 0;
        const bBitrate = b.audioBitrate || 0;
        return bBitrate - aBitrate;
      });
      audioUrl = sortedAudio[0]?.url || '';
    }

    // Fallback: If still no audio URL, use the combined format
    if (!audioUrl && videoUrl) {
      audioUrl = videoUrl;
    }

    // If we still don't have any URL, throw an error with helpful message
    if (!videoUrl && !audioUrl) {
      console.error('Available formats:', info.formats.map(f => ({
        itag: f.itag,
        hasVideo: f.hasVideo,
        hasAudio: f.hasAudio,
        container: f.container,
        qualityLabel: f.qualityLabel,
        hasUrl: !!f.url,
      })));
      
      return NextResponse.json(
        { 
          error: 'Unable to extract video from YouTube. This video may have restrictions or the YouTube API has changed. Try a different video or upload a file directly.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      video: {
        id: videoId,
        title: videoDetails.title,
        description: videoDetails.description || '',
        duration: parseInt(videoDetails.lengthSeconds, 10),
        thumbnailUrl: videoDetails.thumbnails[videoDetails.thumbnails.length - 1]?.url || '',
        channelName: videoDetails.author.name,
        viewCount: parseInt(videoDetails.viewCount, 10),
        uploadDate: videoDetails.uploadDate || '',
        videoUrl,
        audioUrl,
      },
    });
  } catch (error) {
    console.error('YouTube info error:', error);

    if (error instanceof Error) {
      // Handle specific ytdl errors
      if (error.message.includes('Video unavailable') || error.message.includes('private video')) {
        return NextResponse.json(
          { error: 'This video is unavailable or private' },
          { status: 404 }
        );
      }
      if (error.message.includes('age-restricted') || error.message.includes('Sign in to confirm your age')) {
        return NextResponse.json(
          { error: 'This video is age-restricted and cannot be processed' },
          { status: 403 }
        );
      }
      if (error.message.includes('playable') || error.message.includes('format')) {
        return NextResponse.json(
          { error: 'Unable to extract video. YouTube may have blocked this request. Try uploading a video file directly instead.' },
          { status: 422 }
        );
      }
      if (error.message.includes('Status code: 429')) {
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
