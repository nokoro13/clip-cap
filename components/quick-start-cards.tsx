'use client';

import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Captions, Layers, Lock } from 'lucide-react';
import { SimpleUploadDialog } from '@/components/simple-upload-dialog';
import { VideoUploadDialog, type ClipTopicId } from '@/components/video-upload-dialog';
import { SubscribeDialog, type SubscribeIntent } from '@/components/subscribe-dialog';
import { UsageBadge } from '@/components/usage-badge';
import type { UserUsageStats } from '@/lib/user-usage-types';
import { cn } from '@/lib/utils';
import {
  notifyProjectIndexUpdate,
  PROJECT_INDEX_UPDATE_EVENT,
} from '@/lib/project-index';
import {
  MAX_ACTIVE_PROJECTS_PER_EXPERIENCE,
  MAX_PROJECTS_TOAST_DESCRIPTION,
} from '@/lib/project-limits';
import { saveProjectToApi } from '@/lib/project-api';
import { saveVideoBlob } from '@/lib/video-storage';
import { uploadVideoToS3 } from '@/lib/upload-video-s3';
import { toast } from '@/hooks/use-toast';

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
  const [activeProjectCount, setActiveProjectCount] = useState<number | null>(
    null
  );

  const refreshActiveProjectCount = useCallback(async () => {
    if (!experienceId) return;
    try {
      const res = await fetch(
        `/api/projects?experienceId=${encodeURIComponent(experienceId)}`
      );
      if (!res.ok) return;
      const list = (await res.json()) as unknown;
      setActiveProjectCount(Array.isArray(list) ? list.length : 0);
    } catch {
      setActiveProjectCount(null);
    }
  }, [experienceId]);

  useEffect(() => {
    void refreshActiveProjectCount();
  }, [refreshActiveProjectCount]);

  useEffect(() => {
    const onUpdate = () => void refreshActiveProjectCount();
    window.addEventListener(PROJECT_INDEX_UPDATE_EVENT, onUpdate);
    return () => {
      window.removeEventListener(PROJECT_INDEX_UPDATE_EVENT, onUpdate);
    };
  }, [refreshActiveProjectCount]);

  const guardNewProjectAllowed = useCallback((): boolean => {
    if (!hasAccess) return true;
    if (activeProjectCount === null) return true;
    return activeProjectCount < MAX_ACTIVE_PROJECTS_PER_EXPERIENCE;
  }, [hasAccess, activeProjectCount]);

  const toastProjectCap = useCallback(() => {
    toast({
      variant: 'destructive',
      description: MAX_PROJECTS_TOAST_DESCRIPTION,
    });
  }, []);

  const beforeOpenNewProject = useCallback((): boolean => {
    if (guardNewProjectAllowed()) return true;
    toastProjectCap();
    return false;
  }, [guardNewProjectAllowed, toastProjectCap]);

  const openLimitDialog = (intent: SubscribeIntent) => {
    setLimitDialogIntent(intent);
    setLimitDialogOpen(true);
  };

  const handleSingleVideoSelect = async (file: File) => {
    if (!guardNewProjectAllowed()) {
      toastProjectCap();
      return;
    }

    if (usageStats && usageStats.generateSubtitles.used >= usageStats.generateSubtitles.limit) {
      if (usageStats.accessLevel === 'basic') {
        openLimitDialog('upgrade_to_premium');
      } else {
        toast({
          variant: 'destructive',
          title: 'Upload limit',
          description:
            'You have used all Premium subtitle uploads for this month. Limits reset when your billing period rolls.',
        });
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
            toast({
              variant: 'destructive',
              title: 'Limit reached',
              description: error.error || 'Upload limit reached',
            });
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
      toast({
        variant: 'destructive',
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Failed to process video',
      });
    }
  };

  const handleBulkVideoSelect = async (file: File, topics: ClipTopicId[] = ['auto']) => {
    if (!guardNewProjectAllowed()) {
      toastProjectCap();
      return;
    }

    if (accessLevel === 'basic') {
      openLimitDialog('upgrade_to_premium');
      return;
    }

    if (
      usageStats &&
      usageStats.accessLevel === 'premium' &&
      usageStats.bulkGenerate.used >= usageStats.bulkGenerate.limit
    ) {
      toast({
        variant: 'destructive',
        title: 'Upload limit',
        description:
          'You have used all bulk uploads for this month. Limits reset when your billing period rolls.',
      });
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
            toast({
              variant: 'destructive',
              title: 'Limit reached',
              description: errData.error || 'Upload limit reached',
            });
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
      toast({
        variant: 'destructive',
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Failed to analyze video',
      });
    }
  };

  const handleYoutubeUrl = async (url: string, topics: ClipTopicId[] = ['auto']) => {
    if (!guardNewProjectAllowed()) {
      toastProjectCap();
      return;
    }

    if (accessLevel === 'basic') {
      openLimitDialog('upgrade_to_premium');
      return;
    }

    if (
      usageStats &&
      usageStats.accessLevel === 'premium' &&
      usageStats.bulkGenerate.used >= usageStats.bulkGenerate.limit
    ) {
      toast({
        variant: 'destructive',
        title: 'Upload limit',
        description:
          'You have used all bulk uploads for this month. Limits reset when your billing period rolls.',
      });
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
            toast({
              variant: 'destructive',
              title: 'Limit reached',
              description: data.error || 'Upload limit reached',
            });
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
      toast({
        variant: 'destructive',
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Failed to process video',
      });
    }
  };

  const handleGoogleDriveImport = () => {
    // TODO: Implement Google Drive import
    toast({
      title: 'Coming soon',
      description: 'Google Drive import is not available yet.',
    });
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
        'relative flex h-full cursor-pointer flex-col rounded-xl bg-muted/50 p-4 gap-8 transition-all hover:bg-muted hover:shadow-md'
      )}
    >
      <div className="flex justify-between">
			{props.icon}
			<span className="w-max-w mt-0">{props.footer}</span>
		</div>
      <div className="flex flex-col">
        <h3 className="text-5 font-medium text-foreground">{props.title}</h3>
        <p className="text-muted-foreground">{props.subtitle}</p>
      {/* <span className="w-max-w mt-0">{props.footer}</span> */}
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
          description="MP4 or MOV, max 5 minutes, max size 500MB (audio extracted for transcription)"
          subscriptionGate={subscriptionGate}
          beforeOpen={subscriptionGate ? undefined : beforeOpenNewProject}
          trigger={
            <button type="button" className="h-full w-full text-left">
              {cardContent({
                icon: (
                  <div className="flex items-center justify-center">
                    <Captions className="size-10 text-muted-foreground" />
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
          beforeOpen={
            subscriptionGate || bulkPremiumGate ? undefined : beforeOpenNewProject
          }
          trigger={
            <button type="button" className="h-full w-full text-left">
              {cardContent({
                icon: (
                  <div className="flex items-center justify-center">
                    <Layers className="size-10 text-muted-foreground" />
                  </div>
                ),
                title: 'Bulk Generate',
                subtitle: 'Long Form into Short Form',
                lockedPremium: accessLevel === 'basic' && hasAccess,
                footer:
                  usageStats && hasAccess && accessLevel === 'premium' ? (
                    <UsageBadge
                      label="Bulk"
                      used={usageStats.bulkGenerate.used}
                      limit={usageStats.bulkGenerate.limit}
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
