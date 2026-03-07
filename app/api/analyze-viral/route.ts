import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { openAiWhisperApiToCaptions } from '@remotion/openai-whisper';
import type { Caption } from '@remotion/captions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'nodejs';
export const maxDuration = 120;

const VIRAL_DETECTION_PROMPT = `You are an expert at identifying viral short-form video content. Analyze the following video transcript and identify the most engaging, shareable, and viral-worthy moments that would work well as TikTok, YouTube Shorts, or Instagram Reels clips.

For each viral moment, provide:
1. Start timestamp (in seconds)
2. End timestamp (in seconds) - clips should be 15-60 seconds for optimal engagement
3. A catchy title that would grab attention
4. Virality score (1-100) based on entertainment value, emotional impact, and shareability
5. Brief reason why this would be viral

Focus on:
- Surprising revelations or plot twists
- Emotional moments (funny, inspiring, shocking)
- Valuable insights or "aha" moments
- Controversial or debate-worthy statements
- Relatable content
- Strong hooks at the beginning

Return your response as a JSON array with the following structure:
[
  {
    "startSeconds": number,
    "endSeconds": number,
    "title": "string",
    "viralityScore": number,
    "reason": "string"
  }
]

Only return the JSON array, no other text.`;

function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function extractTranscriptSegment(
  captions: Caption[],
  startMs: number,
  endMs: number
): string {
  return captions
    .filter((c) => c.startMs >= startMs && c.endMs <= endMs)
    .map((c) => c.text)
    .join(' ')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const audioUrl = formData.get('audioUrl') as string | null;
    const videoDuration = formData.get('duration') as string | null;

    let captions: Caption[] = [];
    let duration = 0;

    let segmentCaptions: Array<{
      startMs: number;
      endMs: number;
      text: string;
      words: Array<{ text: string; startMs: number; endMs: number }>;
    }> = [];

    if (file) {
      // Transcribe uploaded file with both word and segment timestamps
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      });

      const result = openAiWhisperApiToCaptions({ transcription });
      captions = result.captions;
      duration = transcription.duration || 0;

      // Extract segments with word timings
      const segments = (transcription as { segments?: Array<{ start: number; end: number; text: string }> }).segments || [];
      segmentCaptions = segments.map((segment) => {
        const segmentWords = captions.filter(
          (word) => word.startMs >= segment.start * 1000 && word.endMs <= segment.end * 1000 + 100
        );
        return {
          startMs: segment.start * 1000,
          endMs: segment.end * 1000,
          text: segment.text.trim(),
          words: segmentWords.map((w) => ({ text: w.text, startMs: w.startMs, endMs: w.endMs })),
        };
      });
    } else if (audioUrl) {
      // Fetch audio from URL and transcribe
      const response = await fetch(audioUrl);
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch audio from URL' },
          { status: 400 }
        );
      }

      const blob = await response.blob();
      const audioFile = new File([blob], 'audio.mp3', { type: 'audio/mpeg' });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      });

      const result = openAiWhisperApiToCaptions({ transcription });
      captions = result.captions;
      duration = transcription.duration || (videoDuration ? parseInt(videoDuration, 10) : 0);

      // Extract segments with word timings
      const segments = (transcription as { segments?: Array<{ start: number; end: number; text: string }> }).segments || [];
      segmentCaptions = segments.map((segment) => {
        const segmentWords = captions.filter(
          (word) => word.startMs >= segment.start * 1000 && word.endMs <= segment.end * 1000 + 100
        );
        return {
          startMs: segment.start * 1000,
          endMs: segment.end * 1000,
          text: segment.text.trim(),
          words: segmentWords.map((w) => ({ text: w.text, startMs: w.startMs, endMs: w.endMs })),
        };
      });
    } else {
      return NextResponse.json(
        { error: 'No file or audio URL provided' },
        { status: 400 }
      );
    }

    // Build transcript with timestamps for GPT-4
    const transcriptWithTimestamps = captions
      .map((c) => `[${formatSeconds(c.startMs / 1000)}] ${c.text}`)
      .join('\n');

    const userPrompt = `Video Duration: ${formatSeconds(duration)} (${duration} seconds)

Transcript:
${transcriptWithTimestamps}

Find the top 5-10 most viral moments from this content.`;

    // Analyze with GPT-4
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: VIRAL_DETECTION_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = gptResponse.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI analysis' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Could not parse viral moments from response' },
        { status: 500 }
      );
    }

    const moments: Array<{
      startSeconds: number;
      endSeconds: number;
      title: string;
      viralityScore: number;
      reason: string;
    }> = JSON.parse(jsonMatch[0]);

    // Convert to clip format with transcripts
    const clips = moments.map((moment, index) => ({
      id: `clip-${Date.now()}-${index}`,
      title: moment.title,
      startMs: moment.startSeconds * 1000,
      endMs: moment.endSeconds * 1000,
      viralityScore: moment.viralityScore,
      reason: moment.reason,
      transcript: extractTranscriptSegment(
        captions,
        moment.startSeconds * 1000,
        moment.endSeconds * 1000
      ),
    }));

    return NextResponse.json({
      success: true,
      captions,
      segmentCaptions,
      clips,
      duration,
      fullTranscript: captions.map((c) => c.text).join(' ').trim(),
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
