import { Skeleton } from "./misc";

export function ItemListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-2.5" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
          <Skeleton className="size-11 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
          <Skeleton className="hidden h-11 w-28 rounded-control sm:block" />
        </li>
      ))}
    </ul>
  );
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-8" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-18 w-full rounded-card" />
      <ItemListSkeleton />
    </div>
  );
}
