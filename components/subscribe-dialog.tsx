'use client';

import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEFAULT_BASIC_CHECKOUT_URL = 'https://whop.com/checkout/plan_xtThkvdruzGaa';
const DEFAULT_PREMIUM_CHECKOUT_URL = 'https://whop.com/checkout/plan_OHjnjQ68gcbct';

interface SubscribeDialogProps {
  basicCheckoutUrl?: string;
  premiumCheckoutUrl?: string;
  trigger?: React.ReactNode;
  className?: string;
}

export function SubscribeDialog({
  basicCheckoutUrl = DEFAULT_BASIC_CHECKOUT_URL,
  premiumCheckoutUrl = DEFAULT_PREMIUM_CHECKOUT_URL,
  trigger,
  className,
}: SubscribeDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="default" size="lg" className={cn('gap-2', className)}>
            <Sparkles className="size-4" />
            Subscribe to get access
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your plan</DialogTitle>
          <DialogDescription>
            Subscribe to unlock video uploads, AI subtitles, and bulk generation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <a
            href={basicCheckoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 text-left transition-colors hover:bg-muted/50 hover:border-primary/30"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">Basic Access</span>
              <span className="text-sm text-muted-foreground">3 days free</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Then $19.99 per month. Perfect to get started.
            </p>
            <Button variant="secondary" className="w-full" size="sm">
              Start free trial
            </Button>
          </a>
          <a
            href={premiumCheckoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-2 rounded-xl border-2 border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">Premium Access</span>
              <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                Best value
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              $29.99 per month. Full access to all features.
            </p>
            <Button className="w-full" size="sm">
              Get Premium
            </Button>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
