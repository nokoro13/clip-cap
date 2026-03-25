import { openAiWhisperApiToCaptions } from '@remotion/openai-whisper';
import type { Caption } from '@remotion/captions';
import { openai } from '@/lib/openai';
import { getFileForWhisper } from '@/lib/extract-audio';
import {
  transcribeWhisperVerboseWithChunking,
  whisperDurationToSeconds,
} from '@/lib/whisper-chunked';

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
DIALOG AND CONTENT DENSITY REQUIREMENTS
═══════════════════════════════════════════════════════════════

Every clip MUST contain substantial spoken content:
- MINIMUM 12 words of actual dialog in the segment
- REJECT clips that are primarily silence, music, or ambient sound
- REJECT clips where people are not actively speaking for most of the duration
- Calculate: word count ÷ duration in seconds should be ≥ 1.0 words/second minimum

Before selecting a clip, verify:
1. Does this segment have continuous, meaningful dialog?
2. Is the speaking density sufficient (not just occasional words)?
3. Would this clip work without visuals (podcast test)?

NEVER select segments with sparse dialog, long pauses, or mostly non-speech.

═══════════════════════════════════════════════════════════════
Topic Selection and Preferences
═══════════════════════════════════════════════════════════════

When user specifies topics (e.g., educational, controversial, funny, wealth, inspirational, story):
- 1st topic = highest priority
- 2nd topic = medium priority  
- 3rd topic = lower priority but still relevant
- Find clips matching these preferences, but don't force weak matches

When "auto" is selected:
MANDATORY DISTRIBUTION for 8+ clips:
- MINIMUM 2 clips from at least 3 different topic categories
- Scan entire video for strongest moments in: funny, educational, controversial, story, inspirational, wealth
- Ranking algorithm: Within each topic, rank by virality score; select top moments across topics
- If a topic category has weak content (<60 virality), substitute with next strongest category
- Aim for 8-12 clips total using this distribution

Example distribution for 8 clips: 2 funny, 2 educational, 2 story, 1 controversial, 1 inspirational
Example distribution for 10 clips: 2 funny, 2 educational, 2 story, 2 controversial, 1 inspirational, 1 wealth

Available topic categories:
- "educational": Teaching, explaining, informative content
- "controversial": Provocative takes, debates, polarizing opinions
- "funny": Humor, comedy, entertaining moments
- "wealth": Money, success, luxury, business insights
- "inspirational": Motivational, uplifting, personal growth
- "story": Narratives, anecdotes, personal experiences, interesting tales

═══════════════════════════════════════════════════════════════
TITLE AND DESCRIPTION GENERATION PROCESS
═══════════════════════════════════════════════════════════════

For each clip, follow this exact process:
Step 1: Note the exact startSeconds and endSeconds for the clip
Step 2: Extract ONLY the transcript words that fall within that time range
Step 3: Read those specific words carefully
Step 4: Write title summarizing ONLY what you just read in Step 3
Step 5: Write reason describing ONLY the content from Step 3

FORBIDDEN: Using content from outside the clip's time boundaries
FORBIDDEN: Generic titles like "Interesting Discussion" or "Great Moment"
REQUIRED: Specific references to what is actually said in the segment

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

