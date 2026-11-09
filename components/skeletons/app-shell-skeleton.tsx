import { Skeleton } from "@/components/ui/skeleton";

/**
 * Full application shell skeleton fallback for initial session hydration and root transitions.
 * Mimics the sidebar, top header bar, and content viewport of AuthenticatedLayout.
 *
 * @author Maruf Bepary
 */
export function AppShellSkeleton() {
  return (
    <div
      data-testid="app-shell-skeleton"
      className="bg-background flex h-dvh w-full overflow-hidden"
    >
      {/* Sidebar Rail Placeholder */}
      <aside className="border-sidebar-border bg-sidebar hidden w-64 shrink-0 flex-col border-r p-4 md:flex">
        <div className="flex items-center gap-3 py-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
        <div className="mt-auto pt-4">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Header Placeholder */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4 lg:h-[60px]">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-4 w-40" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
          </div>
        </header>

        {/* Content Viewport Placeholder */}
        <div className="flex-1 space-y-6 overflow-hidden p-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
