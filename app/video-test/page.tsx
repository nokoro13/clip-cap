'use client';

import { Player, PlayerRef } from '@remotion/player';
import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import {
  SubtitleComposition,
  DEFAULT_SUBTITLE_STYLE,
  type Subtitle,
  type SubtitleStyle,
} from '../../remotion/Composition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const FPS = 30;
const TOTAL_FRAMES = 300;

const SUBTITLE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e', '#06b6d4'];

const ColorInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div
        className={cn('size-9 rounded-md border border-input', className)}
        style={{ backgroundColor: value }}
      />
    );
  }
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'size-9 cursor-pointer rounded-md border border-input bg-transparent p-0.5',
        className
      )}
    />
  );
};

const PRESET_STYLES: {
  id: string;
  name: string;
  preview: { bg: string; color: string; stroke?: string };
  style: Partial<SubtitleStyle>;
}[] = [
  {
    id: 'clean',
    name: 'Clean',
    preview: { bg: 'transparent', color: '#fff' },
    style: {
      fontSize: 52,
      fontWeight: 600,
      textColor: '#ffffff',
      backgroundColor: 'transparent',
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowBlur: 12,
      animation: 'fade',
    },
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    preview: { bg: 'transparent', color: '#fff', stroke: '#000' },
    style: {
      fontSize: 64,
      fontWeight: 900,
      textColor: '#ffffff',
      backgroundColor: 'transparent',
      backgroundOpacity: 0,
      strokeColor: '#000000',
      strokeWidth: 4,
      shadowBlur: 0,
      animation: 'pop',
    },
  },
  {
    id: 'boxed',
    name: 'Boxed',
    preview: { bg: '#000', color: '#fff' },
    style: {
      fontSize: 48,
      fontWeight: 500,
      textColor: '#ffffff',
      backgroundColor: '#000000',
      backgroundOpacity: 0.8,
      strokeWidth: 0,
      borderRadius: 8,
      animation: 'fade',
    },
  },
  {
    id: 'highlight',
    name: 'Highlight',
    preview: { bg: '#facc15', color: '#000' },
    style: {
      fontSize: 56,
      fontWeight: 700,
      textColor: '#000000',
      backgroundColor: '#facc15',
      backgroundOpacity: 1,
      strokeWidth: 0,
      borderRadius: 4,
      animation: 'pop',
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    preview: { bg: 'transparent', color: '#0ff' },
    style: {
      fontSize: 58,
      fontWeight: 700,
      textColor: '#00ffff',
      backgroundColor: 'transparent',
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowColor: '#00ffff',
      shadowBlur: 20,
      animation: 'pop',
    },
  },
  {
    id: 'bold-red',
    name: 'Bold',
    preview: { bg: '#ef4444', color: '#fff' },
    style: {
      fontSize: 64,
      fontWeight: 900,
      textColor: '#ffffff',
      backgroundColor: '#ef4444',
      backgroundOpacity: 1,
      strokeWidth: 0,
      borderRadius: 0,
      animation: 'pop',
    },
  },
];

export default function VideoTestPage() {
  const playerRef = useRef<PlayerRef>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [subtitles, setSubtitles] = useState<Subtitle[]>([
    { id: '1', text: 'Welcome to ClipCap! 🎬', startFrame: 0, endFrame: 60 },
    { id: '2', text: 'Style your subtitles', startFrame: 75, endFrame: 150 },
    { id: '3', text: 'Just like TikTok!', startFrame: 165, endFrame: 240 },
  ]);

  const [style, setStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; type: 'move' | 'start' | 'end' } | null>(
    null
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleFrameUpdate = () => {
      setCurrentFrame(player.getCurrentFrame());
    };

    player.addEventListener('frameupdate', handleFrameUpdate);
    return () => player.removeEventListener('frameupdate', handleFrameUpdate);
  }, []);

  const updateStyle = useCallback(
    <K extends keyof SubtitleStyle>(key: K, value: SubtitleStyle[K]) => {
      setStyle((prev) => ({ ...prev, [key]: value }));
      setActivePreset(null);
    },
    []
  );

  const applyPreset = useCallback((preset: (typeof PRESET_STYLES)[0]) => {
    setStyle((prev) => ({ ...prev, ...preset.style }));
    setActivePreset(preset.id);
  }, []);

  const updateSubtitle = useCallback((id: string, updates: Partial<Subtitle>) => {
    setSubtitles((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const removeSubtitle = useCallback(
    (id: string) => {
      setSubtitles((prev) => prev.filter((s) => s.id !== id));
      if (selectedSubtitle === id) setSelectedSubtitle(null);
    },
    [selectedSubtitle]
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current || dragging) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const frame = Math.round((x / rect.width) * TOTAL_FRAMES);
      playerRef.current?.seekTo(Math.max(0, Math.min(frame, TOTAL_FRAMES)));
    },
    [dragging]
  );

  const handleSubtitleDragStart = useCallback(
    (e: React.MouseEvent, id: string, type: 'move' | 'start' | 'end') => {
      e.stopPropagation();
      setDragging({ id, type });
      setSelectedSubtitle(id);
    },
    []
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const frame = Math.round((x / rect.width) * TOTAL_FRAMES);

      setSubtitles((prev) =>
        prev.map((sub) => {
          if (sub.id !== dragging.id) return sub;

          const duration = sub.endFrame - sub.startFrame;

          if (dragging.type === 'move') {
            const newStart = Math.max(0, Math.min(frame - duration / 2, TOTAL_FRAMES - duration));
            return {
              ...sub,
              startFrame: Math.round(newStart),
              endFrame: Math.round(newStart + duration),
            };
          } else if (dragging.type === 'start') {
            const newStart = Math.max(0, Math.min(frame, sub.endFrame - 15));
            return { ...sub, startFrame: newStart };
          } else {
            const newEnd = Math.min(TOTAL_FRAMES, Math.max(frame, sub.startFrame + 15));
            return { ...sub, endFrame: newEnd };
          }
        })
      );
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  const formatTime = (frames: number) => {
    const seconds = frames / FPS;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold">ClipCap Editor</h1>
        <Button variant="destructive">Export</Button>
      </header>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1">
        {/* Left Panel - Style Presets */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border p-4">
          <div className="mb-4">
            <Label className="mb-2 text-muted-foreground">Style Presets</Label>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_STYLES.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    'rounded-md border-2 bg-secondary p-3 transition-colors hover:bg-secondary/80',
                    activePreset === preset.id ? 'border-primary' : 'border-transparent'
                  )}
                >
                  <div
                    className="rounded px-2 py-1 text-xs font-bold"
                    style={{
                      color: preset.preview.color,
                      backgroundColor: preset.preview.bg,
                      textShadow: preset.preview.stroke
                        ? `1px 1px 0 ${preset.preview.stroke}, -1px -1px 0 ${preset.preview.stroke}, 1px -1px 0 ${preset.preview.stroke}, -1px 1px 0 ${preset.preview.stroke}`
                        : 'none',
                    }}
                  >
                    {preset.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <Label className="mb-3 text-muted-foreground">Customize</Label>

            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Size</span>
                <span className="text-xs text-muted-foreground">{style.fontSize}px</span>
              </div>
              <Slider
                value={[style.fontSize]}
                onValueChange={([v]) => updateStyle('fontSize', v)}
                min={32}
                max={96}
                step={1}
              />
            </div>

            <div className="mb-4 space-y-2">
              <Label className="text-xs text-muted-foreground">Position</Label>
              <div className="flex gap-1">
                {(['top', 'center', 'bottom'] as const).map((pos) => (
                  <Button
                    key={pos}
                    variant={style.position === pos ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => updateStyle('position', pos)}
                    className="flex-1 capitalize"
                  >
                    {pos}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <Label className="text-xs text-muted-foreground">Colors</Label>
              <div className="flex gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Text</span>
                  <ColorInput
                    value={style.textColor}
                    onChange={(v) => updateStyle('textColor', v)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">BG</span>
                  <ColorInput
                    value={style.backgroundColor}
                    onChange={(v) => updateStyle('backgroundColor', v)}
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">Stroke</span>
                  <ColorInput
                    value={style.strokeColor}
                    onChange={(v) => updateStyle('strokeColor', v)}
                  />
                </div>
              </div>
            </div>

            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Stroke</span>
                <span className="text-xs text-muted-foreground">{style.strokeWidth}px</span>
              </div>
              <Slider
                value={[style.strokeWidth]}
                onValueChange={([v]) => updateStyle('strokeWidth', v)}
                min={0}
                max={6}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Animation</Label>
              <Select
                value={style.animation}
                onValueChange={(v) => updateStyle('animation', v as SubtitleStyle['animation'])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="fade">Fade</SelectItem>
                  <SelectItem value="pop">Pop</SelectItem>
                  <SelectItem value="slide">Slide</SelectItem>
                  <SelectItem value="typewriter">Typewriter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </aside>

        {/* Center - Video Preview */}
        <main className="flex min-w-0 flex-1 items-center justify-center bg-black p-4">
          <div className="h-full max-h-full max-w-full" style={{ aspectRatio: '9 / 16' }}>
            <Player
              ref={playerRef}
              component={SubtitleComposition}
              inputProps={{ videoUrl: null, subtitles, style }}
              durationInFrames={TOTAL_FRAMES}
              fps={FPS}
              compositionWidth={1080}
              compositionHeight={1920}
              style={{ width: '100%', height: '100%' }}
              controls
            />
          </div>
        </main>

        {/* Right Panel - Subtitles List */}
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-border p-4">
          <Label className="mb-2 text-muted-foreground">Subtitles ({subtitles.length})</Label>

          <div className="flex flex-col gap-2">
            {subtitles.map((sub, i) => (
              <div
                key={sub.id}
                onClick={() => {
                  setSelectedSubtitle(sub.id);
                  playerRef.current?.seekTo(sub.startFrame);
                }}
                className={cn(
                  'cursor-pointer rounded-lg border bg-secondary p-3 transition-colors hover:bg-secondary/80',
                  selectedSubtitle === sub.id ? 'border-primary' : 'border-transparent'
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: SUBTITLE_COLORS[i % SUBTITLE_COLORS.length] }}
                  >
                    {formatTime(sub.startFrame)} - {formatTime(sub.endFrame)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSubtitle(sub.id);
                    }}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
                <Input
                  value={sub.text}
                  onChange={(e) => updateSubtitle(sub.id, { text: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 bg-background text-sm"
                />
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            className="mt-3 w-full border-dashed"
            onClick={() => {
              const lastEnd = subtitles.length > 0 ? subtitles[subtitles.length - 1].endFrame : 0;
              setSubtitles((prev) => [
                ...prev,
                {
                  id: Date.now().toString(),
                  text: 'New subtitle',
                  startFrame: Math.min(lastEnd + 15, TOTAL_FRAMES - 60),
                  endFrame: Math.min(lastEnd + 75, TOTAL_FRAMES),
                },
              ]);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Subtitle
          </Button>
        </aside>
      </div>

      {/* Timeline */}
      <footer className="shrink-0 border-t border-border bg-secondary p-4">
        {/* Time markers */}
        <div className="mb-1 flex justify-between px-1">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className="text-[10px] text-muted-foreground">
              {i}s
            </span>
          ))}
        </div>

        {/* Timeline track */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative h-14 cursor-pointer overflow-hidden rounded-lg bg-background"
        >
          {/* Grid lines */}
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className="absolute bottom-0 top-0 w-px bg-border"
              style={{ left: `${(i + 1) * 10}%` }}
            />
          ))}

          {/* Subtitle bars */}
          {subtitles.map((sub, i) => {
            const left = (sub.startFrame / TOTAL_FRAMES) * 100;
            const width = ((sub.endFrame - sub.startFrame) / TOTAL_FRAMES) * 100;
            const color = SUBTITLE_COLORS[i % SUBTITLE_COLORS.length];
            const isSelected = selectedSubtitle === sub.id;

            return (
              <div
                key={sub.id}
                className={cn(
                  'absolute bottom-2 top-2 flex items-center overflow-hidden rounded',
                  isSelected ? 'ring-2 ring-white' : 'opacity-70'
                )}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: color,
                  cursor: dragging ? 'grabbing' : 'grab',
                }}
                onMouseDown={(e) => handleSubtitleDragStart(e, sub.id, 'move')}
              >
                {/* Left resize handle */}
                <div
                  onMouseDown={(e) => handleSubtitleDragStart(e, sub.id, 'start')}
                  className="absolute bottom-0 left-0 top-0 w-2 cursor-ew-resize bg-black/30"
                />

                {/* Label */}
                <div className="flex-1 truncate px-3 text-[11px] font-medium text-white drop-shadow">
                  {sub.text}
                </div>

                {/* Right resize handle */}
                <div
                  onMouseDown={(e) => handleSubtitleDragStart(e, sub.id, 'end')}
                  className="absolute bottom-0 right-0 top-0 w-2 cursor-ew-resize bg-black/30"
                />
              </div>
            );
          })}

          {/* Playhead */}
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-destructive"
            style={{ left: `${(currentFrame / TOTAL_FRAMES) * 100}%` }}
          >
            <div className="absolute -left-1.5 -top-1 size-3 rounded-full bg-destructive" />
          </div>
        </div>

        {/* Current time display */}
        <div className="mt-2 flex justify-center">
          <span className="font-mono text-xs text-muted-foreground">
            {formatTime(currentFrame)} / {formatTime(TOTAL_FRAMES)}
          </span>
        </div>
      </footer>
    </div>
  );
}
