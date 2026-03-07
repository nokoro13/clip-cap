import OpenAI from 'openai';
import type { Caption } from '@remotion/captions';
import type { ViralClip } from './video-utils';
import { generateId } from './video-utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type ViralMoment = {
  startMs: number;
  endMs: number;
  title: string;
  viralityScore: number;
  reason: string;
  transcript: string;
};

const VIRAL_DETECTION_PROMPT = `You are an expert at identifying viral short-form video content. Analyze the following video transcript and identify the most engaging, shareable, and viral-worthy moments that would work well as TikTok, YouTube Shorts, or Instagram Reels clips.

For each viral moment, provide:
1. Start timestamp (in seconds)
2. End timestamp (in seconds) - clips should be 15-60 seconds for optimal engagement
3. A catchy title that would grab attention
4. Virality score (1-100) based on entertainment value, emotional impact, and shareability
5. Brief reason why this would be viral
6. The exact transcript segment

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
    "reason": "string",
    "transcript": "string"
  }
]

Only return the JSON array, no other text.`;

/**
 * Analyze transcript to find viral moments using GPT-4
 */
export async function detectViralMoments(
  captions: Caption[],
  videoDuration: number
): Promise<ViralClip[]> {
  // Build transcript with timestamps
  const transcriptWithTimestamps = captions
    .map((c) => `[${formatSeconds(c.startMs / 1000)}] ${c.text}`)
    .join('\n');

  const userPrompt = `Video Duration: ${formatSeconds(videoDuration)} (${videoDuration} seconds)

Transcript:
${transcriptWithTimestamps}

Find the top 5-10 most viral moments from this content.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: VIRAL_DETECTION_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4');
    }

    // Parse the JSON response
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
      transcript: string;
    }> = JSON.parse(jsonMatch[0]);

    // Convert to ViralClip format
    return moments.map((moment) => ({
      id: generateId(),
      title: moment.title,
      startMs: moment.startSeconds * 1000,
      endMs: moment.endSeconds * 1000,
      viralityScore: moment.viralityScore,
      transcript: moment.transcript,
    }));
  } catch (error) {
    console.error('Error detecting viral moments:', error);
    throw new Error('Failed to analyze video for viral moments');
  }
}

/**
 * Format seconds to MM:SS
 */
function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Extract transcript segment for a time range
 */
export function extractTranscriptSegment(
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
