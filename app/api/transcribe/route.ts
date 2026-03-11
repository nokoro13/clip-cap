import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { openAiWhisperApiToCaptions } from '@remotion/openai-whisper';

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      'Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.'
    );
  }
  return new OpenAI({ apiKey: key });
}

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file size (25MB limit for Whisper API)
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB.' },
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

    // Transcribe using OpenAI Whisper with both word and segment timestamps
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    // Convert to Remotion Caption format (word-level for highlighting)
    const { captions: wordCaptions } = openAiWhisperApiToCaptions({ transcription });

    // Extract segments from the transcription
    const segments = (transcription as { segments?: Array<{ start: number; end: number; text: string }> }).segments || [];
    
    // Create segment-level captions with word timing info embedded
    const segmentCaptions = segments.map((segment, segIndex) => {
      // Find words that belong to this segment
      const segmentWords = wordCaptions.filter(
        (word) => word.startMs >= segment.start * 1000 && word.endMs <= segment.end * 1000 + 100
      );
      
      return {
        startMs: segment.start * 1000,
        endMs: segment.end * 1000,
        text: segment.text.trim(),
        words: segmentWords.map((w) => ({
          text: w.text,
          startMs: w.startMs,
          endMs: w.endMs,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      captions: wordCaptions, // Word-level captions (original behavior)
      segmentCaptions, // Segment captions with embedded word timings
      duration: transcription.duration || 0,
      language: transcription.language || 'en',
      text: transcription.text,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    
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
