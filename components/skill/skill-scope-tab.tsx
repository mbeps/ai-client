"use client";

import { Save } from "lucide-react";
import { SkillScopeSelector } from "@/components/skill/skill-scope-selector";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";

/**
 * Props for the SkillScopeTab component.
 *
 * @author Maruf Bepary
 */
export interface SkillScopeTabProps {
  scope: "global" | "project" | "assistant";
  onScopeChange: (scope: "global" | "project" | "assistant") => void;
  projectId?: string | null;
  onProjectIdChange: (id: string | null) => void;
  assistantId?: string | null;
  onAssistantIdChange: (id: string | null) => void;
  onSave: () => Promise<void> | void;
  isSaving: boolean;
}

/**
 * Skill scope tab component configuring skill visibility (global, project, or assistant).
 *
 * @author Maruf Bepary
 */
export function SkillScopeTab({
  scope,
  onScopeChange,
  projectId,
  onProjectIdChange,
  assistantId,
  onAssistantIdChange,
  onSave,
  isSaving,
}: SkillScopeTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Scope & Visibility</h3>
        <p className="text-muted-foreground text-sm">
          Control where this agent skill shortcut and tool can be invoked.
        </p>
      </div>

      <SkillScopeSelector
        scope={scope}
        onScopeChange={onScopeChange}
        projectId={projectId}
        onProjectIdChange={onProjectIdChange}
        assistantId={assistantId}
        onAssistantIdChange={onAssistantIdChange}
        disabled={isSaving}
      />

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={onSave} disabled={isSaving}>
          <LoadingSwap isLoading={isSaving}>
            <div className="flex items-center">
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </div>
          </LoadingSwap>
        </Button>
      </div>
    </div>
  );
}
