import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { and, count, desc, eq } from 'drizzle-orm';
import { whopsdk } from '@/lib/whop-sdk';
import { db } from '@/lib/db';
import { subtitlePresets } from '@/lib/db/schema';
import {
  MAX_USER_SUBTITLE_PRESETS,
  previewFromSubtitleStyle,
  type SavedSubtitlePresetRecord,
} from '@/lib/user-subtitle-presets';
import type { SubtitleMode, SubtitleStyle } from '@/remotion/Composition';

async function getUserId(): Promise<string | null> {
  try {
    const { userId } = await whopsdk.verifyUserToken(await headers());
    return userId;
  } catch {
    return null;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function isValidStyle(s: unknown): s is SubtitleStyle {
  if (!isRecord(s)) return false;
  return typeof s.fontFamily === 'string' && typeof s.textColor === 'string';
}

const SUBTITLE_MODES: SubtitleMode[] = [
  'word',
  'segment',
  'segment-highlight',
  'segment-background-highlight',
];

function rowToRecord(
  row: typeof subtitlePresets.$inferSelect
): SavedSubtitlePresetRecord | null {
  const p = row.payload as unknown;
  if (!isRecord(p) || !isValidStyle(p.style)) return null;
  const preview = isRecord(p.preview) &&
    typeof p.preview.color === 'string' &&
    typeof p.preview.bg === 'string'
    ? {
        bg: p.preview.bg as string,
        color: p.preview.color as string,
        stroke:
          typeof p.preview.stroke === 'string' ? p.preview.stroke : undefined,
      }
    : previewFromSubtitleStyle(p.style);

  let subtitleMode: SubtitleMode | undefined;
  if (
    typeof p.subtitleMode === 'string' &&
    SUBTITLE_MODES.includes(p.subtitleMode as SubtitleMode)
  ) {
    subtitleMode = p.subtitleMode as SubtitleMode;
  }

  const maxWordsPerSegment =
    typeof p.maxWordsPerSegment === 'number' &&
    Number.isFinite(p.maxWordsPerSegment)
      ? p.maxWordsPerSegment
      : undefined;
  const highlightColor =
    typeof p.highlightColor === 'string' ? p.highlightColor : undefined;

  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
    preview,
    style: p.style,
    subtitleMode,
    maxWordsPerSegment,
    highlightColor,
  };
}

/** GET /api/subtitle-presets — list current user's presets */
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db
      .select()
      .from(subtitlePresets)
      .where(eq(subtitlePresets.userId, userId))
      .orderBy(desc(subtitlePresets.createdAt));

    const presets: SavedSubtitlePresetRecord[] = [];
    for (const row of rows) {
      const rec = rowToRecord(row);
      if (rec) presets.push(rec);
    }

    return NextResponse.json({ presets });
  } catch (e) {
    console.error('[subtitle-presets GET]', e);
    return NextResponse.json(
      { error: 'Failed to load presets' },
      { status: 500 }
    );
  }
}

/** POST /api/subtitle-presets — create preset */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isRecord(body) || !isValidStyle(body.style)) {
    return NextResponse.json(
      { error: 'Invalid body: style required' },
      { status: 400 }
    );
  }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 48) : '';
  if (!name) {
    return NextResponse.json(
      { error: 'Name is required' },
      { status: 400 }
    );
  }

  const style = body.style;
  const preview =
    isRecord(body.preview) &&
    typeof body.preview.color === 'string' &&
    typeof body.preview.bg === 'string'
      ? {
          bg: body.preview.bg as string,
          color: body.preview.color as string,
          stroke:
            typeof body.preview.stroke === 'string'
              ? body.preview.stroke
              : undefined,
        }
      : previewFromSubtitleStyle(style);

  let subtitleMode: SubtitleMode | undefined;
  if (
    typeof body.subtitleMode === 'string' &&
    SUBTITLE_MODES.includes(body.subtitleMode as SubtitleMode)
  ) {
    subtitleMode = body.subtitleMode as SubtitleMode;
  }

  const maxWordsPerSegment =
    typeof body.maxWordsPerSegment === 'number' &&
    Number.isFinite(body.maxWordsPerSegment)
      ? Math.max(1, Math.min(120, Math.round(body.maxWordsPerSegment)))
      : undefined;

  const highlightColor =
    typeof body.highlightColor === 'string' ? body.highlightColor : undefined;

  try {
    const [cnt] = await db
      .select({ n: count() })
      .from(subtitlePresets)
      .where(eq(subtitlePresets.userId, userId));

    if ((cnt?.n ?? 0) >= MAX_USER_SUBTITLE_PRESETS) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_USER_SUBTITLE_PRESETS} custom presets`,
        },
        { status: 403 }
      );
    }

    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `custom-${crypto.randomUUID()}`
        : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const payload = {
      preview,
      style,
      ...(subtitleMode !== undefined ? { subtitleMode } : {}),
      ...(maxWordsPerSegment !== undefined ? { maxWordsPerSegment } : {}),
      ...(highlightColor !== undefined ? { highlightColor } : {}),
    };

    const now = new Date();
    await db.insert(subtitlePresets).values({
      id,
      userId,
      name,
      payload,
      createdAt: now,
      updatedAt: now,
    });

    const record: SavedSubtitlePresetRecord = {
      id,
      name,
      createdAt: now.getTime(),
      preview,
      style,
      subtitleMode,
      maxWordsPerSegment,
      highlightColor,
    };

    return NextResponse.json({ preset: record });
  } catch (e) {
    console.error('[subtitle-presets POST]', e);
    return NextResponse.json(
      { error: 'Failed to save preset' },
      { status: 500 }
    );
  }
}
