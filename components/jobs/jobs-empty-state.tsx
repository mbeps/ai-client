"use client";

import { Activity } from "lucide-react";
import type { JobFilterTab } from "@/types/jobs";

const TAB_EMPTY_TITLES: Record<JobFilterTab, string> = {
  running: "No running jobs",
  queued: "No queued jobs",
  completed: "No completed jobs",
  failed: "No failed jobs",
  all: "No background jobs found",
};

const TAB_EMPTY_DESCRIPTIONS: Record<JobFilterTab, string> = {
  running: "There are currently no background jobs running.",
  queued: "There are currently no background jobs in queue.",
  completed: "There are no completed background jobs.",
  failed: "There are no failed or cancelled background jobs.",
  all: "There are no background jobs tracked by Inngest.",
};

/**
 * Resolves empty state content.
 *
 * @param activeTab - Target active tab
 * @param searchQuery - Target search query
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveEmptyStateContent(
  activeTab: JobFilterTab,
  searchQuery: string,
): { title: string; description: string } {
  if (searchQuery.trim()) {
    return {
      title: "No matching jobs found",
      description: `No jobs matched "${searchQuery}". Try a different search keyword.`,
    };
  }
  return {
    title: TAB_EMPTY_TITLES[activeTab],
    description: TAB_EMPTY_DESCRIPTIONS[activeTab],
  };
}

/**
 * Represents jobs empty state props.
 *
 * @author Maruf Bepary
 */
export interface JobsEmptyStateProps {
  activeTab: JobFilterTab;
  searchQuery: string;
}

/**
 * Empty state container rendering contextual text based on tab and search filters.
 */
export function JobsEmptyState({
  activeTab,
  searchQuery,
}: JobsEmptyStateProps) {
  const { title, description } = resolveEmptyStateContent(
    activeTab,
    searchQuery,
  );

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <div className="bg-muted rounded-full p-4">
        <Activity className="text-muted-foreground size-8" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        {description}
      </p>
    </div>
  );
}
