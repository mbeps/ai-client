"use client";

import { ScopeConfigurator } from "@/components/shared/scope-configurator";

/**
 * Props for the SkillScopeSelector component.
 *
 * @author Maruf Bepary
 */
export interface SkillScopeSelectorProps {
  projectIds: string[];
  onProjectIdsChange: (ids: string[]) => void;
  assistantIds: string[];
  onAssistantIdsChange: (ids: string[]) => void;
  disabled?: boolean;
}

/**
 * Scope selector for configuring skill visibility and entity assignment across projects and assistants.
 *
 * @author Maruf Bepary
 */
export function SkillScopeSelector({
  projectIds,
  onProjectIdsChange,
  assistantIds,
  onAssistantIdsChange,
  disabled = false,
}: SkillScopeSelectorProps) {
  return (
    <ScopeConfigurator
      projectIds={projectIds}
      onProjectIdsChange={onProjectIdsChange}
      assistantIds={assistantIds}
      onAssistantIdsChange={onAssistantIdsChange}
      disabled={disabled}
    />
  );
}
