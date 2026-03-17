'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Captions, Layers, ExternalLink, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import {
  getProjectIndex,
  type ProjectIndexEntry,
  PROJECT_INDEX_UPDATE_EVENT,
} from '@/lib/project-index';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { deleteProject } from '@/lib/delete-project';

const PROJECT_INDEX_KEY_PREFIX = 'clipcap-projects-';

interface RecentProjectsGalleryProps {
  experienceId: string;
  className?: string;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 3) + '...';
}

export function RecentProjectsGallery({ experienceId, className }: RecentProjectsGalleryProps) {
  const [entries, setEntries] = useState<ProjectIndexEntry[]>([]);
  const [mounted, setMounted] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (typeof window === 'undefined') return;
    const list = getProjectIndex(experienceId);
    setEntries(list);
  }, [experienceId]);

  const handleDelete = useCallback(async (projectId: string) => {
    setDeletingId(projectId);
    try {
      await deleteProject(experienceId, projectId);
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }, [experienceId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !experienceId) return;
    refresh();
  }, [mounted, experienceId, refresh]);

  useEffect(() => {
    if (!mounted) return;
    const key = `${PROJECT_INDEX_KEY_PREFIX}${experienceId}`;
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) refresh();
    };
    const onIndexUpdate = () => refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener(PROJECT_INDEX_UPDATE_EVENT, onIndexUpdate);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PROJECT_INDEX_UPDATE_EVENT, onIndexUpdate);
    };
  }, [mounted, experienceId, refresh]);

  if (!mounted) {
    return (
      <div className={cn('space-y-4', className)}>
        <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          <div className="aspect-[16/11] rounded-xl bg-muted/50" />
          <div className="aspect-[16/11] rounded-xl bg-muted/50" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-muted/30 px-6 py-8 text-center text-sm text-muted-foreground">
          No recent projects. Create one with Generate Subtitles or Bulk Generate above.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {entries.map((entry) => {
            const href = entry.type === 'editor' ? `/editor/${entry.id}` : `/projects/${entry.id}`;
            const label = entry.type === 'editor' ? 'Subtitles' : 'Bulk';
            const Icon = entry.type === 'editor' ? Captions : Layers;
            const isProcessing = entry.status === 'processing';
            const isError = entry.status === 'error';

            return (
              <Card
                key={entry.id}
                className={cn(
                  'flex min-h-0 w-full flex-col overflow-hidden transition-shadow hover:shadow-md',
                  isProcessing && 'border-primary/30',
                  isError && 'border-destructive/30'
                )}
              >
                <div
                  className={cn(
                    'flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-t-xl border-b px-4',
                    isProcessing && 'bg-primary/5',
                    isError && 'bg-destructive/5',
                    !isProcessing && !isError && 'bg-muted/50'
                  )}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="size-10 animate-spin text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {entry.progress != null ? `${entry.progress}%` : 'Processing...'}
                      </span>
                    </>
                  ) : isError ? (
                    <AlertCircle className="size-10 text-destructive" />
                  ) : (
                    <Icon className="size-10 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="flex flex-1 flex-col px-4">
                  <p className="truncate text-sm font-medium" title={entry.title}>
                    {truncateTitle(entry.title, 28)}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {isProcessing ? (
                      <span>Processing...</span>
                    ) : isError ? (
                      <span className="text-destructive">Failed</span>
                    ) : (
                      <>
                        <span>{label}</span>
                        {entry.duration != null && entry.duration > 0 && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{formatDuration(entry.duration)}</span>
                          </>
                        )}
                        {entry.type === 'project' && entry.clipsCount != null && entry.clipsCount > 0 && (
                          <>
                            <span aria-hidden>·</span>
                            <span>{entry.clipsCount} clips</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {isProcessing && entry.progress != null && (
                    <Progress value={entry.progress} className="mt-2 h-1.5" />
                  )}
                </CardContent>
                <CardFooter className="flex-col gap-2 pb-4 px-4">
                  {isProcessing || isError ? (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      {isProcessing ? 'Processing...' : 'Failed'}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link href={href}>
                        <ExternalLink className="mr-1.5 size-3.5" />
                        Open
                      </Link>
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingId === entry.id}
                      >
                        {deletingId === entry.id ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1.5 size-3.5" />
                        )}
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete project?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{truncateTitle(entry.title, 50)}" and remove
                          all associated files. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(entry.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
