'use client';

import { useRouter, useParams } from 'next/navigation';
import { Captions, Layers } from 'lucide-react';
import { SimpleUploadDialog } from '@/components/simple-upload-dialog';
import { VideoUploadDialog, type ClipTopicId } from '@/components/video-upload-dialog';
import { cn } from '@/lib/utils';
import {
  addProjectToIndex,
  updateProjectInIndex,
  notifyProjectIndexUpdate,
} from '@/lib/project-index';
import { saveVideoBlob } from '@/lib/video-storage';
import { uploadVideoToS3 } from '@/lib/upload-video-s3';

const DEFAULT_BASIC_CHECKOUT_URL = 'https://whop.com/checkout/plan_xtThkvdruzGaa';
const DEFAULT_PREMIUM_CHECKOUT_URL = 'https://whop.com/checkout/plan_OHjnjQ68gcbct';

interface QuickStartCardsProps {
  className?: string;
  /** When false, upload cards are disabled and a subscribe CTA is shown. Default true. */
  hasAccess?: boolean;
  basicCheckoutUrl?: string;
  premiumCheckoutUrl?: string;
}

const ESTIMATED_PROCESSING_SECONDS = 60;

function createProgressUpdater(experienceId: string, projectId: string) {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const startTime = Date.now();

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  intervalId = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(90, Math.round((elapsed / ESTIMATED_PROCESSING_SECONDS) * 90));
    updateProjectInIndex(experienceId, projectId, { progress });
    notifyProjectIndexUpdate();
  }, 500);

  return { stop };
}

