"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PageContainer } from "@/components/shared/page-container";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { sortByUpdatedAt } from "@/lib/sort-by-updated-at";
import type { SortableResource } from "@/lib/sortable-resource";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Represents resource list page props.
 *
 * @author Maruf Bepary
 */
interface ResourceListPageProps<T extends SortableResource> {
  /** Leading icon for the page type. */
  icon: React.ReactNode;
  /** Page heading. */
  title: string;
  /** Brief description shown below the heading. */
  description: string;
  /** The full list of items to display. */
  items: T[];
  /** Function to render each item as a card. */
  renderCard?: (item: T) => React.ReactNode;
  /** Message to display when no items match the filters. */
  emptyStateMessage: string;
  /** Optional button or control placed in the header's action area. */
  action?: React.ReactNode;
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;
  /** Optional callback invoked when the component mounts. */
  onMount?: () => void;
  /** Function to filter items based on the search query. */
  filterFn?: (item: T, query: string) => boolean;
  /** Optional additional filter controls (e.g. Select dropdowns). */
  extraFilters?: React.ReactNode;
  /** Optional secondary filter function for custom logic. */
  customFilterFn?: (item: T) => boolean;
  /** Optional custom list renderer to override the default grid. */
  renderList?: (items: T[]) => React.ReactNode;
  /** Optional banner displayed at the top of the container. */
  banner?: React.ReactNode;
  /** Number of grid columns on desktop/tablet screens (defaults to 3). */
  columns?: 2 | 3;
  /** Optional custom sort function. If omitted, items are sorted by updatedAt descending. */
  sortFn?: (items: T[]) => T[];
  /** Whether data is currently loading. Renders skeleton card grid when true. */
  isLoading?: boolean;
}

/**
 * Standardised layout for resource listing pages (Chats, Projects, Assistants).
 * Handles search, sorting by updatedAt, and optional custom filtering.
 *
 */
export function ResourceListPage<T extends SortableResource>({
  icon,
  title,
  description,
  items,
  renderCard,
  emptyStateMessage,
  action,
  searchPlaceholder = "Search...",
  onMount,
  filterFn,
  extraFilters,
  customFilterFn,
  renderList,
  banner,
  columns = 3,
  sortFn,
  isLoading = false,
}: ResourceListPageProps<T>) {
  const [search, setSearch] = useState("");
  const loadError = useAppStore((state) => state.loadError);

  useEffect(() => {
    onMount?.();
  }, [onMount]);

  const filtered = items.filter((item) => {
    const matchesSearch = !search || !filterFn || filterFn(item, search);
    const matchesCustom = !customFilterFn || customFilterFn(item);
    return matchesSearch && matchesCustom;
  });

  const sorted = sortFn ? sortFn(filtered) : sortByUpdatedAt(filtered);
  const gridColsClass =
    columns === 2
      ? "grid grid-cols-1 gap-4 md:grid-cols-2"
      : "grid grid-cols-1 gap-4 md:grid-cols-3";

  return (
    <PageContainer className="space-y-6">
      {banner}
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        action={action}
      />

      <div className="mb-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {extraFilters}
      </div>

      {loadError && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          {loadError}
        </p>
      )}

      {isLoading ? (
        <div className={gridColsClass} data-testid="resource-list-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
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
      ) : sorted.length === 0 ? (
        <div className={gridColsClass}>
          <EmptyState message={emptyStateMessage} />
        </div>
      ) : renderList ? (
        renderList(sorted)
      ) : (
        <div className={gridColsClass}>
          {sorted.map((item) => (
            <div key={item.id}>{renderCard?.(item)}</div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
