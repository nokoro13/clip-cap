'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Pause,
  Edit,
  Download,
  Check,
  X,
  Archive,
  Loader2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getVideoBlobUrl } from '@/lib/video-storage';
import { addProjectToIndex, notifyProjectIndexUpdate } from '@/lib/project-index';
import type { Caption } from '@remotion/captions';

type ClipStatus = 'all' | 'approved' | 'rejected' | 'exported' | 'archived';

type ViralClip = {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  viralityScore: number;
  reason?: string;
  transcript: string;
  status: ClipStatus;
  thumbnailUrl?: string;
};

type ProjectData = {
  id: string;
  title: string;
  videoUrl: string;
  audioUrl?: string;
  thumbnailUrl: string;
  duration: number;
  channelName?: string;
  captions: Caption[];
  clips: ViralClip[];
  fullTranscript: string;
  status: 'processing' | 'completed' | 'error';
  createdAt: number;
  youtubeVideoId?: string;
  experienceId?: string;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getViralityColor(score: number): string {
  if (score >= 90) return 'text-green-500';
  if (score >= 75) return 'text-emerald-500';
  if (score >= 60) return 'text-yellow-500';
  return 'text-orange-500';
}

function getViralityBadgeColor(score: number): string {
  if (score >= 90) return 'bg-green-500/20 text-green-400';
  if (score >= 75) return 'bg-emerald-500/20 text-emerald-400';
  if (score >= 60) return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-orange-500/20 text-orange-400';
}

// Video preview component for clip cards
function ClipVideoPreview({
  videoUrl,
  startMs,
  endMs,
  isPlaying,
  onPlayToggle,
}: {
  videoUrl: string;
  startMs: number;
  endMs: number;
  isPlaying: boolean;
  onPlayToggle: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.currentTime = startMs / 1000;
      video.play();
    } else {
      video.pause();
    }
  }, [isPlaying, startMs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.currentTime >= endMs / 1000) {
        video.pause();
        video.currentTime = startMs / 1000;
        onPlayToggle();
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [startMs, endMs, onPlayToggle]);

  // Seek to startMs when video loads or URL changes (for thumbnail display when paused)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const seekToStart = () => {
      video.currentTime = startMs / 1000;
    };

    if (video.readyState >= 2) {
      seekToStart();
    } else {
      video.addEventListener('loadeddata', seekToStart);
      return () => video.removeEventListener('loadeddata', seekToStart);
    }
  }, [videoUrl, startMs]);

  return (
    <div className="relative size-full">
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="size-full object-cover"
          playsInline
          preload="metadata"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-muted">
          <span className="text-xs text-muted-foreground">No preview</span>
        </div>
      )}

      {/* Play/Pause overlay */}
      <button
        type="button"
        onClick={onPlayToggle}
        className="absolute inset-0 flex size-full items-center justify-center bg-black/0 transition-all hover:bg-black/30"
      >
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-opacity',
            isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'
          )}
        >
          {isPlaying ? (
            <Pause className="size-5 text-black" />
          ) : (
            <Play className="size-5 text-black" />
          )}
        </div>
      </button>
    </div>
  );
}

