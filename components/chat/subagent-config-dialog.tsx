"use client";

import { Check, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ModelReasoningEffortCard } from "@/components/chat/input/reasoning-effort-selector";
import { SubagentModelSelect } from "@/components/chat/subagent-model-select";
import { SubagentPicker } from "@/components/shared/subagent-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { BUILT_IN_AGENTS } from "@/config/built-in-agents";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { Agent } from "@/types/agent/agent";

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
  subagentReasoningEffort?: ReasoningEffort;
  onSubagentReasoningEffortChange?: (effort: ReasoningEffort) => void;
  agents?: Agent[];
  selectedSubagentIds?: string[];
  onToggleSubagentId?: (agentId: string) => void;
  onSelectSubagentIds?: (agentIds: string[]) => void;
  excludeAgentId?: string;
}

const NOOP_TOGGLE = () => {};

/**
 * Dedicated dialog for configuring worker subagents.
 *
 * Mirrors PickerDialog sizing, scrollable body, and footer action bar
 * (Manage Agents link, Cancel, Done) while exposing subagent toggle,
 * worker model selection, and collapsible SubagentPicker.
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
  subagentReasoningEffort,
  onSubagentReasoningEffortChange,
  agents: agentsProp,
  selectedSubagentIds,
  onToggleSubagentId,
  onSelectSubagentIds,
  excludeAgentId,
}: SubagentConfigDialogProps) {
  const storeAgents = useAppStore((s) => s.agents);
  const rawAgents = agentsProp ?? storeAgents ?? [];
  const agents = rawAgents.length > 0 ? rawAgents : BUILT_IN_AGENTS;
  const [internalReasoningEffort, setInternalReasoningEffort] =
    useState<ReasoningEffort>("medium");

  const activeReasoningEffort =
    subagentReasoningEffort ?? internalReasoningEffort;
  const handleReasoningEffortChange = (effort: ReasoningEffort) => {
    setInternalReasoningEffort(effort);
    onSubagentReasoningEffortChange?.(effort);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-h-[680px] sm:max-w-lg">
        <DialogHeader className="flex-row items-center justify-between border-b px-4 py-3.5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <span>Subagents</span>
            <Badge
              variant="outline"
              className="border-purple-500/30 bg-purple-500/10 px-1.5 py-0 text-[10px] font-semibold tracking-wider text-purple-700 uppercase dark:text-purple-300"
            >
              BETA
            </Badge>
          </DialogTitle>
          <Switch
            checked={subagentsEnabled}
            onCheckedChange={onToggleSubagents}
            aria-label="Toggle subagents"
          />
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-3 pb-4">
          <div className="shrink-0 space-y-2">
            <label className="text-foreground text-xs font-medium">
              Worker Subagent Model
            </label>
            <SubagentModelSelect
              value={subagentModelId}
              onValueChange={onSubagentModelChange}
              disabled={!subagentsEnabled}
            />
            <ModelReasoningEffortCard
              modelId={subagentModelId}
              value={activeReasoningEffort}
              onChange={handleReasoningEffortChange}
              disabled={!subagentsEnabled}
            />
          </div>

          <Separator />

          <SubagentPicker
            agents={agents}
            selectedIds={selectedSubagentIds ?? []}
            onToggle={onToggleSubagentId ?? NOOP_TOGGLE}
            onSelectIds={onSelectSubagentIds}
            excludeAgentId={excludeAgentId}
            disabled={!subagentsEnabled}
            defaultExpanded={false}
            columns={1}
          />
        </div>

        <div className="bg-muted/20 flex shrink-0 items-center justify-between border-t px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="text-muted-foreground hover:text-foreground h-8 gap-1.5 text-xs"
          >
            <Link href={ROUTES.AGENTS.path} onClick={() => onOpenChange(false)}>
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Manage Agents</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
