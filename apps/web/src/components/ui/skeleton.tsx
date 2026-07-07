import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200', className)} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-label="正在加载">
      {Array.from({ length: rows }, (_, index) => (
        <div className="rounded-lg border border-slate-200 bg-white p-5" key={index}>
          <Skeleton className="mb-3 h-4 w-1/3" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
