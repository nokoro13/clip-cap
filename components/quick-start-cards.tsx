'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Captions, Layers, Loader2 } from 'lucide-react';
import { SimpleUploadDialog } from '@/components/simple-upload-dialog';
import { VideoUploadDialog } from '@/components/video-upload-dialog';
import { cn } from '@/lib/utils';
import { addProjectToIndex } from '@/lib/project-index';
import { saveVideoBlob } from '@/lib/video-storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface QuickStartCardsProps {
  className?: string;
}

export function QuickStartCards({ className }: QuickStartCardsProps) {
  const router = useRouter();
  const params = useParams();
  const experienceId = params.experienceId as string;

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  const handleSingleVideoSelect = async (file: File) => {
    setIsProcessing(true);
    setProcessingMessage('Transcribing video with AI...');

    try {
      // Create form data for transcription
      const formData = new FormData();
      formData.append('file', file);

      // Call transcribe API
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to transcribe video');
      }

      const { captions, segmentCaptions, duration } = await response.json();

      // Create a blob URL for the video
      const blobUrl = URL.createObjectURL(file);

      // Generate project ID
      const projectId = `editor-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Store project data in localStorage (for captions)
      const projectData = {
        captions, // Word-level captions
        segmentCaptions, // Segment captions with word timings for highlighting
        duration,
        title: file.name,
        experienceId, // Store the experience ID for navigation back
      };
      localStorage.setItem(`project-${projectId}`, JSON.stringify(projectData));

      // Store the blob URL in sessionStorage (survives client-side navigation)
      sessionStorage.setItem(`video-${projectId}`, blobUrl);
      // Persist video in IndexedDB so it survives page refresh
      await saveVideoBlob(projectId, file);

      addProjectToIndex(experienceId, {
        id: projectId,
        title: file.name,
        type: 'editor',
        duration,
      });

      // Navigate to editor
      router.push(`/editor/${projectId}`);
    } catch (error) {
      console.error('Error processing video:', error);
      alert(error instanceof Error ? error.message : 'Failed to process video');
      setIsProcessing(false);
    }
  };

  const handleBulkVideoSelect = async (file: File) => {
    setIsProcessing(true);
    setProcessingMessage('Analyzing video for viral moments...');

    try {
      // Create form data for viral analysis
      const formData = new FormData();
      formData.append('file', file);

      // Call analyze-viral API
      const response = await fetch('/api/analyze-viral', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze video');
      }

      const { captions, segmentCaptions, clips, duration, fullTranscript } = await response.json();

      // Create a blob URL for the video
      const blobUrl = URL.createObjectURL(file);

      // Generate project ID
      const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Store project data (without videoUrl since blob URLs don't persist)
      const projectData = {
        id: projectId,
        title: file.name,
        videoUrl: '', // Will be loaded from sessionStorage
        thumbnailUrl: '',
        duration: duration,
        captions, // Word-level captions
        segmentCaptions, // Segment captions with word timings
        clips: clips.map((clip: { id: string; title: string; startMs: number; endMs: number; viralityScore: number; reason?: string; transcript: string }) => ({
          ...clip,
          status: 'all',
        })),
        fullTranscript,
        status: 'completed',
        createdAt: Date.now(),
        experienceId, // Store the experience ID for navigation back
      };

      localStorage.setItem(`project-${projectId}`, JSON.stringify(projectData));

      // Store the blob URL in sessionStorage (persists across client-side navigation)
      sessionStorage.setItem(`video-${projectId}`, blobUrl);
      // Persist video in IndexedDB so it survives page refresh
      await saveVideoBlob(projectId, file);

      addProjectToIndex(experienceId, {
        id: projectId,
        title: file.name,
        type: 'project',
        duration: typeof duration === 'number' ? duration : 0,
        clipsCount: clips?.length ?? 0,
      });

      // Navigate to gallery
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error('Error analyzing video:', error);
      alert(error instanceof Error ? error.message : 'Failed to analyze video');
      setIsProcessing(false);
    }
  };

  const handleYoutubeUrl = (url: string) => {
    setIsProcessing(true);
    setProcessingMessage('Processing YouTube video...');

    // Generate project ID
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Navigate to projects page with YouTube URL - processing will happen there
    router.push(`/projects/${projectId}?youtubeUrl=${encodeURIComponent(url)}`);
  };

  const handleGoogleDriveImport = () => {
    // TODO: Implement Google Drive import
    alert('Google Drive import coming soon!');
  };

  const handleSampleVideoSelect = () => {
    // Use a sample YouTube URL for demonstration
    handleYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  };

  return (
    <>
      <div className={cn('space-y-4', className)}>
        <h2 className="text-sm font-medium text-muted-foreground">Quick start</h2>

        <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-2xl">
          {/* Generate Subtitles Card */}
          <SimpleUploadDialog
            onVideoSelect={handleSingleVideoSelect}
            title="Generate Subtitles"
            description="MP4 or MOV, Max size: 25MB for transcription"
            trigger={
              <button type="button" className="h-full w-full text-left">
                <div
                  className={cn(
                    'flex h-full cursor-pointer flex-col items-center justify-center gap-4 rounded-xl bg-muted/50 p-6 transition-all',
                    'hover:bg-muted hover:shadow-md'
                  )}
                >
                  <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100">
                    <Captions className="size-10 text-violet-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-semibold">Generate Subtitles</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Get trendy AI captions in just one click
                    </p>
                  </div>
                </div>
              </button>
            }
          />

          {/* Bulk Generate Card */}
          <VideoUploadDialog
            onVideoSelect={handleBulkVideoSelect}
            onYoutubeUrl={handleYoutubeUrl}
            onGoogleDriveImport={handleGoogleDriveImport}
            onSampleVideoSelect={handleSampleVideoSelect}
            trigger={
              <button type="button" className="h-full w-full text-left">
                <div
                  className={cn(
                    'flex h-full cursor-pointer flex-col items-center justify-center gap-4 rounded-xl bg-muted/50 p-6 transition-all',
                    'hover:bg-muted hover:shadow-md'
                  )}
                >
                  <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100">
                    <Layers className="size-10 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-semibold">Bulk Generate</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Process multiple videos or YouTube links
                    </p>
                  </div>
                </div>
              </button>
            }
          />
        </div>
      </div>

      {/* Processing Modal */}
      <Dialog open={isProcessing} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="flex flex-col items-center gap-4">
              <Loader2 className="size-10 animate-spin text-primary" />
              <span>Processing Your Video</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-muted-foreground">{processingMessage}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
