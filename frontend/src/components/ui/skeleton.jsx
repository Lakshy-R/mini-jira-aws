import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-md', className)}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-card/60 border border-white/[0.06] rounded-xl p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function KanbanColumnSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-card/60 border border-white/[0.06] rounded-2xl p-5 space-y-4">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}
