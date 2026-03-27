'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState } from 'react';
import { Captions, Layers, Lock } from 'lucide-react';
import { SimpleUploadDialog } from '@/components/simple-upload-dialog';
import { VideoUploadDialog, type ClipTopicId } from '@/components/video-upload-dialog';
import { SubscribeDialog, type SubscribeIntent } from '@/components/subscribe-dialog';
import { UsageBadge } from '@/components/usage-badge';
import type { UserUsageStats } from '@/lib/user-usage-types';
import { cn } from '@/lib/utils';
import { notifyProjectIndexUpdate } from '@/lib/project-index';
import { saveProjectToApi } from '@/lib/project-api';
import { saveVideoBlob } from '@/lib/video-storage';
import { uploadVideoToS3 } from '@/lib/upload-video-s3';

const DEFAULT_BASIC_CHECKOUT_URL = 'https://whop.com/checkout/plan_xtThkvdruzGaa';
const DEFAULT_PREMIUM_CHECKOUT_URL = 'https://whop.com/checkout/plan_OHjnjQ68gcbct';

interface QuickStartCardsProps {
  className?: string;
  /** When false, upload cards are disabled and a subscribe CTA is shown. Default true. */
  hasAccess?: boolean;
  /** From Whop product access; null if no plan. */
  accessLevel?: 'basic' | 'premium' | null;
  /** Monthly usage; null when not subscribed. */
  usageStats?: UserUsageStats | null;
  basicCheckoutUrl?: string;
  premiumCheckoutUrl?: string;
}

const ESTIMATED_PROCESSING_SECONDS = 60;

function createProgressUpdater(
  experienceId: string,
  projectId: string,
  title: string,
  type: 'editor' | 'project'
) {
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
    saveProjectToApi(experienceId, {
      id: projectId,
      experienceId,
      title,
      type,
      status: 'processing',
      progress,
    }).catch((e) => console.error('Progress update failed:', e));
  }, 2000);

  return { stop };
}

function checkoutUrls(props: QuickStartCardsProps) {
  return {
    basic: props.basicCheckoutUrl ?? DEFAULT_BASIC_CHECKOUT_URL,
    premium: props.premiumCheckoutUrl ?? DEFAULT_PREMIUM_CHECKOUT_URL,
  };
}

