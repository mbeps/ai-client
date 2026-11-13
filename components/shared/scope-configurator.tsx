"use client";

import { Bot, FolderOpen, Globe, SlidersHorizontal } from "lucide-react";
import * as React from "react";
import {
  EntityMultiSelect,
  type EntitySelectItem,
} from "@/components/shared/entity-multi-select";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store/use-app-store";
import { cn } from "@/lib/utils";

export interface ScopeConfiguratorProps {
  projectIds: string[];
  onProjectIdsChange: (ids: string[]) => void;
  assistantIds: string[];
  onAssistantIdsChange: (ids: string[]) => void;
  disabled?: boolean;
  projects?: EntitySelectItem[];
  assistants?: EntitySelectItem[];
  className?: string;
}

/**
 * Unified scope configuration component allowing selection of Global availability
 * or multi-entity scoping across both projects and assistants simultaneously.
 *
 * @author Maruf Bepary
 */
export function ScopeConfigurator({
  projectIds,
  onProjectIdsChange,
  assistantIds,
  onAssistantIdsChange,
  disabled = false,
  projects: customProjects,
  assistants: customAssistants,
  className,
}: ScopeConfiguratorProps) {
  const storeProjects = useAppStore((state) => state.projects);
  const storeAgents = useAppStore((state) => state.agents);

  const projects = customProjects ?? storeProjects;
  const assistants = customAssistants ?? storeAgents;

  const isInitiallyScoped = projectIds.length > 0 || assistantIds.length > 0;
  const [mode, setMode] = React.useState<"global" | "scoped">(
    isInitiallyScoped ? "scoped" : "global",
  );

  // Sync mode if external IDs change to non-empty
  React.useEffect(() => {
    if (projectIds.length > 0 || assistantIds.length > 0) {
      setMode("scoped");
    }
  }, [projectIds.length, assistantIds.length]);

  const handleSelectMode = (newMode: "global" | "scoped") => {
    setMode(newMode);
    if (newMode === "global") {
      onProjectIdsChange([]);
      onAssistantIdsChange([]);
    }
  };

  const hasSelections = projectIds.length > 0 || assistantIds.length > 0;

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Control where this resource can be invoked.
        </p>
        <div
          role="radiogroup"
          aria-label="Scope Mode Selection"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "global"}
            disabled={disabled}
            onClick={() => handleSelectMode("global")}
            className={cn(
              "group bg-card hover:bg-accent/40 relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition-all",
              mode === "global"
                ? "border-primary bg-primary/5 ring-primary shadow-xs ring-1"
                : "border-border hover:border-border/80",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                mode === "global"
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground group-hover:text-foreground",
              )}
            >
              <Globe className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm leading-none font-medium",
                  mode === "global" ? "text-primary" : "text-card-foreground",
                )}
              >
                Global
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Available across all chats and workspaces.
              </p>
            </div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={mode === "scoped"}
            disabled={disabled}
            onClick={() => handleSelectMode("scoped")}
            className={cn(
              "group bg-card hover:bg-accent/40 relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition-all",
              mode === "scoped"
                ? "border-primary bg-primary/5 ring-primary shadow-xs ring-1"
                : "border-border hover:border-border/80",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                mode === "scoped"
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground group-hover:text-foreground",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "text-sm leading-none font-medium",
                    mode === "scoped" ? "text-primary" : "text-card-foreground",
                  )}
                >
                  Scoped
                </p>
                {hasSelections && (
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {projectIds.length + assistantIds.length} active
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Restricted to specific projects and/or agents.
              </p>
            </div>
          </button>
        </div>
      </div>

      {mode === "scoped" && (
        <div className="bg-card/40 animate-in fade-in-50 space-y-5 rounded-lg border p-4 duration-200">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">Projects</span>
              </div>
              {projectIds.length > 0 && (
                <span className="text-muted-foreground text-xs">
                  {projectIds.length} selected
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Select projects where this can be invoked.
            </p>
            <EntityMultiSelect
              items={projects}
              selectedIds={projectIds}
              onChange={onProjectIdsChange}
              placeholder="Select projects..."
              searchPlaceholder="Search projects..."
              emptyMessage="No projects available."
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">Agents</span>
              </div>
              {assistantIds.length > 0 && (
                <span className="text-muted-foreground text-xs">
                  {assistantIds.length} selected
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Select agents where this can be invoked.
            </p>
            <EntityMultiSelect
              items={assistants}
              selectedIds={assistantIds}
              onChange={onAssistantIdsChange}
              placeholder="Select agents..."
              searchPlaceholder="Search agents..."
              emptyMessage="No agents available."
              disabled={disabled}
            />
          </div>

          {!hasSelections && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Tip: Select at least one project or agent above, or switch to
              Global to make it available everywhere.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
