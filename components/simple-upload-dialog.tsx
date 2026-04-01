'use client';

import { useState, useRef, useCallback } from 'react';
import { Lock, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SubscribeDialog, type SubscribeIntent } from '@/components/subscribe-dialog';
import { cn } from '@/lib/utils';
import { probeVideoFileDurationSeconds } from '@/lib/get-video-duration-browser';
import {
  describeMaxVideoDuration,
  GENERATE_SUBTITLES_MAX_DURATION_SEC,
} from '@/lib/video-upload-limits';
import { toast } from '@/hooks/use-toast';

interface SimpleUploadDialogProps {
  onVideoSelect?: (file: File) => void;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
  /** Reject files longer than this many seconds (inclusive limit). */
  maxDurationSeconds?: number;
  /** When set, the drop zone is replaced with a subscribe CTA that opens the tier dialog. */
  subscriptionGate?: {
    basicCheckoutUrl: string;
    premiumCheckoutUrl: string;
    intent?: SubscribeIntent;
  };
  /** If opening and this returns false, the dialog stays closed (e.g. project cap). */
  beforeOpen?: () => boolean;
}

export function SimpleUploadDialog({
  onVideoSelect,
  trigger,
  title = 'Upload Video',
  description,
  maxDurationSeconds = GENERATE_SUBTITLES_MAX_DURATION_SEC,
  subscriptionGate,
  beforeOpen,
}: SimpleUploadDialogProps) {
  const resolvedDescription =
    description ??
    `MP4 or MOV, max ${describeMaxVideoDuration(maxDurationSeconds)}, max size 10GB`;
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showSubscribeInstead = Boolean(subscriptionGate);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const acceptFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('video/')) return;
      if (maxDurationSeconds > 0) {
        const seconds = await probeVideoFileDurationSeconds(file);
        if (seconds == null) {
          toast({
            variant: 'destructive',
            title: 'Could not read video',
            description: 'Try another file or format.',
          });
          return;
        }
        if (seconds > maxDurationSeconds + 0.5) {
          toast({
            variant: 'destructive',
            title: 'Video too long',
            description: `Maximum length is ${describeMaxVideoDuration(maxDurationSeconds)} (${Math.ceil(seconds / 60)} min detected).`,
          });
          return;
        }
      }
      onVideoSelect?.(file);
      setOpen(false);
    },
    [onVideoSelect, maxDurationSeconds]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        void acceptFile(files[0]);
      }
    },
    [acceptFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        void acceptFile(files[0]);
      }
      e.target.value = '';
    },
    [acceptFile]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next && beforeOpen && !beforeOpen()) {
        return;
      }
      setOpen(next);
    },
    [beforeOpen]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button>Upload</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {showSubscribeInstead && subscriptionGate ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 px-6 py-12">
              <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
                <Lock className="size-7 text-amber-600 dark:text-amber-500" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">Subscribe to unlock</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose a plan to upload videos and generate subtitles.
                </p>
                <SubscribeDialog
                  basicCheckoutUrl={subscriptionGate.basicCheckoutUrl}
                  premiumCheckoutUrl={subscriptionGate.premiumCheckoutUrl}
                  intent={subscriptionGate.intent}
                  trigger={
                    <Button variant="default" size="lg" className="mt-4">
                      Choose a plan
                    </Button>
                  }
                />
              </div>
            </div>
          ) : (
            <>
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-6 py-12 transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                )}
              >
                <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="size-7 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium">
                    Drop or{' '}
                    <button
                      type="button"
                      onClick={handleBrowseClick}
                      className="cursor-pointer text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      browse your video
                    </button>
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{resolvedDescription}</p>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/mov"
                onChange={handleFileSelect}
                className="hidden"
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
