import { Skeleton } from "@/components/ui/skeleton";

/**
 * Props for TableListSkeleton.
 *
 * @author Maruf Bepary
 */
interface TableListSkeletonProps {
  /** Number of row items to render. Defaults to 5. */
  rows?: number;
}

/**
 * Skeleton screen for table or list item layouts (Running Jobs, Sessions, Linked Accounts).
 * Replaces full spinners inside tables, lists, and LoadingSuspense containers.
 *
 * @author Maruf Bepary
 */
export function TableListSkeleton({ rows = 5 }: TableListSkeletonProps) {
  return (
    <div data-testid="table-list-skeleton" className="w-full space-y-4">
      {/* Controls Bar Placeholder */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-64 rounded-md" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      {/* Stacked Rows Placeholder */}
      <div className="border-border divide-border divide-y rounded-xl border">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="bg-card flex items-center justify-between p-4 first:rounded-t-xl last:rounded-b-xl"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
