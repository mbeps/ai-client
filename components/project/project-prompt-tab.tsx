"use client";

import {
  Ban,
  Globe,
  Loader2,
  Plus,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { PromptPicker } from "@/components/chat/prompt-picker";
import { PromptCard } from "@/components/prompt/prompt-card";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { Button } from "@/components/ui/button";
import { PROMPTS } from "@/config/prompts";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store/use-app-store";
import { cn } from "@/lib/utils";

/**
 * Represents project prompt tab props.
 *
 * @author Maruf Bepary
 */
export interface ProjectPromptTabProps {
  projectId?: string;
  globalPrompt: string;
  onGlobalPromptChange: (value: string) => void;
  promptMode?: "all" | "none" | "specific";
  onPromptModeChange?: (mode: "all" | "none" | "specific") => void;
  selectedPromptIds?: Set<string>;
  onTogglePromptId?: (id: string) => void;
  onSelectPromptIds?: (ids: Set<string>) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
}

interface ModeOption {
  value: "all" | "none" | "specific";
  title: string;
  description: string;
  icon: typeof Globe;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "all",
    title: "All Global Prompts (Default)",
    description:
      "All global prompt shortcuts are accessible inside this project's chats.",
    icon: Globe,
  },
  {
    value: "none",
    title: "Project Prompts Only",
    description:
      "Exclude all global prompts. Only shortcuts created specifically for this project are accessible.",
    icon: Ban,
  },
  {
    value: "specific",
    title: "Specific Global Prompts",
    description:
      "Allow only explicitly selected global prompts in addition to this project's shortcuts.",
    icon: SlidersHorizontal,
  },
];

/**
 * Global system prompt editor and prompt controls tab for a Project.
 *
 * @author Maruf Bepary
 */
export function ProjectPromptTab({
  projectId,
  globalPrompt,
  onGlobalPromptChange,
  promptMode = "all",
  onPromptModeChange,
  selectedPromptIds = new Set(),
  onTogglePromptId,
  onSelectPromptIds,
  onSave,
  isSaving = false,
}: ProjectPromptTabProps) {
  const prompts = useAppStore((state) => state.prompts);

  const globalPrompts = useMemo(
    () =>
      prompts.filter(
        (p) =>
          (!p.projectIds || p.projectIds.length === 0) &&
          (!p.assistantIds || p.assistantIds.length === 0),
      ),
    [prompts],
  );

  const projectShortcuts = useMemo(
    () =>
      projectId ? prompts.filter((p) => p.projectIds?.includes(projectId)) : [],
    [prompts, projectId],
  );

  return (
    <div className="space-y-8">
      {/* 1. Global System Instructions */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Global System Prompt</h3>
          <p className="text-muted-foreground text-sm">
            Instructions injected as system prompts for all chats within this
            project.
          </p>
        </div>
        <MarkdownTabEditor
          value={globalPrompt}
          onChange={onGlobalPromptChange}
          placeholder={
            PROMPTS.UI.EXAMPLES.PROJECT_GLOBAL_PROMPT_PLACEHOLDER_EDIT
          }
          minHeight="min-h-[260px]"
        />
      </div>

      {/* 2. Global Prompt Controls */}
      {onPromptModeChange && (
        <div className="space-y-4 border-t pt-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Global Prompt Shortcuts</h3>
            <p className="text-muted-foreground text-sm">
              Control which global slash-command shortcuts are accessible in
              chats under this project.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = promptMode === option.value;

              return (
                <div
                  key={option.value}
                  onClick={() => onPromptModeChange(option.value)}
                  className={cn(
                    "group bg-card hover:bg-accent/40 relative flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border",
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                          isSelected
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-border bg-muted/50 text-muted-foreground group-hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm leading-tight font-medium">
                        {option.title}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {option.description}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-end">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isSelected ? "bg-primary" : "bg-transparent",
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {promptMode === "specific" && (
            <div className="space-y-3 pt-2">
              <div className="space-y-0.5">
                <h4 className="text-sm font-medium">
                  Select Allowed Global Prompts
                </h4>
                <p className="text-muted-foreground text-xs">
                  Only the checked global prompts will be available in this
                  project.
                </p>
              </div>
              <div className="bg-card flex max-h-[400px] flex-col overflow-hidden rounded-md border p-4">
                <PromptPicker
                  prompts={globalPrompts}
                  selectedPromptIds={selectedPromptIds}
                  onTogglePrompt={(item) => onTogglePromptId?.(item.id)}
                  onSelectAll={(items) =>
                    onSelectPromptIds?.(new Set(items.map((i) => i.id)))
                  }
                  onClearAll={() => onSelectPromptIds?.(new Set())}
                  maxHeight="320px"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Project-Specific Prompt Shortcuts */}
      {projectId && (
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-lg font-semibold">Project Shortcuts</h3>
              <p className="text-muted-foreground text-sm">
                Prompts created exclusively for this project.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link
                href={`${ROUTES.SETTINGS.PROMPTS.new}?projectId=${projectId}`}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Shortcut
              </Link>
            </Button>
          </div>

          {projectShortcuts.length === 0 ? (
            <div className="bg-muted/20 rounded-lg border border-dashed p-6 text-center">
              <p className="text-muted-foreground text-xs">
                No project-specific shortcuts yet. Create one to define a
                shortcut accessible only in this project.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {projectShortcuts.map((p) => (
                <PromptCard key={p.id} prompt={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Unified Save Button */}
      <div className="border-t pt-4">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
