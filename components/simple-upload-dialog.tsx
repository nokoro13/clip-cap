'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SimpleUploadDialogProps {
  onVideoSelect?: (file: File) => void;
  trigger?: React.ReactNode;
  title?: string;
  description?: string;
}

export function SimpleUploadDialog({
  onVideoSelect,
  trigger,
  title = 'Upload Video',
  description = 'MP4 or MOV, Max duration: 120 min, Max size: 10GB',
}: SimpleUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button>Upload</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
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
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
