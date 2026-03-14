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
import { SubscribeDialog } from '@/components/subscribe-dialog';
import { cn } from '@/lib/utils';

interface VideoUploadDialogProps {
  onVideoSelect?: (file: File) => void;
  onYoutubeUrl?: (url: string) => void;
  onGoogleDriveImport?: () => void;
  onSampleVideoSelect?: () => void;
  trigger?: React.ReactNode;
  /** When set, the upload UI is replaced with a subscribe CTA that opens the tier dialog. */
  subscriptionGate?: { basicCheckoutUrl: string; premiumCheckoutUrl: string };
}

export function VideoUploadDialog({
  onVideoSelect,
  onYoutubeUrl,
  onGoogleDriveImport,
  onSampleVideoSelect,
  trigger,
  subscriptionGate,
}: VideoUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('video/')) {
          onVideoSelect?.(file);
          setOpen(false);
        }
      }
    },
    [onVideoSelect]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onVideoSelect?.(files[0]);
        setOpen(false);
      }
    },
    [onVideoSelect]
  );

  const handleYoutubeSubmit = useCallback(() => {
    if (youtubeUrl.trim()) {
      onYoutubeUrl?.(youtubeUrl.trim());
      setOpen(false);
    }
  }, [youtubeUrl, onYoutubeUrl]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Upload</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl font-semibold">Get viral clips</DialogTitle>
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
                  Choose a plan to bulk process videos and get viral clips.
                </p>
                <SubscribeDialog
                  basicCheckoutUrl={subscriptionGate.basicCheckoutUrl}
                  premiumCheckoutUrl={subscriptionGate.premiumCheckoutUrl}
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
              {/* Google Drive Button */}
              <Button
                variant="outline"
                className="mx-auto w-fit gap-2"
                onClick={onGoogleDriveImport}
              >
                <GoogleDriveIcon className="size-5" />
                Import from Google Drive
              </Button>

              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                )}
              >
                <div className="flex size-12 items-center justify-center rounded-lg bg-orange-50">
                  <Upload className="size-6 text-orange-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium">
                    Drop or{' '}
                    <button
                      type="button"
                      onClick={handleBrowseClick}
                      className="cursor-pointer underline underline-offset-2 hover:text-primary"
                    >
                      browse your video
                    </button>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    MP4 or MOV, Max duration: 120 min Max size: 10GB
                  </p>
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

function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}
