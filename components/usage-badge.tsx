import { cn } from '@/lib/utils';
import { Badge } from '@whop/react/components';

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
	<Badge
		variant="soft" color="gray" size="1"
	>
    <p
      className={cn(
        'text-xs text-muted-foreground tabular-nums',
        atLimit && 'font-medium text-amber-700 dark:text-amber-400',
        className
      )}
    >
      {used}/{limit}
    </p>
	 </Badge>
  );
}
