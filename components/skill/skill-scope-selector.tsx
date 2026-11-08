"use client";

import { Bot, FolderOpen, Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store/use-app-store";
import { cn } from "@/lib/utils";

/**
 * Scope option metadata for selectable cards.
 */
interface ScopeOption {
  value: "global" | "project" | "assistant";
  label: string;
  description: string;
  icon: typeof Globe;
}

const SCOPE_OPTIONS: ScopeOption[] = [
  {
    value: "global",
    label: "Global",
    description: "Available across all chats",
    icon: Globe,
  },
  {
    value: "project",
    label: "Project",
    description: "Scoped to a project",
    icon: FolderOpen,
  },
  {
    value: "assistant",
    label: "Assistant",
    description: "Scoped to an assistant",
    icon: Bot,
  },
];

/**
 * Props for the SkillScopeSelector component.
 *
 * @author Maruf Bepary
 */
export interface SkillScopeSelectorProps {
  scope: "global" | "project" | "assistant";
  onScopeChange: (scope: "global" | "project" | "assistant") => void;
  projectId?: string | null;
  onProjectIdChange: (id: string | null) => void;
  assistantId?: string | null;
  onAssistantIdChange: (id: string | null) => void;
  disabled?: boolean;
}

/**
 * Scope selector for configuring visibility and entity assignment (global, project, or assistant).
 *
 * @author Maruf Bepary
 */
export function SkillScopeSelector({
  scope,
  onScopeChange,
  projectId,
  onProjectIdChange,
  assistantId,
  onAssistantIdChange,
  disabled = false,
}: SkillScopeSelectorProps) {
  const projects = useAppStore((state) => state.projects);
  const assistants = useAppStore((state) => state.assistants);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs">
          Where this agent skill can be invoked.
        </p>
        <div
          role="radiogroup"
          aria-label="Scope Selection"
          className="grid grid-cols-3 gap-3"
        >
          {SCOPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = scope === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => {
                  onScopeChange(option.value);
                  if (option.value === "global") {
                    onProjectIdChange(null);
                    onAssistantIdChange(null);
                  }
                }}
                className={cn(
                  "group bg-card hover:bg-accent/40 relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-all sm:flex-row sm:justify-start sm:gap-3 sm:p-3 sm:text-left",
                  isSelected
                    ? "border-primary bg-primary/5 ring-primary shadow-xs ring-1"
                    : "border-border hover:border-border/80",
                  disabled && "pointer-events-none opacity-50",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                    isSelected
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-border bg-muted/50 text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm leading-none font-medium",
                      isSelected ? "text-primary" : "text-card-foreground",
                    )}
                  >
                    {option.label}
                  </p>
                  <p className="text-muted-foreground mt-1 hidden truncate text-xs sm:block">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {scope === "project" && (
        <div className="max-w-md pt-1">
          <label className="text-muted-foreground mb-1.5 block text-xs font-medium">
            Project
          </label>
          <Select
            disabled={disabled}
            value={projectId ?? ""}
            onValueChange={(val) => onProjectIdChange(val || null)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {scope === "assistant" && (
        <div className="max-w-md pt-1">
          <label className="text-muted-foreground mb-1.5 block text-xs font-medium">
            Assistant
          </label>
          <Select
            disabled={disabled}
            value={assistantId ?? ""}
            onValueChange={(val) => onAssistantIdChange(val || null)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select assistant" />
            </SelectTrigger>
            <SelectContent>
              {assistants.map((asst) => (
                <SelectItem key={asst.id} value={asst.id}>
                  {asst.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
