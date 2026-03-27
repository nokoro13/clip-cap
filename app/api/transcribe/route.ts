import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { openAiWhisperApiToCaptions } from '@remotion/openai-whisper';
import { getFileForWhisper } from '@/lib/extract-audio';
import {
  transcribeWhisperVerboseWithChunking,
  whisperDurationToSeconds,
} from '@/lib/whisper-chunked';
import { whopsdk } from '@/lib/whop-sdk';
import { canUpload, incrementUsage } from '@/lib/user-service';

export const runtime = 'nodejs';
/** Chunked Whisper for long audio can exceed 60s (several API calls). */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await whopsdk.verifyUserToken(await headers());
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gate = await canUpload(userId, 'subtitle');
    if (!gate.allowed) {
      return NextResponse.json(
        {
          error: gate.reason ?? 'Upload limit reached',
          requiresUpgrade: gate.requiresUpgrade ?? false,
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    const validTypes = [
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/mp4',
    ];

    if (!validTypes.some((type) => file.type.startsWith(type.split('/')[0]))) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a video or audio file.' },
        { status: 400 }
      );
    }

    // For large video files, extract audio first to stay under Whisper's 25MB limit
    const { file: fileForWhisper, cleanup } = await getFileForWhisper(file);
    try {
      const transcription = await transcribeWhisperVerboseWithChunking(fileForWhisper);

      // Convert to Remotion Caption format (word-level for highlighting)
      const { captions: wordCaptions } = openAiWhisperApiToCaptions({ transcription });

      // Extract segments from the transcription
      const segments =
        (transcription as { segments?: Array<{ start: number; end: number; text: string }> })
          .segments || [];

      // Create segment-level captions with word timing info embedded
      const segmentCaptions = segments.map((segment) => {
        // Find words that belong to this segment
        const segmentWords = wordCaptions.filter(
          (word) => word.startMs >= segment.start * 1000 && word.endMs <= segment.end * 1000 + 100
        );

        return {
          startMs: segment.start * 1000,
          endMs: segment.end * 1000,
          text: segment.text.trim(),
          words: segmentWords.map((w) => ({
            text: w.text.trim(),
            startMs: w.startMs,
            endMs: w.endMs,
          })),
        };
      });

      await incrementUsage(userId, 'subtitle');

      return NextResponse.json({
        success: true,
        captions: wordCaptions, // Word-level captions (original behavior)
        segmentCaptions, // Segment captions with embedded word timings
        duration: whisperDurationToSeconds(transcription.duration),
        language: transcription.language || 'en',
        text: transcription.text,
      });
    } finally {
      cleanup();
    }
  } catch (error) {
    console.error('Transcription error:', error);

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
      { error: 'Failed to transcribe file' },
      { status: 500 }
    );
  }
}
