import { PageContainer } from "@/components/shared/page-container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton screen for entity detail, edit, and creator pages.
 * Accurately replicates EntityDetailHeader (avatar icon, titles, action) and form/tab layouts.
 *
 * @author Maruf Bepary
 */
export function EntityDetailSkeleton() {
  return (
    <PageContainer data-testid="entity-detail-skeleton" className="space-y-6">
      {/* EntityDetailHeader Placeholder */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Tabs Placeholder */}
      <div className="flex gap-2 border-b pb-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Form Content Card Placeholder */}
      <div className="border-border bg-card space-y-6 rounded-xl border p-6 shadow-xs">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </PageContainer>
  );
}