export function QuickStartCards({
  className,
  hasAccess = true,
  basicCheckoutUrl = DEFAULT_BASIC_CHECKOUT_URL,
  premiumCheckoutUrl = DEFAULT_PREMIUM_CHECKOUT_URL,
}: QuickStartCardsProps) {
  const router = useRouter();
  const params = useParams();
  const experienceId = params.experienceId as string;

  const handleSingleVideoSelect = async (file: File) => {
    const projectId = `editor-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    addProjectToIndex(experienceId, {
      id: projectId,
      title: file.name,
      type: 'editor',
      status: 'processing',
      progress: 0,
    });
    notifyProjectIndexUpdate();

    const progressUpdater = createProgressUpdater(experienceId, projectId);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to transcribe video');
      }

      const { captions, segmentCaptions, duration } = await response.json();
      progressUpdater.stop();

      const blobUrl = URL.createObjectURL(file);
      let remoteVideoUrl: string | null = null;
      try {
        remoteVideoUrl = await uploadVideoToS3({ file });
      } catch (e) {
        console.error('Error uploading video to S3 (single video):', e);
      }

      const projectData = {
        captions,
        segmentCaptions,
        duration,
        title: file.name,
        videoUrl: remoteVideoUrl,
        experienceId,
      };
      localStorage.setItem(`project-${projectId}`, JSON.stringify(projectData));
      sessionStorage.setItem(`video-${projectId}`, remoteVideoUrl || blobUrl);
      await saveVideoBlob(projectId, file);

      updateProjectInIndex(experienceId, projectId, {
        status: 'completed',
        progress: 100,
        duration,
      });
      notifyProjectIndexUpdate();

      router.push(`/editor/${projectId}`);
    } catch (error) {
      progressUpdater.stop();
      console.error('Error processing video:', error);
      updateProjectInIndex(experienceId, projectId, {
        status: 'error',
        progress: 0,
      });
      notifyProjectIndexUpdate();
      alert(error instanceof Error ? error.message : 'Failed to process video');
    }
  };

  const handleBulkVideoSelect = async (file: File, topics: ClipTopicId[] = ['auto']) => {
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    addProjectToIndex(experienceId, {
      id: projectId,
      title: file.name,
      type: 'project',
      status: 'processing',
      progress: 0,
    });
    notifyProjectIndexUpdate();

    const progressUpdater = createProgressUpdater(experienceId, projectId);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('topics', JSON.stringify(topics));

      const response = await fetch('/api/analyze-viral', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze video');
      }

      const { captions, segmentCaptions, clips, duration, fullTranscript } = await response.json();
      progressUpdater.stop();

      const blobUrl = URL.createObjectURL(file);
      let remoteVideoUrl: string | null = null;
      try {
        remoteVideoUrl = await uploadVideoToS3({ file });
      } catch (e) {
        console.error('Error uploading video to S3 (bulk video):', e);
      }

      const projectData = {
        id: projectId,
        title: file.name,
        videoUrl: remoteVideoUrl,
        thumbnailUrl: '',
        duration: duration,
        captions,
        segmentCaptions,
        clips: clips.map((clip: { id: string; title: string; startMs: number; endMs: number; viralityScore: number; reason?: string; transcript: string }) => ({
          ...clip,
          status: 'all',
        })),
        fullTranscript,
        status: 'completed',
        createdAt: Date.now(),
        experienceId,
      };

      localStorage.setItem(`project-${projectId}`, JSON.stringify(projectData));
      sessionStorage.setItem(`video-${projectId}`, remoteVideoUrl || blobUrl);
      await saveVideoBlob(projectId, file);

      updateProjectInIndex(experienceId, projectId, {
        status: 'completed',
        progress: 100,
        duration: typeof duration === 'number' ? duration : 0,
        clipsCount: clips?.length ?? 0,
      });
      notifyProjectIndexUpdate();

      router.push(`/projects/${projectId}`);
    } catch (error) {
      progressUpdater.stop();
      console.error('Error analyzing video:', error);
      updateProjectInIndex(experienceId, projectId, { status: 'error', progress: 0 });
      notifyProjectIndexUpdate();
      alert(error instanceof Error ? error.message : 'Failed to analyze video');
    }
  };

  const handleYoutubeUrl = async (url: string, topics: ClipTopicId[] = ['auto']) => {
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    addProjectToIndex(experienceId, {
      id: projectId,
      title: 'YouTube video',
      type: 'project',
      status: 'processing',
      progress: 0,
    });
    notifyProjectIndexUpdate();

    const progressUpdater = createProgressUpdater(experienceId, projectId);

    try {
      const response = await fetch('/api/process-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: url,
          projectId,
          topics,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process video');
      }

      const data = await response.json();
      progressUpdater.stop();

      const projectData = data.project;
      const projectToStore = {
        ...projectData,
        experienceId,
        clips: (projectData.clips || []).map((c: { status?: string }) => ({
          ...c,
          status: c.status || 'all',
        })),
      };
      localStorage.setItem(`project-${projectId}`, JSON.stringify(projectToStore));

      if (projectData.youtubeVideoId) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const proxyUrl = `${origin}/api/youtube-stream/${projectData.youtubeVideoId}`;
        sessionStorage.setItem(`video-${projectId}`, proxyUrl);
      } else if (projectData.videoUrl) {
        sessionStorage.setItem(`video-${projectId}`, projectData.videoUrl);
      }

      updateProjectInIndex(experienceId, projectId, {
        status: 'completed',
        progress: 100,
        title: projectData.title,
        duration: projectData.duration,
        clipsCount: projectData.clips?.length ?? 0,
      });
      notifyProjectIndexUpdate();

      router.push(`/projects/${projectId}`);
    } catch (error) {
      progressUpdater.stop();
      console.error('Error processing YouTube video:', error);
      updateProjectInIndex(experienceId, projectId, { status: 'error', progress: 0 });
      notifyProjectIndexUpdate();
      alert(error instanceof Error ? error.message : 'Failed to process video');
    }
  };

  const handleGoogleDriveImport = () => {
    // TODO: Implement Google Drive import
    alert('Google Drive import coming soon!');
  };

  const handleSampleVideoSelect = () => {
    // Use a sample YouTube URL for demonstration (uses current topic selection from dialog)
    handleYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', ['auto']);
  };

  const subscriptionGate = !hasAccess
    ? { basicCheckoutUrl, premiumCheckoutUrl }
    : undefined;

  const cardContent = (props: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
  }) => (
    <div
      className={cn(
        'flex h-full cursor-pointer flex-col items-center justify-center gap-4 rounded-xl bg-muted/50 p-6 transition-all hover:bg-muted hover:shadow-md'
      )}
    >
      <div className="flex size-20 items-center justify-center rounded-2xl">
        {props.icon}
      </div>
      <div className="text-center">
        <h3 className="text-base font-semibold">{props.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
      </div>
    </div>
  );

  return (
    <div className={cn('space-y-4', className)}>
      <h2 className="text-sm font-medium text-muted-foreground">Quick start</h2>

      <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
        {/* Generate Subtitles Card */}
        <SimpleUploadDialog
          onVideoSelect={handleSingleVideoSelect}
          title="Generate Subtitles"
          description="MP4 or MOV, Max size: 500MB (audio extracted for transcription)"
          subscriptionGate={subscriptionGate}
          trigger={
            <button type="button" className="h-full w-full text-left">
              {cardContent({
                icon: (
                  <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100">
                    <Captions className="size-10 text-violet-600" />
                  </div>
                ),
                title: 'Generate Subtitles',
                subtitle: 'Get trendy AI captions in just one click',
              })}
            </button>
          }
        />

        {/* Bulk Generate Card */}
        <VideoUploadDialog
          onVideoSelect={handleBulkVideoSelect}
          onYoutubeUrl={handleYoutubeUrl}
          onGoogleDriveImport={handleGoogleDriveImport}
          onSampleVideoSelect={handleSampleVideoSelect}
          subscriptionGate={subscriptionGate}
          trigger={
            <button type="button" className="h-full w-full text-left">
              {cardContent({
                icon: (
                  <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100">
                    <Layers className="size-10 text-blue-600" />
                  </div>
                ),
                title: 'Bulk Generate',
                subtitle: 'Process multiple videos or YouTube links',
              })}
            </button>
          }
        />
      </div>
    </div>
  );
}
