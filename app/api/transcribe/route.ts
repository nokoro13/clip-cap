import { NextRequest, NextResponse } from 'next/server';
import { openAiWhisperApiToCaptions } from '@remotion/openai-whisper';
import { openai } from '@/lib/openai';
import { getFileForWhisper } from '@/lib/extract-audio';

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
      // Transcribe using OpenAI Whisper with both word and segment timestamps
      const transcription = await openai.audio.transcriptions.create({
        file: fileForWhisper,
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
    } finally {
      cleanup();
    }
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
