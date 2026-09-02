"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { type SortableResource, sortByUpdatedAt } from "@/lib/utils";

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

  const sorted = sortByUpdatedAt(filtered);

  return (
    <div className="page-container">
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        action={action}
      />

      <div className="mb-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
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
        <p role="alert" className="mb-4 text-destructive text-sm">
          {loadError}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <EmptyState message={emptyStateMessage} />
        </div>
      ) : renderList ? (
        renderList(sorted)
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {sorted.map((item) => (
            <div key={item.id}>{renderCard?.(item)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
