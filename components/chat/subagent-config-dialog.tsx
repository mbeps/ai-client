"use client";

import { Bot, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Switch } from "@/components/ui/switch";
import { SubagentModelCombobox } from "./subagent-model-combobox";

export interface SubagentConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subagentsEnabled: boolean;
  onToggleSubagents: (enabled: boolean) => void;
  subagentModelId?: string;
  onSubagentModelChange: (modelId: string | undefined) => void;
}

/**
 * Dedicated dialog for configuring worker subagents.
 *
 * Provides deterministic controls for enabling subagents, choosing
 * worker models via Shadcn combobox, and displaying topological tool sandboxing.
 *
 * @author Maruf Bepary
 */
export function SubagentConfigDialog({
  open,
  onOpenChange,
  subagentsEnabled,
  onToggleSubagents,
  subagentModelId,
  onSubagentModelChange,
}: SubagentConfigDialogProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md p-6">
        <ResponsiveDialogHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <ResponsiveDialogTitle className="text-base font-semibold">
              Subagents
            </ResponsiveDialogTitle>
          </div>
          <ResponsiveDialogDescription className="text-xs text-muted-foreground">
            Delegate complex tasks to isolated worker subagents with shared
            scratchpad memory.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-5 py-2">
          {/* Main Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
                <Bot className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  Enable Subagents
                  {subagentsEnabled && (
                    <span className="rounded-full bg-purple-500/15 px-2 py-0.2 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Allow the main orchestrator to spawn specialized subagents for
                  deep research and analysis.
                </p>
              </div>
            </div>
            <Switch
              checked={subagentsEnabled}
              onCheckedChange={onToggleSubagents}
              aria-label="Toggle subagents"
            />
          </div>

          {/* Worker Model Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              Worker Subagent Model
            </label>
            <p className="text-xs text-muted-foreground">
              Select a dedicated model for worker subagents, or inherit the
              orchestrator&apos;s model.
            </p>
            <SubagentModelCombobox
              value={subagentModelId}
              onValueChange={onSubagentModelChange}
              disabled={!subagentsEnabled}
            />
          </div>

          {/* Topological Sandboxing Notice */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Tool Inheritance &amp; Sandboxing
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Worker subagents dynamically inherit all tools enabled on the main
              chat (MCP servers, knowledge bases, skills, memory). Canvas
              artifacts (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                manage_artifact
              </code>
              ) and recursive delegation (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                delegate_task
              </code>
              ) are permanently locked out.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end pt-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Done
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