Include clips with viralityScore >= 60. Prefer 65+ when possible, but include 60-64 to ensure you reach the minimum clip count. Only include 55-59 if absolutely needed to reach 8+ clips. Never include clips below 55.
Remember: Aim for AT LEAST 8 clips (10+ for videos over 10 minutes). Scan the entire transcript thoroughly—longer videos have many more viable moments.
No other text outside the JSON array.`;

/** If estimated input tokens exceed this, use overlapping transcript windows (avoids gpt-4o TPM / huge single requests). */
const VIRAL_SINGLE_CALL_MAX_INPUT_TOKENS_ESTIMATE = 18_000;

/** Also window if raw transcript is huge (char heuristic can underestimate vs. OpenAI tokenizer). */
const VIRAL_SINGLE_PASS_MAX_TRANSCRIPT_CHARS = 28_000;

const VIRAL_WINDOW_SECONDS = 600;
/** Step < window so max 90s clips always fit entirely in at least one window (600 - 480 = 120s overlap). */
const VIRAL_WINDOW_STEP_SECONDS = 480;
const VIRAL_WINDOW_CONTEXT_PAD_SECONDS = 45;
const VIRAL_WINDOW_MAX_CLIPS = 6;
const VIRAL_WINDOW_MAX_OUTPUT_TOKENS = 3500;

function roughInputTokenEstimate(text: string): number {
  return Math.ceil(text.length / 4);
}

type ViralMoment = {
  startSeconds: number;
  endSeconds: number;
  title: string;
  viralityScore: number;
  reason: string;
  topic?: string;
};

function buildTranscriptWithTimestamps(captions: Caption[]): string {
  return captions
    .map((c) => `[${formatSeconds(c.startMs / 1000)}] ${c.text}`)
    .join('\n');
}

/** Transcript lines for captions overlapping [sliceStartSec, sliceEndSec] (absolute timeline). */
function buildTranscriptSlice(
  captions: Caption[],
  sliceStartSec: number,
  sliceEndSec: number
): string {
  const fromMs = sliceStartSec * 1000;
  const toMs = sliceEndSec * 1000;
  const slice = captions.filter((c) => c.endMs > fromMs && c.startMs < toMs);
  return buildTranscriptWithTimestamps(slice);
}

function planAbsoluteWindows(durationSec: number): Array<{ strictStart: number; strictEnd: number }> {
  if (durationSec <= 0) return [{ strictStart: 0, strictEnd: 0 }];
  const windows: Array<{ strictStart: number; strictEnd: number }> = [];
  let ws = 0;
  while (ws < durationSec) {
    const strictEnd = Math.min(durationSec, ws + VIRAL_WINDOW_SECONDS);
    windows.push({ strictStart: ws, strictEnd });
    if (strictEnd >= durationSec) break;
    ws += VIRAL_WINDOW_STEP_SECONDS;
  }
  return windows;
}

function parseViralMomentsFromGptContent(content: string): ViralMoment[] {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Could not parse viral moments from response');
  }
  return JSON.parse(jsonMatch[0]) as ViralMoment[];
}

/** Drop clips the model placed outside the allowed absolute range (small tolerance for rounding). */
function clampMomentsToWindow(
  moments: ViralMoment[],
  strictStart: number,
  strictEnd: number
): ViralMoment[] {
  const tol = 2;
  return moments.filter(
    (m) =>
      Number.isFinite(m.startSeconds) &&
      Number.isFinite(m.endSeconds) &&
      m.endSeconds > m.startSeconds &&
      m.startSeconds >= strictStart - tol &&
      m.endSeconds <= strictEnd + tol
  );
}

/**
 * Remove near-duplicates from overlapping windows (keep higher viralityScore).
 */
function dedupeViralMoments(moments: ViralMoment[]): ViralMoment[] {
  const sorted = [...moments].sort((a, b) => b.viralityScore - a.viralityScore);
  const kept: ViralMoment[] = [];
  for (const m of sorted) {
    const mLen = m.endSeconds - m.startSeconds;
    if (mLen <= 0) continue;
    const isDup = kept.some((k) => {
      const kLen = k.endSeconds - k.startSeconds;
      if (kLen <= 0) return false;
      const i0 = Math.max(m.startSeconds, k.startSeconds);
      const i1 = Math.min(m.endSeconds, k.endSeconds);
      const inter = Math.max(0, i1 - i0);
      const minLen = Math.min(mLen, kLen);
      return minLen > 0 && inter / minLen > 0.55;
    });
    if (!isDup) kept.push(m);
  }
  return kept;
}

async function fetchViralMomentsSinglePass(userPrompt: string): Promise<ViralMoment[]> {
  const gptResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VIRAL_DETECTION_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 8000,
  });
  const content = gptResponse.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI analysis');
  }
  return parseViralMomentsFromGptContent(content);
}

async function fetchViralMomentsWindowed(
  captions: Caption[],
  duration: number,
  topicInstruction: string
): Promise<ViralMoment[]> {
  const windows = planAbsoluteWindows(duration);
  const all: ViralMoment[] = [];

  console.log(
    `[analyze-viral] Windowed gpt-4o: ${windows.length} window(s) for ${Math.round(duration)}s video`
  );

  for (let i = 0; i < windows.length; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 400));
    }
    const { strictStart, strictEnd } = windows[i];
    const pad = VIRAL_WINDOW_CONTEXT_PAD_SECONDS;
    const sliceStart = Math.max(0, strictStart - pad);
    const sliceEnd = Math.min(duration, strictEnd + pad);
    const excerpt = buildTranscriptSlice(captions, sliceStart, sliceEnd);

    const userPrompt = `WINDOW ${i + 1} of ${windows.length} (long video — other windows cover the rest).

Full video duration: ${formatSeconds(duration)} (${duration} seconds).
This window's allowed clip range: startSeconds and endSeconds must BOTH fall between ${strictStart} and ${strictEnd} (absolute seconds from the start of the video). Each clip must lie entirely inside this range.