export function QuickStartCards({
  className,
  hasAccess = true,
  accessLevel = null,
  usageStats = null,
  basicCheckoutUrl = DEFAULT_BASIC_CHECKOUT_URL,
  premiumCheckoutUrl = DEFAULT_PREMIUM_CHECKOUT_URL,
}: QuickStartCardsProps) {
  const router = useRouter();
  const params = useParams();
  const experienceId = params.experienceId as string;
  const { basic: basicUrl, premium: premiumUrl } = checkoutUrls({
    basicCheckoutUrl,
    premiumCheckoutUrl,
  });

  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [limitDialogIntent, setLimitDialogIntent] =
    useState<SubscribeIntent>('subscribe');

  const openLimitDialog = (intent: SubscribeIntent) => {
    setLimitDialogIntent(intent);
    setLimitDialogOpen(true);
  };

  const handleSingleVideoSelect = async (file: File) => {
    if (usageStats && usageStats.generateSubtitles.used >= usageStats.generateSubtitles.limit) {
      if (usageStats.accessLevel === 'basic') {
        openLimitDialog('upgrade_to_premium');
      } else {
        alert(
          'You have used all Premium subtitle uploads for this month. Limits reset when your billing period rolls.'
        );
      }
      return;
    }

    const projectId = `editor-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    await saveProjectToApi(experienceId, {
      id: projectId,
      experienceId,
      title: file.name,
      type: 'editor',
      status: 'processing',
      progress: 0,
    });

    const progressUpdater = createProgressUpdater(
      experienceId,
      projectId,
      file.name,
      'editor'
    );

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as {
          error?: string;
          requiresUpgrade?: boolean;
        };
        if (response.status === 403) {
          if (error.requiresUpgrade) {
            openLimitDialog('upgrade_to_premium');
          } else {
            alert(error.error || 'Upload limit reached');
          }
          progressUpdater.stop();
          await saveProjectToApi(experienceId, {
            id: projectId,
            experienceId,
            title: file.name,
            type: 'editor',
            status: 'error',
            progress: 0,
          }).catch(() => {});
          return;
        }
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

      await saveProjectToApi(experienceId, {
        id: projectId,
        experienceId,
        title: file.name,
        type: 'editor',
        status: 'completed',
        progress: 100,
        duration,
        videoUrl: remoteVideoUrl ?? undefined,
        captions: projectData.captions,
        segmentCaptions: projectData.segmentCaptions,
      });

      router.refresh();
      router.push(`/editor/${projectId}`);
    } catch (error) {
      progressUpdater.stop();
      console.error('Error processing video:', error);
      await saveProjectToApi(experienceId, {
        id: projectId,
        experienceId,
        title: file.name,
        type: 'editor',
        status: 'error',
        progress: 0,
      }).catch(() => {});
      alert(error instanceof Error ? error.message : 'Failed to process video');
    }
  };

  const handleBulkVideoSelect = async (file: File, topics: ClipTopicId[] = ['auto']) => {
    if (accessLevel === 'basic') {
      openLimitDialog('upgrade_to_premium');
      return;
    }

    if (
      usageStats &&
      usageStats.accessLevel === 'premium' &&
      usageStats.bulkGenerate.used >= usageStats.bulkGenerate.limit
    ) {
      alert(
        'You have used all bulk uploads for this month. Limits reset when your billing period rolls.'
      );
        return;
    }

    const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    console.log('[bulk] Started:', file.name, file.size, 'bytes');

    await saveProjectToApi(experienceId, {
      id: projectId,
      experienceId,
      title: file.name,
      type: 'project',
      status: 'processing',
      progress: 0,
    });

    try {
      // 1. Upload to S3 (required). Server will fetch from S3 for analysis.
      console.log('[bulk] Step 1: Uploading to S3');
      let remoteVideoUrl: string;
      let lastSavedUploadProgress = -1;
      try {
        remoteVideoUrl = await uploadVideoToS3({
          file,
          onProgress: (p) => {
            const pct = Math.round(p.progress * 22);
            if (pct - lastSavedUploadProgress >= 4 || p.progress >= 1) {
              lastSavedUploadProgress = pct;
              void saveProjectToApi(experienceId, {
                id: projectId,
                experienceId,
                title: file.name,
                type: 'project',
                status: 'processing',
                progress: Math.min(22, pct),
              });
            }
          },
        });
      } catch (uploadError) {
        console.error('[bulk] S3 upload failed:', uploadError);
        throw new Error(
          `Upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`
        );
      }
      console.log('[bulk] S3 upload complete:', remoteVideoUrl);

      await saveProjectToApi(experienceId, {
        id: projectId,
        experienceId,
        title: file.name,
        type: 'project',
        status: 'processing',
        progress: 22,
      });

      // 2. Start async analysis (returns immediately). Gallery on this page polls for progress.
      console.log('[bulk] Step 2: Starting async analysis');
      const asyncRes = await fetch('/api/analyze-viral-async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: remoteVideoUrl,
          projectId,
          experienceId,
          title: file.name,
          topics,
        }),
      });

      if (!asyncRes.ok) {
        const errData = (await asyncRes.json().catch(() => ({}))) as {
          error?: string;
          requiresUpgrade?: boolean;
        };
        if (asyncRes.status === 403) {
          if (errData.requiresUpgrade) {
            openLimitDialog('upgrade_to_premium');
          } else {
            alert(errData.error || 'Upload limit reached');
          }
          await saveProjectToApi(experienceId, {
            id: projectId,
            experienceId,
            title: file.name,
            type: 'project',
            status: 'error',
            progress: 0,
          }).catch(() => {});
          return;
        }
        throw new Error(errData.error || 'Failed to start analysis');
      }

      sessionStorage.setItem(`video-${projectId}`, remoteVideoUrl);
      await saveVideoBlob(projectId, file);

      localStorage.setItem(
        `project-${projectId}`,
        JSON.stringify({
          id: projectId,
          title: file.name,
          videoUrl: remoteVideoUrl,
          status: 'processing',
          experienceId,
        })
      );

      notifyProjectIndexUpdate();
      router.refresh();
    } catch (error) {
      console.error('Error analyzing video:', error);
      await saveProjectToApi(experienceId, {
        id: projectId,
        experienceId,
        title: file.name,
        type: 'project',
        status: 'error',
        progress: 0,
      }).catch(() => {});
      alert(error instanceof Error ? error.message : 'Failed to analyze video');
    }
  };

  const handleYoutubeUrl = async (url: string, topics: ClipTopicId[] = ['auto']) => {
    if (accessLevel === 'basic') {
      openLimitDialog('upgrade_to_premium');
      return;
    }

    if (
      usageStats &&
      usageStats.accessLevel === 'premium' &&
      usageStats.bulkGenerate.used >= usageStats.bulkGenerate.limit
    ) {
      alert(
        'You have used all bulk uploads for this month. Limits reset when your billing period rolls.'
      );
      return;
    }

    const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    await saveProjectToApi(experienceId, {
      id: projectId,
      experienceId,
      title: 'YouTube video',
      type: 'project',
      status: 'processing',
      progress: 0,
    });

    const progressUpdater = createProgressUpdater(
      experienceId,
      projectId,
      'YouTube video',
      'project'
    );

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
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          requiresUpgrade?: boolean;
        };
        if (response.status === 403) {
          if (data.requiresUpgrade) {
            openLimitDialog('upgrade_to_premium');
          } else {
            alert(data.error || 'Upload limit reached');
          }
          progressUpdater.stop();
          await saveProjectToApi(experienceId, {
            id: projectId,
            experienceId,
            title: 'YouTube video',
            type: 'project',
            status: 'error',
            progress: 0,
          }).catch(() => {});
          return;
        }
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

      await saveProjectToApi(experienceId, {
        id: projectId,
        experienceId,
        title: projectData.title ?? 'YouTube video',
        type: 'project',
        status: 'completed',
        progress: 100,
        duration: projectData.duration,
        clipsCount: projectData.clips?.length ?? 0,
        videoUrl: projectData.videoUrl,
        captions: projectData.captions,
        segmentCaptions: projectData.segmentCaptions,
        clips: projectData.clips,
        fullTranscript: projectData.fullTranscript,
        youtubeVideoId: projectData.youtubeVideoId,
      });

      router.refresh();
      router.push(`/projects/${projectId}`);
    } catch (error) {
      progressUpdater.stop();
      console.error('Error processing YouTube video:', error);
      await saveProjectToApi(experienceId, {
        id: projectId,
        experienceId,
        title: 'YouTube video',
        type: 'project',
        status: 'error',
        progress: 0,
      }).catch(() => {});
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
    ? { basicCheckoutUrl: basicUrl, premiumCheckoutUrl: premiumUrl }
    : undefined;

  const bulkPremiumGate =
    hasAccess && accessLevel === 'basic'
      ? {
          basicCheckoutUrl: basicUrl,
          premiumCheckoutUrl: premiumUrl,
          intent: 'upgrade_to_premium' as const,
        }
      : undefined;

  const cardContent = (props: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    footer?: React.ReactNode;
    lockedPremium?: boolean;
  }) => (
    <div
      className={cn(
        'relative flex h-full cursor-pointer flex-col items-center justify-center gap-4 rounded-xl bg-muted/50 p-6 transition-all hover:bg-muted hover:shadow-md'
      )}
    >
      {props.lockedPremium ? (
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          <Lock className="size-3 shrink-0" aria-hidden />
          Premium
        </span>
      ) : null}
      <div className="flex size-20 items-center justify-center rounded-2xl">{props.icon}</div>
      <div className="text-center">
        <h3 className="text-base font-semibold">{props.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
        {props.footer}
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
                footer:
                  usageStats && hasAccess ? (
                    <UsageBadge
                      label="Subtitles"
                      used={usageStats.generateSubtitles.used}
                      limit={usageStats.generateSubtitles.limit}
                      className="mt-2"
                    />
                  ) : null,
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
          subscriptionGate={subscriptionGate ?? bulkPremiumGate}
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
                lockedPremium: accessLevel === 'basic' && hasAccess,
                footer:
                  usageStats && hasAccess && accessLevel === 'premium' ? (
                    <UsageBadge
                      label="Bulk"
                      used={usageStats.bulkGenerate.used}
                      limit={usageStats.bulkGenerate.limit}
                      className="mt-2"
                    />
                  ) : accessLevel === 'basic' && hasAccess ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Included with Premium (15/month)
                    </p>
                  ) : null,
              })}
            </button>
          }
        />
      </div>

      <SubscribeDialog
        open={limitDialogOpen}
        onOpenChange={setLimitDialogOpen}
        intent={limitDialogIntent}
        basicCheckoutUrl={basicUrl}
        premiumCheckoutUrl={premiumUrl}
      />
    </div>
  );
}
