"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

interface ResourceListPageProps<T extends { id: string; updatedAt: Date }> {
  /** Leading icon for the page type. */
  icon: React.ReactNode;
  /** Page heading. */
  title: string;
  /** Brief description shown below the heading. */
  description: string;
  /** The full list of items to display. */
  items: T[];
  /** Function to render each item as a card. */
  renderCard: (item: T) => React.ReactNode;
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
}

/**
 * Standardised layout for resource listing pages (Chats, Projects, Assistants).
 * Handles search, sorting by updatedAt, and optional custom filtering.
 *
 * @author Maruf Bepary
 */
export function ResourceListPage<T extends { id: string; updatedAt: Date }>({
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
}: ResourceListPageProps<T>) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    onMount?.();
  }, [onMount]);

  const filtered = items.filter((item) => {
    const matchesSearch = !search || !filterFn || filterFn(item, search);
    const matchesCustom = !customFilterFn || customFilterFn(item);
    return matchesSearch && matchesCustom;
  });

  const sorted = [...filtered].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return (
    <div className="page-container">
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        action={action}
      />

      <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {extraFilters}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.length === 0 ? (
          <EmptyState message={emptyStateMessage} />
        ) : (
          sorted.map((item) => <div key={item.id}>{renderCard(item)}</div>)
        )}
      </div>
    </div>
  );
}