OVERRIDE for this request only: Return up to ${VIRAL_WINDOW_MAX_CLIPS} clips (score 60+) found in this range. Do not aim for 8+ clips here — another pass merges windows.

Transcript excerpt (timestamps are absolute, same timeline as the full video):
${excerpt}
${topicInstruction}

Find the strongest viral moments in this time range only. Use absolute startSeconds/endSeconds. Follow setup/payoff and dialog-density rules from the system message.`;

    const est = roughInputTokenEstimate(VIRAL_DETECTION_PROMPT + userPrompt);
    if (est > 28_000) {
      console.warn(
        `[analyze-viral] Window ${i + 1}/${windows.length} still large (~${est} est. input tokens); TPM risk`
      );
    }

    try {
      const gptResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: VIRAL_DETECTION_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: VIRAL_WINDOW_MAX_OUTPUT_TOKENS,
      });
      const content = gptResponse.choices[0]?.message?.content;
      if (!content) continue;
      const parsed = parseViralMomentsFromGptContent(content);
      all.push(...clampMomentsToWindow(parsed, strictStart, strictEnd));
    } catch (e) {
      console.warn(
        `[analyze-viral] Window ${i + 1}/${windows.length} failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  if (all.length === 0) {
    throw new Error('No viral moments returned from any transcript window');
  }

  return dedupeViralMoments(all);
}

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
  endMs: number,
  bufferMs = 0
): string {
  const from = startMs - bufferMs;
  const to = endMs + bufferMs;
  return captions
    .filter((c) => c.endMs > from && c.startMs < to)
    .map((c) => c.text)
    .join(' ')
    .trim();
}

const MIN_WORDS_PER_CLIP = 12;
const MIN_WORDS_PER_SECOND = 1.0;
const TIMESTAMP_BUFFER_MS = 500;

const TITLE_CORRECTION_PROMPT = `You are a precise editor. For each clip, you will receive the exact transcript (what was actually said). Your job is to generate an accurate title and description that match the transcript EXACTLY.

Rules:
- Title: Concise (under 80 chars), specific to what is said in the transcript
- Description (reason): 1-2 sentences summarizing the actual content
- Use ONLY information from the transcript—no assumptions or content from elsewhere
- Be specific: reference key phrases, topics, or moments from the transcript

Return a JSON array with one object per clip: [{"title": "...", "reason": "..."}]
Same order as input. No other text.`;