export default function ProjectGalleryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ClipStatus>('all');
  const [processingClips, setProcessingClips] = useState<Set<string>>(new Set());
  const [experienceId, setExperienceId] = useState<string | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      setIsLoading(true);
      setError(null);

      const projectId = params.id as string;

      // Resolve video URL: prefer IndexedDB first (fresh blob URL after refresh). sessionStorage
      // can keep a stale blob URL after refresh that no longer plays.
      const storedProject = localStorage.getItem(`project-${projectId}`);
      let resolvedVideoUrl: string | null = null;
      const fromIdb = await getVideoBlobUrl(projectId);
      if (fromIdb) {
        resolvedVideoUrl = fromIdb;
        sessionStorage.setItem(`video-${projectId}`, fromIdb);
      }
      if (!resolvedVideoUrl) resolvedVideoUrl = sessionStorage.getItem(`video-${projectId}`);
      if (!resolvedVideoUrl && storedProject) {
        try {
          const p = JSON.parse(storedProject);
          resolvedVideoUrl = p.videoUrl || p.blobUrl || null;
        } catch {
          // ignore
        }
      }

      // If we have a stored project with youtubeVideoId, use our stream proxy (raw yt-dlp URLs are blocked in browser by CORS).
      // Use absolute URL so video elements and Remotion can load reliably.
      if (storedProject) {
        try {
          const parsed = JSON.parse(storedProject);
          if (parsed.youtubeVideoId) {
            const origin =
              typeof window !== 'undefined' ? window.location.origin : '';
            resolvedVideoUrl = `${origin}/api/youtube-stream/${parsed.youtubeVideoId}`;
            sessionStorage.setItem(`video-${projectId}`, resolvedVideoUrl);
          }
        } catch {
          // ignore
        }
      }

      if (resolvedVideoUrl) setVideoUrl(resolvedVideoUrl);

      if (storedProject) {
        try {
          const parsed = JSON.parse(storedProject);
          // Ensure clips have status
          const clips = (parsed.clips || []).map((clip: ViralClip) => ({
            ...clip,
            status: clip.status || 'all',
          }));
          
          const finalVideoUrl = resolvedVideoUrl || '';
          setProject({ ...parsed, clips, videoUrl: finalVideoUrl });
          if (finalVideoUrl) setVideoUrl(finalVideoUrl);
          if (parsed.experienceId) setExperienceId(parsed.experienceId);
          setIsLoading(false);
          return;
        } catch (e) {
          console.error('Failed to parse stored project:', e);
        }
      }

      // Check if we have a YouTube URL to process
      const youtubeUrl = searchParams.get('youtubeUrl');
      const experienceIdFromUrl = searchParams.get('experienceId');
      if (youtubeUrl) {
        try {
          const response = await fetch('/api/process-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youtubeUrl: decodeURIComponent(youtubeUrl), projectId }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to process video');
          }

          const data = await response.json();
          const projectData: ProjectData = {
            ...data.project,
            experienceId: experienceIdFromUrl || undefined,
            clips: (data.project.clips || []).map((clip: ViralClip) => ({
              ...clip,
              status: 'all',
            })),
          };

          // Store in localStorage (keep raw videoUrl for reference; playback uses proxy URL)
          localStorage.setItem(`project-${projectId}`, JSON.stringify(projectData));
          setProject(projectData);
          if (projectData.youtubeVideoId) {
            const origin =
              typeof window !== 'undefined' ? window.location.origin : '';
            const proxyUrl = `${origin}/api/youtube-stream/${projectData.youtubeVideoId}`;
            setVideoUrl(proxyUrl);
            sessionStorage.setItem(`video-${projectId}`, proxyUrl);
          } else if (projectData.videoUrl) {
            setVideoUrl(projectData.videoUrl);
            sessionStorage.setItem(`video-${projectId}`, projectData.videoUrl);
          }
          if (experienceIdFromUrl) {
            setExperienceId(experienceIdFromUrl);
            addProjectToIndex(experienceIdFromUrl, {
              id: projectId,
              title: projectData.title,
              type: 'project',
              duration: projectData.duration,
              clipsCount: projectData.clips?.length ?? 0,
              status: 'completed',
              progress: 100,
            });
            notifyProjectIndexUpdate();
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to process video');
        }
      } else {
        setError('Project not found');
      }

      setIsLoading(false);
    };

    loadProject();
  }, [params.id, searchParams]);

  // Save project when clips change
  useEffect(() => {
    if (project) {
      localStorage.setItem(`project-${project.id}`, JSON.stringify(project));
    }
  }, [project]);

  const updateClipStatus = (clipId: string, status: ClipStatus) => {
    if (!project) return;
    setProject({
      ...project,
      clips: project.clips.map((clip) =>
        clip.id === clipId ? { ...clip, status } : clip
      ),
    });
  };

  const handleEditClip = (clip: ViralClip) => {
    if (!project || !videoUrl) {
      alert('Video not available. Please re-upload the video.');
      return;
    }

    // Extract captions for this clip's time range and adjust timing to start from 0
    const clipCaptions = project.captions
      .filter((c) => c.startMs >= clip.startMs && c.endMs <= clip.endMs)
      .map((c) => ({
        ...c,
        startMs: c.startMs - clip.startMs,
        endMs: c.endMs - clip.startMs,
      }));

    // Store clip data for the editor
    const editorData = {
      captions: clipCaptions,
      duration: (clip.endMs - clip.startMs) / 1000,
      title: clip.title,
      clipStartMs: clip.startMs,
      clipEndMs: clip.endMs,
      sourceProjectId: project.id,
      experienceId,
      youtubeVideoId: project.youtubeVideoId, // So editor can fetch a fresh stream URL
    };

    // Preserve videoTransform and videoAspectRatio if user had previously adjusted crop in editor
    const existingProject = localStorage.getItem(`project-${clip.id}`);
    let toSave = editorData as Record<string, unknown>;
    if (existingProject) {
      try {
        const parsed = JSON.parse(existingProject) as {
          videoTransform?: unknown;
          videoAspectRatio?: unknown;
        };
        if (parsed.videoTransform) {
          toSave = { ...toSave, videoTransform: parsed.videoTransform };
        }
        if (
          typeof parsed.videoAspectRatio === "number" &&
          parsed.videoAspectRatio > 0
        ) {
          toSave = { ...toSave, videoAspectRatio: parsed.videoAspectRatio };
        }
      } catch {
        // ignore
      }
    }

    // Store the video URL in sessionStorage for the editor (editor will refresh from API if youtubeVideoId)
    sessionStorage.setItem(`video-${clip.id}`, videoUrl);
    localStorage.setItem(`project-${clip.id}`, JSON.stringify(toSave));

    // Navigate to editor
    router.push(`/editor/${clip.id}`);
  };

  const filteredClips = project?.clips.filter((clip) => {
    if (activeTab === 'all') return true;
    return clip.status === activeTab;
  }) || [];

  const clipCounts = {
    all: project?.clips.length || 0,
    approved: project?.clips.filter((c) => c.status === 'approved').length || 0,
    rejected: project?.clips.filter((c) => c.status === 'rejected').length || 0,
    exported: project?.clips.filter((c) => c.status === 'exported').length || 0,
    archived: project?.clips.filter((c) => c.status === 'archived').length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="mb-4 size-8 animate-spin text-primary" />
        <h2 className="mb-2 text-xl font-semibold">Processing Video</h2>
        <p className="text-muted-foreground">
          Analyzing your video for viral moments...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <X className="mx-auto mb-4 size-12 text-destructive" />
          <h2 className="mb-2 text-xl font-semibold">Error Processing Video</h2>
          <p className="mb-4 text-muted-foreground">{error}</p>
          <Button asChild>
            <Link href={experienceId ? `/experiences/${experienceId}` : '/'}>Go Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Project not found</p>
        <Button asChild className="mt-4">
          <Link href={experienceId ? `/experiences/${experienceId}` : '/'}>Go Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header - relative z-10 so back/edit stay clickable when many videos load */}
      <header className="relative z-10 border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 gap-2">
          <div className="flex items-center gap-4 flex-1 overflow-hidden">
            <Link
              href={experienceId ? `/experiences/${experienceId}` : '/'}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              prefetch={false}
            >
              <ArrowLeft className="size-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">{project.title}</h1>
              {project.channelName && (
                <p className="text-sm text-muted-foreground">
                  {project.channelName}
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" className="flex-1 max-w-max">
            <Download className="mr-2 size-4" />
            Get clip manually
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ClipStatus)}
          className="mb-12"
        >
          <TabsList className='flex flex-wrap'>
            <TabsTrigger value="all">All ({clipCounts.all})</TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({clipCounts.approved})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({clipCounts.rejected})
            </TabsTrigger>
            <TabsTrigger value="exported">
              Exported ({clipCounts.exported})
            </TabsTrigger>
            <TabsTrigger value="archived">
              Archived ({clipCounts.archived})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Video Timeline Preview */}
        <Card className="mb-6 hidden sm:flex">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
                {project.thumbnailUrl ? (
                  <img
                    src={project.thumbnailUrl}
                    alt={project.title}
                    className="size-full object-cover"
                  />
                ) : videoUrl ? (
                  <video
                    src={videoUrl}
                    className="size-full object-cover"
                    playsInline
                    preload="metadata"
                  />
                ) : null}
              </div>
              <div className="flex-1">
                <p className="mb-1 text-sm font-medium">
                  {clipCounts.all} clips selected and auto-framed by AI
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  {/* Clip markers on timeline */}
                  <div className="relative size-full">
                    {project.clips.map((clip) => {
                      const left = (clip.startMs / (project.duration * 1000)) * 100;
                      const width =
                        ((clip.endMs - clip.startMs) / (project.duration * 1000)) * 100;
                      return (
                        <div
                          key={clip.id}
                          className="absolute top-0 h-full bg-primary/60"
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {Math.floor(project.duration / 60)}:
                {(project.duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clips Grid */}
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredClips.map((clip) => (
            <Card
              key={clip.id}
              className="group overflow-hidden transition-shadow hover:shadow-lg"
            >
              {/* Video Preview */}
              <div className="relative aspect-[9/16] bg-muted">
                <ClipVideoPreview
                  videoUrl={videoUrl}
                  startMs={clip.startMs}
                  endMs={clip.endMs}
                  isPlaying={playingClipId === clip.id}
                  onPlayToggle={() =>
                    setPlayingClipId(playingClipId === clip.id ? null : clip.id)
                  }
                />

                {/* Original preview badge */}
                <div className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                  Original preview
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-xs text-white">
                  <Clock className="size-3" />
                  {formatDuration(clip.endMs - clip.startMs)}
                </div>
              </div>

              {/* Clip info */}
              <CardHeader className="p-4 pb-2">
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      getViralityBadgeColor(clip.viralityScore)
                    )}
                  >
                    <TrendingUp className="size-3" />
                    {clip.viralityScore}%
                  </span>
                </div>
                <CardTitle className="line-clamp-2 text-sm font-medium">
                  {clip.title}
                </CardTitle>
                {clip.reason && (
                  <CardDescription className="line-clamp-2 text-xs">
                    {clip.reason}
                  </CardDescription>
                )}
              </CardHeader>

              {/* Actions - relative z-10 so buttons stay clickable above video preview area */}
              <CardContent className="relative z-10 flex gap-2 p-4 pt-0">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => handleEditClip(clip)}
                  type="button"
                >
                  <Edit className="mr-1 size-3" />
                  Edit
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-green-500 hover:bg-green-500/20 hover:text-green-400"
                  onClick={() => updateClipStatus(clip.id, 'approved')}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-red-500 hover:bg-red-500/20 hover:text-red-400"
                  onClick={() => updateClipStatus(clip.id, 'rejected')}
                >
                  <X className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => updateClipStatus(clip.id, 'archived')}
                >
                  <Archive className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredClips.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              No clips in this category yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
