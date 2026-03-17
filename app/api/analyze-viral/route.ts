import { NextRequest, NextResponse } from 'next/server';
import { analyzeViralFromInput } from '@/lib/analyze-viral';
import { getFileForWhisper } from '@/lib/extract-audio';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
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

    if (!file && !audioUrl) {
      return NextResponse.json(
        { error: 'No file or audio URL provided' },
        { status: 400 }
      );
    }

    let fileForAnalysis = file;
    let cleanup = () => {};
    if (file) {
      const result = await getFileForWhisper(file);
      fileForAnalysis = result.file;
      cleanup = result.cleanup;
    }

    try {
      const { captions, segmentCaptions, clips, duration, fullTranscript } =
        await analyzeViralFromInput({
          file: fileForAnalysis,
          audioUrl,
          videoDuration,
          topics,
        });

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
    console.error('Viral analysis error:', error);

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
