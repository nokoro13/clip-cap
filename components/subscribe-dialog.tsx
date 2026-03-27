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

export type SubscribeIntent = 'subscribe' | 'upgrade_to_premium';

interface SubscribeDialogProps {
  basicCheckoutUrl?: string;
  premiumCheckoutUrl?: string;
  trigger?: React.ReactNode;
  className?: string;
  /** subscribe: new member. upgrade_to_premium: Basic user hitting limits or Bulk gate. */
  intent?: SubscribeIntent;
  /** Controlled open state (e.g. open when API returns 403). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SubscribeDialog({
  basicCheckoutUrl = DEFAULT_BASIC_CHECKOUT_URL,
  premiumCheckoutUrl = DEFAULT_PREMIUM_CHECKOUT_URL,
  trigger,
  className,
  intent = 'subscribe',
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: SubscribeDialogProps) {
  const isControlled = openProp !== undefined;
  const upgrade = intent === 'upgrade_to_premium';

  return (
    <Dialog
      {...(isControlled
        ? { open: openProp, onOpenChange: onOpenChangeProp }
        : {})}
    >
      {!isControlled ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="default" size="lg" className={cn('gap-2', className)}>
              <Sparkles className="size-4" />
              Subscribe to get access
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {upgrade ? 'Upgrade to Premium' : 'Choose your plan'}
          </DialogTitle>
          <DialogDescription>
            {upgrade ? (
              <>
                Get <strong>Bulk Generate</strong> (15 per month) and{' '}
                <strong>75 subtitle</strong> uploads per month. Basic includes 50 subtitle
                uploads and no bulk access.
              </>
            ) : (
              <>Subscribe to unlock video uploads, AI subtitles, and bulk generation.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <a
            href={basicCheckoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex flex-col gap-2 rounded-xl border border-border p-4 text-left transition-colors',
              upgrade
                ? 'bg-muted/20 opacity-90 hover:bg-muted/30'
                : 'bg-muted/30 hover:bg-muted/50 hover:border-primary/30'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">Basic Access</span>
              {!upgrade ? (
                <span className="text-sm text-muted-foreground">3 days free</span>
              ) : (
                <span className="text-xs font-medium text-muted-foreground">
                  Current tier
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {upgrade
                ? '50 AI subtitle uploads / month. Bulk Generate is not included.'
                : 'Then $19.99 per month. Perfect to get started.'}
            </p>
            <Button variant="secondary" className="w-full" size="sm">
              {upgrade ? 'Manage Basic' : 'Start free trial'}
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
                {upgrade ? 'Upgrade' : 'Best value'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              $29.99 per month. 75 subtitle + 15 bulk uploads per month.
            </p>
            <Button className="w-full" size="sm">
              {upgrade ? 'Upgrade to Premium' : 'Get Premium'}
            </Button>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
