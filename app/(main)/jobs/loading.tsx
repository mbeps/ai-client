import { PageContainer } from "@/components/shared/page-container";
import { TableListSkeleton } from "@/components/skeletons/table-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Streaming loading fallback for background jobs page (/jobs).
 *
 * @author Maruf Bepary
 */
export default function JobsLoading() {
  return (
    <PageContainer className="space-y-6">
      {/* PageHeader Placeholder */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
      </div>
      <TableListSkeleton rows={5} />
    </PageContainer>
  );
}
