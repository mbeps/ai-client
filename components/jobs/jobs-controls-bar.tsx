"use client";

import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { JobFilterTab } from "@/types/jobs";

interface JobsSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

function JobsSearchBar({ value, onChange }: JobsSearchBarProps) {
  return (
    <div className="relative flex-1 sm:max-w-md">
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        placeholder="Search jobs by title, type, or function..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

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

      <div className="flex items-center gap-3 self-end sm:self-auto">
        {activeTab !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onShowAll}
            className="text-muted-foreground hover:text-foreground h-8 text-xs"
          >
            Show all ({totalJobs})
          </Button>
        )}

        <div className="flex items-center space-x-2">
          <Switch
            id="auto-refresh-toggle"
            checked={autoRefresh}
            onCheckedChange={onAutoRefreshChange}
          />
          <Label
            htmlFor="auto-refresh-toggle"
            className="cursor-pointer text-xs"
          >
            Auto-refresh
          </Label>
        </div>

        <Button
          variant="outline"
          size="sm"
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
