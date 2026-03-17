import { openAiWhisperApiToCaptions } from '@remotion/openai-whisper';
import type { Caption } from '@remotion/captions';
import { openai } from '@/lib/openai';
import { getFileForWhisper } from '@/lib/extract-audio';

const VIRAL_DETECTION_PROMPT = `You are an expert at identifying viral short-form video content. Analyze the video transcript and identify the most engaging, shareable, and viral-worthy moments that would work well as TikTok, YouTube Shorts, or Instagram Reels clips.

CRITICAL REQUIREMENT: You MUST find at least 8 viable clips from the video. Do not settle for fewer clips unless the video is genuinely too short or lacks content.

═══════════════════════════════════════════════════════════════
GOLDEN RULE: COMPLETE TOPICS WITH SETUP AND PAYOFF
═══════════════════════════════════════════════════════════════

Every clip MUST be a complete, self-contained unit with:
- SETUP: The beginning/introduction of the topic
- CONTENT: The main discussion or action
- PAYOFF: The conclusion, punchline, reveal, or resolution

NEVER create clips that leave the viewer hanging. If someone says "look at what I did," the clip MUST show what they did. If someone starts a story, the clip MUST include the ending. If there's a question posed, the clip MUST include the answer.

═══════════════════════════════════════════════════════════════
WHEN TO START AND WHEN TO END (Most Important Rule)
═══════════════════════════════════════════════════════════════

START: The moment the topic/segment begins:
- First word of a story or anecdote
- First move of a demonstration
- When the conversation shifts to a new subject
- When someone poses a question or introduces something interesting

END: ONLY when the topic is COMPLETELY FINISHED:
- The story has concluded
- The demonstration is complete and result shown
- The conversation has moved on to a different subject
- The question has been answered
- The payoff/punchline/reveal has been delivered

Before setting endSeconds, ask yourself:
1. "Has the topic been fully resolved?"
2. "Is there still discussion about this same subject?"
3. "Would a viewer feel satisfied, or would they wonder what happened next?"

If the answer to #2 is YES or #3 is "wonder what happened next" → EXTEND THE END TIME.

═══════════════════════════════════════════════════════════════
Examples of WRONG Clip Boundaries (NEVER DO THIS)
═══════════════════════════════════════════════════════════════

❌ Someone says "let me tell you about my crazy experience" → clip ends before the experience is described
❌ A magic trick begins → clip ends before the reveal
❌ "The craziest thing happened to me yesterday" → clip ends without saying what happened
❌ A conversation about dating → clip ends mid-conversation while still discussing dating
❌ "You won't believe what I found" → clip ends before showing what they found
❌ A tutorial starts → clip ends before showing the result
❌ Someone asks a provocative question → clip ends before the answer

═══════════════════════════════════════════════════════════════
Examples of CORRECT Clip Boundaries
═══════════════════════════════════════════════════════════════

✓ Story: Starts with setup ("So this happened to me..."), includes the full narrative, ends with conclusion
✓ Demonstration: Starts when they begin, shows entire process, ends with final result revealed
✓ Conversation: Starts when topic introduced, includes full discussion, ends when they move to next topic
✓ Joke/Punchline: Starts with setup, includes the full joke, ends after punchline lands
✓ Controversial take: Starts with the statement, includes explanation/reasoning, ends when point is made
✓ "Look what I did": Starts with the introduction, MUST include showing what they did, ends after reveal

═══════════════════════════════════════════════════════════════
Clip Requirements
═══════════════════════════════════════════════════════════════

- LENGTH: Minimum 10 seconds, maximum ~120 seconds
- PRIORITY: Completeness ALWAYS trumps brevity. Never sacrifice context for length.
- QUANTITY: Aim for AT LEAST 8 clips. Thoroughly scan the entire transcript to find all viable moments.
- QUALITY: Each clip must be self-contained and satisfying to watch independently.

═══════════════════════════════════════════════════════════════
Topic Selection and Preferences
═══════════════════════════════════════════════════════════════

When user specifies topics (e.g., educational, controversial, funny, wealth, inspirational, story):
- 1st topic = highest priority
- 2nd topic = medium priority  
- 3rd topic = lower priority but still relevant
- Find clips matching these preferences, but don't force weak matches

When "auto" is selected:
- Use a balanced mix of ALL topic types: educational, controversial, funny, wealth, inspirational, story
- Bias toward topics that appear more frequently or prominently in the content
- Still prioritize virality and engagement over rigid topic distribution
- STILL aim for minimum 8 clips by drawing from whichever topics have the strongest moments

Available topic categories:
- "educational": Teaching, explaining, informative content
- "controversial": Provocative takes, debates, polarizing opinions
- "funny": Humor, comedy, entertaining moments
- "wealth": Money, success, luxury, business insights
- "inspirational": Motivational, uplifting, personal growth
- "story": Narratives, anecdotes, personal experiences, interesting tales

═══════════════════════════════════════════════════════════════
Output Format
═══════════════════════════════════════════════════════════════

For each viral moment, provide:

1. startSeconds: When the topic/segment BEGINS (first word, first mention, start of setup)
2. endSeconds: When the topic is COMPLETELY FINISHED (after payoff, resolution, or when speakers move on)
3. title: Concise summary of what ACTUALLY happens in THIS specific clip based ONLY on the transcript between startSeconds and endSeconds
4. viralityScore: 1-100 based on entertainment value, emotional impact, and shareability
5. reason: Brief description of the actual content - what is said, discussed, or happens in this specific segment
6. topic: One of: "educational", "controversial", "funny", "wealth", "inspirational", "story"

Return ONLY a JSON array with this structure:
[
  {
    "startSeconds": number,
    "endSeconds": number,
    "title": "string - what happens in THIS clip",
    "viralityScore": number,
    "reason": "string - actual content of this clip",
    "topic": "string"
  }
]

Only include clips with viralityScore >= 65.
Remember: Aim for AT LEAST 8 clips. Scan the entire transcript thoroughly.
No other text outside the JSON array.`;

