"use client";

import { RefreshCw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { JobFilterTab } from "@/types/jobs";

/**
 * Represents jobs search bar props.
 *
 * @author Maruf Bepary
 */
interface JobsSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Renders the jobs search bar component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function JobsSearchBar({ value, onChange }: JobsSearchBarProps) {
  return (
    <div className="relative flex-1 sm:max-w-md">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        placeholder="Search jobs by title, type, or function..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pr-8 pl-9 text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Represents jobs controls bar props.
 *
 * @author Maruf Bepary
 */
export interface JobsControlsBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeTab: JobFilterTab;
  totalJobs: number;
  onShowAll: () => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
}

/**
 * Search input, tab context, and auto-refresh switch bar.
 */
export function JobsControlsBar({
  searchQuery,
  onSearchChange,
  activeTab,
  totalJobs,
  onShowAll,
  autoRefresh,
  onAutoRefreshChange,
  onRefresh,
  loading,
}: JobsControlsBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <JobsSearchBar value={searchQuery} onChange={onSearchChange} />

      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
        {activeTab !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowAll}
            className="text-muted-foreground hover:text-foreground h-8 text-xs"
          >
            Show all
            {totalJobs > 0 && (
              <Badge
                variant="secondary"
                className="ml-1.5 px-1.5 py-0 font-mono text-[10px] tabular-nums"
              >
                {totalJobs}
              </Badge>
            )}
          </Button>
        )}

        <div className="bg-card/60 flex h-8 items-center gap-2 rounded-md border px-2.5">
          <span
            className={cn(
              "size-1.5 rounded-full transition-colors",
              autoRefresh ? "bg-emerald-500" : "bg-muted-foreground/40",
            )}
          />
          <Switch
            id="auto-refresh-toggle"
            checked={autoRefresh}
            onCheckedChange={onAutoRefreshChange}
          />
          <Label
            htmlFor="auto-refresh-toggle"
            className="cursor-pointer text-xs select-none"
          >
            Auto-refresh
          </Label>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw
            className={cn("mr-1.5 size-3.5", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>
    </div>
  );
}
