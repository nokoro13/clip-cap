import { cn } from '@/lib/utils';

export function UsageBadge({
  label,
  used,
  limit,
  className,
}: {
  label?: string;
  used: number;
  limit: number;
  className?: string;
}) {
  const atLimit = limit > 0 && used >= limit;
  return (
    <p
      className={cn(
        'text-xs text-muted-foreground',
        atLimit && 'font-medium text-amber-700 dark:text-amber-400',
        className
      )}
    >
      {label ? `${label}: ` : ''}
      {used}/{limit} this month
    </p>
  );
}
