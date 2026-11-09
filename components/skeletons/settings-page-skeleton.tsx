import { PageContainer } from "@/components/shared/page-container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton screen for settings pages (/settings/app, /settings/providers, /settings/tools, /profile).
 * Matches PageHeader and stacked form/card settings layouts.
 *
 * @author Maruf Bepary
 */
export function SettingsPageSkeleton() {
  return (
    <PageContainer data-testid="settings-page-skeleton" className="space-y-6">
      {/* PageHeader Placeholder */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </div>
      </div>

      {/* Settings Form Card Placeholder */}
      <div className="border-border bg-card space-y-6 rounded-xl border p-6 shadow-xs">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-28 w-full rounded-md" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="space-y-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
        <div className="flex justify-end pt-4">
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>
    </PageContainer>
  );
}
