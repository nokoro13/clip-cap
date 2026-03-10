import { NextRequest, NextResponse } from 'next/server';
import { analyzeViralFromInput } from '@/lib/analyze-viral';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const audioUrl = formData.get('audioUrl') as string | null;
    const videoDuration = formData.get('duration') as string | null;

    if (!file && !audioUrl) {
      return NextResponse.json(
        { error: 'No file or audio URL provided' },
        { status: 400 }
      );
    }

    const { captions, segmentCaptions, clips, duration, fullTranscript } =
      await analyzeViralFromInput({ file, audioUrl, videoDuration });

    return NextResponse.json({
      success: true,
      captions,
      segmentCaptions,
      clips,
      duration,
      fullTranscript,
    });
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
