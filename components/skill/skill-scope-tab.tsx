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
  projectIds: string[];
  onProjectIdsChange: (ids: string[]) => void;
  assistantIds: string[];
  onAssistantIdsChange: (ids: string[]) => void;
  onSave: () => Promise<void> | void;
  isSaving: boolean;
}

/**
 * Skill scope tab component configuring skill visibility across projects and assistants.
 *
 * @author Maruf Bepary
 */
export function SkillScopeTab({
  projectIds,
  onProjectIdsChange,
  assistantIds,
  onAssistantIdsChange,
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
        projectIds={projectIds}
        onProjectIdsChange={onProjectIdsChange}
        assistantIds={assistantIds}
        onAssistantIdsChange={onAssistantIdsChange}
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
