import OpenAI from 'openai';
import { openAiWhisperApiToCaptions } from '@remotion/openai-whisper';
import type { Caption } from '@remotion/captions';

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      'Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.'
    );
  }
  return new OpenAI({ apiKey: key });
}

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

export type ViralAnalysisResult = {
  captions: Caption[];
  segmentCaptions: Array<{
    startMs: number;
    endMs: number;
    text: string;
    words: Array<{ text: string; startMs: number; endMs: number }>;
  }>;
  clips: Array<{
    id: string;
    title: string;
    startMs: number;
    endMs: number;
    viralityScore: number;
    reason: string;
    transcript: string;
  }>;
  duration: number;
  fullTranscript: string;
};

type AnalyzeInput = {
  file?: File | null;
  audioUrl?: string | null;
  videoDuration?: string | null;
};

export async function analyzeViralFromInput(
  { file, audioUrl, videoDuration }: AnalyzeInput,
): Promise<ViralAnalysisResult> {
  let captions: Caption[] = [];
  let duration = 0;

  let segmentCaptions: Array<{
    startMs: number;
    endMs: number;
    text: string;
    words: Array<{ text: string; startMs: number; endMs: number }>;
  }> = [];

  if (file) {
    const transcription = await getOpenAI().audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    const result = openAiWhisperApiToCaptions({ transcription });
    captions = result.captions;
    duration = transcription.duration || 0;

    const segments = (transcription as {
      segments?: Array<{ start: number; end: number; text: string }>;
    }).segments || [];

    segmentCaptions = segments.map((segment) => {
      const segmentWords = captions.filter(
        (word) =>
          word.startMs >= segment.start * 1000 &&
          word.endMs <= segment.end * 1000 + 100,
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
  } else if (audioUrl) {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch audio from URL');
    }

    const blob = await response.blob();
    const audioFile = new File([blob], 'audio.mp3', { type: 'audio/mpeg' });

    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    const result = openAiWhisperApiToCaptions({ transcription });
    captions = result.captions;
    duration =
      transcription.duration || (videoDuration ? parseInt(videoDuration, 10) : 0);

    const segments = (transcription as {
      segments?: Array<{ start: number; end: number; text: string }>;
    }).segments || [];

    segmentCaptions = segments.map((segment) => {
      const segmentWords = captions.filter(
        (word) =>
          word.startMs >= segment.start * 1000 &&
          word.endMs <= segment.end * 1000 + 100,
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
  } else {
    throw new Error('No file or audio URL provided');
  }

  const transcriptWithTimestamps = captions
    .map((c) => `[${formatSeconds(c.startMs / 1000)}] ${c.text}`)
    .join('\n');

  const userPrompt = `Video Duration: ${formatSeconds(duration)} (${duration} seconds)

Transcript:
${transcriptWithTimestamps}

Find the top 5-10 most viral moments from this content.`;

  const gptResponse = await getOpenAI().chat.completions.create({
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
    throw new Error('No response from AI analysis');
  }

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Could not parse viral moments from response');
  }

  const moments: Array<{
    startSeconds: number;
    endSeconds: number;
    title: string;
    viralityScore: number;
    reason: string;
  }> = JSON.parse(jsonMatch[0]);

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
      moment.endSeconds * 1000,
    ),
  }));

  return {
    captions,
    segmentCaptions,
    clips,
    duration,
    fullTranscript: captions.map((c) => c.text).join(' ').trim(),
  };
}

