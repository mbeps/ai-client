"use client";

import { AlertCircle, Loader2, Save } from "lucide-react";
import { SubagentPicker } from "@/components/shared/subagent-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/types/agent/agent";

/**
 * Props for the SubagentsConfigTab component.
 */
export interface SubagentsConfigTabProps {
  title?: string;
  description?: string;
  agentId?: string;
  agents: Agent[];
  selectedSubagentIds: string[];
  onToggleSubagent: (subagentId: string) => void;
  usedByCount?: number;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
  saveLabel?: string;
  disabled?: boolean;
}

/**
 * Shared subagents linking tab for an Agent or Project.
 * Enforces the 2-layer delegation limit visually when `usedByCount > 0`.
 */
export function SubagentsConfigTab({
  title = "Linked Subagents",
  description = "Select Leaf Agents and Built-in Agents available for delegation via delegate_task.",
  agentId,
  agents,
  selectedSubagentIds,
  onToggleSubagent,
  usedByCount = 0,
  onSave,
  isSaving = false,
  saveLabel = "Save Subagents",
  disabled = false,
}: SubagentsConfigTabProps) {
  const isLockedAsLeaf = usedByCount > 0;
  const isPickerDisabled = disabled || isLockedAsLeaf;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {isLockedAsLeaf && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Currently Linked as a Subagent</AlertTitle>
          <AlertDescription>
            This agent is currently linked as a subagent in {usedByCount}{" "}
            {usedByCount === 1 ? "parent" : "parents"} (Agent, Project, or
            Workflow). Unlink it from all parents before assigning child
            subagents to preserve the 2-layer limit.
          </AlertDescription>
        </Alert>
      )}

      <SubagentPicker
        agents={agents}
        selectedIds={selectedSubagentIds}
        onToggle={onToggleSubagent}
        excludeAgentId={agentId}
        disabled={isPickerDisabled}
      />

      {!disabled && (
        <Button onClick={onSave} disabled={isSaving || isLockedAsLeaf}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saveLabel}
        </Button>
      )}
    </div>
  );
}
