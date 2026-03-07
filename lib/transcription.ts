import OpenAI from 'openai';
import { openAiWhisperApiToCaptions } from '@remotion/openai-whisper';
import type { Caption } from '@remotion/captions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type TranscriptionResult = {
  captions: Caption[];
  duration: number;
  language: string;
};

/**
 * Transcribe audio/video file using OpenAI Whisper API
 * Returns word-level timestamps in Remotion Caption format
 */
export async function transcribeFile(file: File): Promise<TranscriptionResult> {
  const transcription = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
  });

  const { captions } = openAiWhisperApiToCaptions({ transcription });

  return {
    captions,
    duration: transcription.duration || 0,
    language: transcription.language || 'en',
  };
}

/**
 * Transcribe from a URL (downloads and processes)
 * Note: This is for server-side use only
 */
export async function transcribeFromUrl(url: string): Promise<TranscriptionResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio from URL: ${response.statusText}`);
  }

  const blob = await response.blob();
  const file = new File([blob], 'audio.mp3', { type: blob.type || 'audio/mpeg' });

  return transcribeFile(file);
}

/**
 * Get transcript text from captions
 */
export function getTranscriptText(captions: Caption[]): string {
  return captions.map((c) => c.text).join(' ').trim();
}
