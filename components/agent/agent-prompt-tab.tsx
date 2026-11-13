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
 * Props for the AgentPromptTab component.
 */
export interface AgentPromptTabProps {
  agentId?: string;
  prompt: string;
  onPromptChange: (value: string) => void;
  subagentPrompt: string;
  onSubagentPromptChange: (value: string) => void;
  promptMode?: "all" | "none" | "specific";
  onPromptModeChange?: (mode: "all" | "none" | "specific") => void;
  selectedPromptIds?: Set<string>;
  onTogglePromptId?: (id: string) => void;
  onSelectPromptIds?: (ids: Set<string>) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
  saveLabel?: string;
  disabled?: boolean;
}

const MODE_OPTIONS = [
  {
    value: "all" as const,
    title: "All Global Prompts (Default)",
    description:
      "All global prompt shortcuts are accessible inside chats with this agent.",
    icon: Globe,
  },
  {
    value: "none" as const,
    title: "Agent Prompts Only",
    description:
      "Exclude all global prompts. Only shortcuts created specifically for this agent are accessible.",
    icon: Ban,
  },
  {
    value: "specific" as const,
    title: "Specific Global Prompts",
    description:
      "Allow only explicitly selected global prompts in addition to this agent's shortcuts.",
    icon: SlidersHorizontal,
  },
];

/**
 * System persona, optional subagent worker instructions, and prompt shortcut controls for an Agent.
 */
export function AgentPromptTab({
  agentId,
  prompt,
  onPromptChange,
  subagentPrompt,
  onSubagentPromptChange,
  promptMode = "all",
  onPromptModeChange,
  selectedPromptIds = new Set(),
  onTogglePromptId,
  onSelectPromptIds,
  onSave,
  isSaving = false,
  saveLabel = "Save Changes",
  disabled = false,
}: AgentPromptTabProps) {
  const prompts = useAppStore((state) => state.prompts);

  const globalPrompts = useMemo(
    () =>
      prompts.filter((p) => {
        const agents =
          p.agentIds && p.agentIds.length > 0
            ? p.agentIds
            : (p.assistantIds ?? []);
        return (
          (!p.projectIds || p.projectIds.length === 0) && agents.length === 0
        );
      }),
    [prompts],
  );

  const agentShortcuts = useMemo(
    () =>
      agentId
        ? prompts.filter((p) => {
            const agents =
              p.agentIds && p.agentIds.length > 0
                ? p.agentIds
                : (p.assistantIds ?? []);
            return agents.includes(agentId);
          })
        : [],
    [prompts, agentId],
  );

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">System Persona Prompt</h3>
          <p className="text-muted-foreground text-sm">
            Core persona and instructions used for direct chats and as base
            context when delegated to.
          </p>
        </div>
        <div
          className={disabled ? "pointer-events-none opacity-60" : undefined}
        >
          <MarkdownTabEditor
            value={prompt}
            onChange={onPromptChange}
            placeholder={
              PROMPTS.UI.EXAMPLES.ASSISTANT_SYSTEM_PROMPT_PLACEHOLDER_EDIT
            }
            minHeight="min-h-[240px]"
          />
        </div>
      </div>

      <div className="space-y-4 border-t pt-6">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">
            Subagent Worker Prompt (Optional)
          </h3>
          <p className="text-muted-foreground text-sm">
            Dedicated worker instructions appended only when this agent is
            invoked as a Layer-2 subagent via delegate_task.
          </p>
        </div>
        <div
          className={disabled ? "pointer-events-none opacity-60" : undefined}
        >
          <MarkdownTabEditor
            value={subagentPrompt}
            onChange={onSubagentPromptChange}
            placeholder="Optional constraints, output formatting, or scratchpad instructions for delegated subagent runs..."
            minHeight="min-h-[160px]"
          />
        </div>
      </div>

      {onPromptModeChange && (
        <div className="space-y-4 border-t pt-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Global Prompt Shortcuts</h3>
            <p className="text-muted-foreground text-sm">
              Control which global slash-command shortcuts are accessible in
              chats with this agent.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {MODE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = promptMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPromptModeChange(option.value)}
                  className={cn(
                    "group bg-card hover:bg-accent/40 relative flex cursor-pointer flex-col justify-between rounded-lg border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60",
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
                </button>
              );
            })}
          </div>

          {promptMode === "specific" && (
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
          )}
        </div>
      )}

      {agentId && !disabled && (
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-lg font-semibold">Agent Shortcuts</h3>
              <p className="text-muted-foreground text-sm">
                Prompts created exclusively for this agent.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`${ROUTES.SETTINGS.PROMPTS.new}?agentId=${agentId}`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Shortcut
              </Link>
            </Button>
          </div>

          {agentShortcuts.length === 0 ? (
            <div className="bg-muted/20 rounded-lg border border-dashed p-6 text-center">
              <p className="text-muted-foreground text-xs">
                No agent-specific shortcuts yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {agentShortcuts.map((p) => (
                <PromptCard key={p.id} prompt={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {!disabled && (
        <div className="border-t pt-4">
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saveLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
