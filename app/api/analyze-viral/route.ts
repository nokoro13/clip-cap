import { NextRequest, NextResponse } from 'next/server';
import { analyzeViralFromInput } from '@/lib/analyze-viral';
import { getFileForWhisper } from '@/lib/extract-audio';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** SSRF protection: only allow URLs from our S3 upload bucket (virtual-hosted or path style) */
function isAllowedVideoUrl(url: string): boolean {
  const bucket = process.env.AWS_S3_UPLOAD_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const virtualHosted = parsed.hostname === `${bucket}.s3.${region}.amazonaws.com`;
    const pathStyle =
      parsed.hostname === `s3.${region}.amazonaws.com` &&
      parsed.pathname.startsWith(`/${bucket}/`);
    return (virtualHosted || pathStyle) && parsed.pathname.includes('/uploads/');
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[analyze-viral] Request started');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const videoUrl = formData.get('videoUrl') as string | null;
    const audioUrl = formData.get('audioUrl') as string | null;
    const videoDuration = formData.get('duration') as string | null;
    const topicsRaw = formData.get('topics') as string | null;
    let topics: string[] = ['auto'];
    if (topicsRaw) {
      try {
        const parsed = JSON.parse(topicsRaw);
        topics = Array.isArray(parsed) ? parsed : ['auto'];
      } catch {
        topics = ['auto'];
      }
    }

    if (!file && !videoUrl && !audioUrl) {
      console.log('[analyze-viral] Rejected: no file, videoUrl, or audioUrl');
      return NextResponse.json(
        { error: 'No file, video URL, or audio URL provided' },
        { status: 400 }
      );
    }

    let fileForAnalysis: File | null = null;
    let cleanup = () => {};

    if (file) {
      console.log('[analyze-viral] Processing uploaded file:', file.name, file.size, 'bytes');
      const result = await getFileForWhisper(file);
      fileForAnalysis = result.file;
      cleanup = result.cleanup;
    } else if (videoUrl) {
      if (!isAllowedVideoUrl(videoUrl)) {
        console.log('[analyze-viral] Rejected: videoUrl not from allowed S3 bucket');
        return NextResponse.json(
          { error: 'Invalid video URL' },
          { status: 400 }
        );
      }
      console.log('[analyze-viral] Fetching video from S3:', videoUrl);
      const fetchStart = Date.now();
      const response = await fetch(videoUrl);
      if (!response.ok) {
        console.error('[analyze-viral] S3 fetch failed:', response.status);
        throw new Error(`Failed to fetch video from S3: ${response.status}`);
      }
      const blob = await response.blob();
      const contentType =
        response.headers.get('content-type')?.split(';')[0]?.trim() ||
        blob.type ||
        'video/mp4';
      const ext = contentType.includes('quicktime') ? 'mov' : 'mp4';
      fileForAnalysis = new File([blob], `video.${ext}`, { type: contentType });
      console.log(
        '[analyze-viral] Downloaded video from S3:',
        blob.size,
        'bytes in',
        Date.now() - fetchStart,
        'ms'
      );
      const result = await getFileForWhisper(fileForAnalysis);
      fileForAnalysis = result.file;
      cleanup = result.cleanup;
    }

    if (!fileForAnalysis) {
      return NextResponse.json(
        { error: 'Could not prepare file for analysis' },
        { status: 400 }
      );
    }

    try {
      console.log('[analyze-viral] Starting viral analysis');
      const { captions, segmentCaptions, clips, duration, fullTranscript } =
        await analyzeViralFromInput({
          file: fileForAnalysis,
          audioUrl: null,
          videoDuration,
          topics,
        });

      console.log(
        '[analyze-viral] Completed:',
        clips?.length ?? 0,
        'clips, duration',
        duration,
        's, total',
        Date.now() - startTime,
        'ms'
      );

      return NextResponse.json({
        success: true,
        captions,
        segmentCaptions,
        clips,
        duration,
        fullTranscript,
      });
    } finally {
      cleanup();
    }
  } catch (error) {
    console.error('[analyze-viral] Error after', Date.now() - startTime, 'ms:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to analyze video for viral moments' },
      { status: 500 }
    );
  }
}
