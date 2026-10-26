"use client";

import { Check, ShieldCheck, X } from "lucide-react";
import { SubagentModelSelect } from "@/components/chat/subagent-model-select";
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

/**
 * Represents subagent config dialog props.
 *
 * @author Maruf Bepary
 */
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
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <span>Subagents</span>
            <Badge
              variant="outline"
              className="border-purple-500/30 bg-purple-500/10 px-1.5 py-0 font-mono text-[10px] font-semibold tracking-wider text-purple-700 uppercase dark:text-purple-300"
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
          <div className="border-border bg-card flex items-center justify-between rounded-lg border p-3">
            <span className="text-foreground text-sm font-medium">
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
            <label className="text-foreground text-xs font-medium">
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
          <div className="border-border/60 bg-muted/30 space-y-1 rounded-lg border p-3 text-xs leading-relaxed">
            <div className="text-foreground flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Tool Inheritance &amp; Sandboxing
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Worker subagents dynamically inherit all tools enabled on the main
              chat (MCP servers, knowledge bases, skills, memory). Canvas
              artifacts (
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">
                manage_artifact
              </code>
              ) and recursive delegation (
              <code className="bg-muted rounded px-1 py-0.5 font-mono text-[10px]">
                delegate_task
              </code>
              ) are permanently locked out.
            </p>
          </div>
        </div>

        {/* Dialog Footer with Cancel and Done */}
        <div className="bg-muted/20 flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
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
