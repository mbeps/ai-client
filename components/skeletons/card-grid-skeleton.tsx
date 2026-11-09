import { PageContainer } from "@/components/shared/page-container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Props for CardGridSkeleton.
 *
 * @author Maruf Bepary
 */
interface CardGridSkeletonProps {
  /** Number of skeleton cards to render. Defaults to 6. */
  count?: number;
  /** Number of grid columns on desktop screens. Defaults to 3. */
  columns?: 2 | 3;
}

/**
 * Content-aware skeleton screen for resource list pages (Chats, Projects, Assistants, Knowledgebases).
 * Mirrors PageHeader, search bar, and card grid layout to prevent layout shift during streaming.
 *
 * @author Maruf Bepary
 */
export function CardGridSkeleton({
  count = 6,
  columns = 3,
}: CardGridSkeletonProps) {
  const gridColsClass =
    columns === 2
      ? "grid grid-cols-1 gap-4 md:grid-cols-2"
      : "grid grid-cols-1 gap-4 md:grid-cols-3";

  return (
    <PageContainer data-testid="card-grid-skeleton" className="space-y-6">
      {/* PageHeader Placeholder */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Search Input Bar Placeholder */}
      <div className="mb-6 flex items-center">
        <Skeleton className="h-10 w-full rounded-md sm:max-w-xs" />
      </div>

      {/* Card Grid Placeholder */}
      <div className={gridColsClass}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="border-border bg-card flex flex-col justify-between space-y-4 rounded-xl border p-5 shadow-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 shrink-0 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="size-6 rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
            <div className="border-border/50 flex items-center justify-between border-t pt-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
