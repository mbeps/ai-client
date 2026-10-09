"use client";

import { Check, ShieldCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { SubagentModelSelect } from "./subagent-model-select";

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
 * Provides a clean modal styled consistently with the other resource pickers
 * (PickerDialog), including header border, Cancel and Done buttons with icons,
 * and simplified typography.
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3.5 pr-12">
          <DialogTitle className="flex items-center gap-2 font-semibold text-base">
            <span>Subagents</span>
            <Badge
              variant="outline"
              className="border-purple-500/30 bg-purple-500/10 px-1.5 py-0 font-mono font-semibold text-[10px] text-purple-700 uppercase tracking-wider dark:text-purple-300"
            >
              BETA
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Delegate complex tasks to isolated worker subagents with shared
            scratchpad memory.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-4">
          {/* Main Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <span className="font-medium text-foreground text-sm">
              Enable Subagents
            </span>
            <Switch
              checked={subagentsEnabled}
              onCheckedChange={onToggleSubagents}
              aria-label="Toggle subagents"
            />
          </div>

          {/* Worker Model Selection */}
          <div className="space-y-2">
            <label className="font-medium text-foreground text-xs">
              Worker Subagent Model
            </label>
            <p className="text-muted-foreground text-xs">
              Select a dedicated model for worker subagents, or inherit the
              orchestrator&apos;s model.
            </p>
            <SubagentModelSelect
              value={subagentModelId}
              onValueChange={onSubagentModelChange}
              disabled={!subagentsEnabled}
            />
          </div>

          {/* Topological Sandboxing Notice */}
          <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Tool Inheritance &amp; Sandboxing
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
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
        </div>

        {/* Dialog Footer with Cancel and Done */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-muted/20 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="gap-2 px-6"
          >
            <Check className="h-4 w-4" />
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