/** Uses the actual transcript to correct any title/description mismatches. */
async function correctClipTitlesAndDescriptions(
  clips: Array<{ id: string; title: string; startMs: number; endMs: number; viralityScore: number; reason: string; transcript: string; topic?: string }>
): Promise<typeof clips> {
  if (clips.length === 0) return clips;

  const transcriptList = clips
    .map((c, i) => `Clip ${i + 1} transcript: "${c.transcript}"`)
    .join('\n\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: TITLE_CORRECTION_PROMPT },
        {
          role: 'user',
          content: `Generate accurate title and reason for each clip based ONLY on its transcript:\n\n${transcriptList}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return clips;

    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return clips;

    const corrections: Array<{ title: string; reason: string }> = JSON.parse(match[0]);
    if (!Array.isArray(corrections) || corrections.length !== clips.length) return clips;

    return clips.map((clip, i) => {
      const corr = corrections[i];
      if (corr?.title && corr?.reason) {
        return { ...clip, title: corr.title.trim(), reason: corr.reason.trim() };
      }
      return clip;
    });
  } catch {
    return clips;
  }
}

/** Returns true if the clip has sufficient dialog density. */
function hasSufficientDialog(
  transcript: string,
  durationSec: number
): boolean {
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_WORDS_PER_CLIP) return false;
  if (durationSec > 0 && wordCount / durationSec < MIN_WORDS_PER_SECOND) return false;
  return true;
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
    topic?: string;
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
      const transcription = await transcribeWhisperVerboseWithChunking(fileForWhisper);

      const segments = transcription.segments || [];

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

      duration = whisperDurationToSeconds(transcription.duration);

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

    const transcription = await transcribeWhisperVerboseWithChunking(audioFile);

    const segments = transcription.segments || [];

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
      whisperDurationToSeconds(transcription.duration) ||
      (videoDuration ? parseInt(videoDuration, 10) : 0);

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

  const transcriptWithTimestamps = buildTranscriptWithTimestamps(captions);

  const totalWords = captions.map((c) => c.text).join(' ').split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = duration > 0 ? Math.round((totalWords / duration) * 60) : 0;

  const topicInstruction =
    topics && topics.length > 0 && topics[0] !== 'auto'
      ? `\nTopic preferences (priority order, #1 most important): ${topics.map((t: string, i: number) => `#${i + 1} ${t}`).join(', ')}. Prioritize clips matching these topics; if a topic has no strong moments, favor other selected topics.`
      : '';

  const targetClips = duration >= 600 ? '10-15' : 'at least 8';
  const singlePassUserPrompt = `Video Duration: ${formatSeconds(duration)} (${duration} seconds)
Transcript summary: ${totalWords} total words (~${wordsPerMinute} words/min). Each clip MUST have at least 12 words and ≥1.0 words/second—avoid segments with sparse dialog.

Transcript:
${transcriptWithTimestamps}
${topicInstruction}

Find ${targetClips} viral moments from this content. Include clips scoring 60 or higher. For each clip: start when the topic begins, end ONLY when the topic is finished. If people are still talking about the subject, do NOT end the clip—extend it until they've moved on or concluded. Never cut mid-topic. Assign each clip a topic (educational, controversial, funny, wealth, inspirational, or story).

CRITICAL for title and reason: Follow the TITLE AND DESCRIPTION GENERATION PROCESS. Read ONLY the transcript words within each clip's time range. The title and reason must accurately summarize what is actually said in that segment. Do not use titles or descriptions from other parts of the video.`;

  const singleCallInputEstimate =
    roughInputTokenEstimate(VIRAL_DETECTION_PROMPT) +
    roughInputTokenEstimate(singlePassUserPrompt);

  const useWindowed =
    singleCallInputEstimate > VIRAL_SINGLE_CALL_MAX_INPUT_TOKENS_ESTIMATE ||
    transcriptWithTimestamps.length > VIRAL_SINGLE_PASS_MAX_TRANSCRIPT_CHARS;

  const moments: ViralMoment[] = useWindowed
    ? await fetchViralMomentsWindowed(captions, duration, topicInstruction)
    : await fetchViralMomentsSinglePass(singlePassUserPrompt);

  const MIN_CLIP_SECONDS = 10;
  const MAX_CLIP_SECONDS = 90;
  const TARGET_MIN_CLIPS = duration >= 600 ? 10 : 8;

  const scoreThresholds = [60, 55] as const;

  let filteredMoments: typeof moments = [];
  for (const minScore of scoreThresholds) {
    filteredMoments = moments
      .filter((m) => m.viralityScore >= minScore)
      .filter((m) => {
        const durationSec = m.endSeconds - m.startSeconds;
        return durationSec >= MIN_CLIP_SECONDS && durationSec <= MAX_CLIP_SECONDS;
      });

    const withTranscript = filteredMoments.map((m) => ({
      moment: m,
      transcript: extractTranscriptSegment(
        captions,
        m.startSeconds * 1000,
        m.endSeconds * 1000,
        TIMESTAMP_BUFFER_MS,
      ),
      durationSec: m.endSeconds - m.startSeconds,
    }));

    const validMoments = withTranscript.filter(({ transcript, durationSec }) =>
      hasSufficientDialog(transcript, durationSec)
    );

    const rejected = withTranscript.filter(
      ({ transcript, durationSec }) => !hasSufficientDialog(transcript, durationSec)
    );
    if (rejected.length > 0) {
      console.warn(
        `[analyze-viral] Rejected ${rejected.length} clip(s) for insufficient dialog:`,
        rejected.map((r) => ({
          start: r.moment.startSeconds,
          end: r.moment.endSeconds,
          wordCount: r.transcript.split(/\s+/).filter(Boolean).length,
          durationSec: r.durationSec,
        }))
      );
    }

    filteredMoments = validMoments.map(({ moment }) => moment);

    if (filteredMoments.length >= TARGET_MIN_CLIPS) break;
    if (minScore === scoreThresholds[scoreThresholds.length - 1]) {
      console.warn(
        `[analyze-viral] Only ${filteredMoments.length} clips met requirements (target: ${TARGET_MIN_CLIPS})`
      );
    }
  }

  let clips = filteredMoments.map((moment, index) => ({
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

  const correctedClips = await correctClipTitlesAndDescriptions(clips);
  clips = correctedClips.map((c) => ({ ...c, topic: c.topic ?? undefined }));

  return {
    captions,
    segmentCaptions,
    clips,
    duration,
    fullTranscript: captions.map((c) => c.text).join(' ').trim(),
  };
}

