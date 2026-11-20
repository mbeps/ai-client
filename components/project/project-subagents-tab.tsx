"use client";

import { Loader2, Save } from "lucide-react";
import { SubagentPicker } from "@/components/shared/subagent-picker";
import { Button } from "@/components/ui/button";
import type { Agent } from "@/types/agent/agent";

/**
 * Props for the ProjectSubagentsTab component.
 */
export interface ProjectSubagentsTabProps {
  agents: Agent[];
  selectedSubagentIds: string[];
  onToggleSubagent: (agentId: string) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
}

/**
 * Subagents configuration tab for a Project.
 * Allows binding Leaf Agents and Built-in Agents available to all chats in the Project.
 */
export function ProjectSubagentsTab({
  agents,
  selectedSubagentIds,
  onToggleSubagent,
  onSave,
  isSaving = false,
}: ProjectSubagentsTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Project Subagents</h3>
        <p className="text-muted-foreground text-sm">
          Select Leaf Agents and Built-in Agents available for delegation via
          delegate_task in all chats within this project.
        </p>
      </div>

      <SubagentPicker
        agents={agents}
        selectedIds={selectedSubagentIds}
        onToggle={onToggleSubagent}
      />

      <Button onClick={onSave} disabled={isSaving}>
        {isSaving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save Subagents
      </Button>
    </div>
  );
}
