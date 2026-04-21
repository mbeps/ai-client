"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

interface ResourceListPageProps<T extends { id: string; updatedAt: Date }> {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  emptyStateMessage: string;
  action?: React.ReactNode;
  searchPlaceholder?: string;
  onMount?: () => void;
  filterFn?: (item: T, query: string) => boolean;
}

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
}: ResourceListPageProps<T>) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    onMount?.();
  }, [onMount]);

  const filtered = items.filter(
    (item) => !search || !filterFn || filterFn(item, search),
  );

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
      <div className="max-w-sm mb-6">
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