function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Normalize Whisper output to fix parsing issues (e.g. excess whitespace, music/noise). */
function normalizeTranscriptionForRemotion<T extends { text?: string; words?: Array<{ word: string; start: number; end: number }> }>(
  transcription: T
): T {
  const normalized = { ...transcription };
  if (typeof normalized.text === 'string') {
    (normalized as { text: string }).text = normalized.text.replace(/\s+/g, ' ').trim();
  }
  if (Array.isArray(normalized.words)) {
    (normalized as { words: Array<{ word: string; start: number; end: number }> }).words =
      normalized.words.map((w) => ({ ...w, word: w.word.trim() }));
  }
  return normalized as T;
}

/** Build captions from segments when openAiWhisperApiToCaptions fails (e.g. music/noise). */
function buildCaptionsFromSegments(
  segments: Array<{ start: number; end: number; text: string }>
): Caption[] {
  const captions: Caption[] = [];
  for (const seg of segments) {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    const segDurationMs = (seg.end - seg.start) * 1000;
    const msPerWord = words.length > 0 ? segDurationMs / words.length : 0;
    words.forEach((text, i) => {
      const startMs = seg.start * 1000 + i * msPerWord;
      const endMs = seg.start * 1000 + (i + 1) * msPerWord;
      captions.push({
        text,
        startMs,
        endMs,
        timestampMs: (startMs + endMs) / 2,
        confidence: null,
      });
    });
  }
  return captions;
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
  topics?: string[] | null;
};

export async function analyzeViralFromInput(
  { file, audioUrl, videoDuration, topics }: AnalyzeInput,
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
    const { file: fileForWhisper, cleanup } = await getFileForWhisper(file);
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fileForWhisper,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      });

      const segments = (transcription as {
        segments?: Array<{ start: number; end: number; text: string }>;
      }).segments || [];

      try {
        const normalized = normalizeTranscriptionForRemotion(transcription);
        const result = openAiWhisperApiToCaptions({ transcription: normalized });
        captions = result.captions;
      } catch (parseError) {
        console.warn(
          'openAiWhisperApiToCaptions failed (e.g. music/noise), using segment fallback:',
          parseError instanceof Error ? parseError.message : parseError
        );
        captions = buildCaptionsFromSegments(segments);
      }

      duration = transcription.duration || 0;

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
            text: w.text.trim(),
            startMs: w.startMs,
            endMs: w.endMs,
          })),
        };
      });
    } finally {
      cleanup();
    }
  } else if (audioUrl) {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch audio from URL');
    }

    const blob = await response.blob();
    const audioFile = new File([blob], 'audio.mp3', { type: 'audio/mpeg' });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    const segments = (transcription as {
      segments?: Array<{ start: number; end: number; text: string }>;
    }).segments || [];

    try {
      const normalized = normalizeTranscriptionForRemotion(transcription);
      const result = openAiWhisperApiToCaptions({ transcription: normalized });
      captions = result.captions;
    } catch (parseError) {
      console.warn(
        'openAiWhisperApiToCaptions failed (e.g. music/noise), using segment fallback:',
        parseError instanceof Error ? parseError.message : parseError
      );
      captions = buildCaptionsFromSegments(segments);
    }

    duration =
      transcription.duration || (videoDuration ? parseInt(videoDuration, 10) : 0);

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
          text: w.text.trim(),
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

  const topicInstruction =
    topics && topics.length > 0 && topics[0] !== 'auto'
      ? `\nTopic preferences (priority order, #1 most important): ${topics.map((t: string, i: number) => `#${i + 1} ${t}`).join(', ')}. Prioritize clips matching these topics; if a topic has no strong moments, favor other selected topics.`
      : '';

  const userPrompt = `Video Duration: ${formatSeconds(duration)} (${duration} seconds)

Transcript:
${transcriptWithTimestamps}
${topicInstruction}

Find up to 15-20 viral moments from this content. Only include clips that score 65 or higher. For each clip: start when the topic begins, end ONLY when the topic is finished. If people are still talking about the subject, do NOT end the clip—extend it until they've moved on or concluded. Never cut mid-topic. Assign each clip a topic (educational, controversial, funny, wealth, inspirational, or story).

CRITICAL for title and reason: Read the transcript text for each clip's time range. The title and reason must accurately summarize what is actually said in that segment. Do not use titles or descriptions from other parts of the video. If the clip is about X, the title and reason must describe X.`;

  const gptResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VIRAL_DETECTION_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 6000,
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
    topic?: string;
  }> = JSON.parse(jsonMatch[0]);

  const MIN_VIRALITY_SCORE = 65;
  const MIN_CLIP_SECONDS = 10;
  const MAX_CLIP_SECONDS = 90;

  const filteredMoments = moments
    .filter((m) => m.viralityScore >= MIN_VIRALITY_SCORE)
    .filter((m) => {
      const durationSec = m.endSeconds - m.startSeconds;
      return durationSec >= MIN_CLIP_SECONDS && durationSec <= MAX_CLIP_SECONDS;
    });

  const clips = filteredMoments.map((moment, index) => ({
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
    topic: moment.topic ?? undefined,
  }));

  return {
    captions,
    segmentCaptions,
    clips,
    duration,
    fullTranscript: captions.map((c) => c.text).join(' ').trim(),
  };
}

