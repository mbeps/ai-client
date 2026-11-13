"use client";

import {
  Ban,
  Loader2,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { SkillsPicker } from "@/components/chat/skills-picker";
import { SkillCard } from "@/components/skill/skill-card";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { cn } from "@/lib/utils";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { Skill } from "@/types/skill/skill";

/**
 * Represents skills config tab props.
 *
 * @author Maruf Bepary
 */
export interface SkillsConfigTabProps {
  projectId?: string;
  agentId?: string;
  assistantId?: string;
  skillMode: SkillMode;
  onSkillModeChange: (mode: SkillMode) => void;
  selectedSkillIds: Set<string>;
  onToggleSkill: (id: string) => void;
  onSelectSkills?: (ids: Set<string>) => void;
  skills: Skill[];
  onSave?: () => Promise<void> | void;
  isSaving?: boolean;
  saveLabel?: string;
  title?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Represents mode option.
 *
 * @author Maruf Bepary
 */
interface ModeOption {
  value: SkillMode;
  title: string;
  description: string;
  icon: typeof Sparkles;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "dynamic",
    title: "Dynamic Loading (Default)",
    description:
      "AI automatically discovers and dynamically loads relevant skills on demand when needed for a task.",
    icon: Sparkles,
  },
  {
    value: "none",
    title: "No Skills",
    description:
      "Completely disable agent skills. The model operates without procedural skill instructions or skill loading tools.",
    icon: Ban,
  },
  {
    value: "specific",
    title: "Specific Skills",
    description:
      "Pre-load selected skills directly into system instructions for active guidance, while retaining dynamic access to others.",
    icon: SlidersHorizontal,
  },
];

/**
 * Unified skills configuration component for Projects, Assistants, and Automations.
 * Allows choosing between dynamic loading, no skills, or pre-loading specific skills.
 *
 * @author Maruf Bepary
 */
export function SkillsConfigTab({
  projectId,
  agentId,
  assistantId,
  skillMode,
  onSkillModeChange,
  selectedSkillIds,
  onToggleSkill,
  onSelectSkills,
  skills,
  onSave,
  isSaving = false,
  saveLabel = "Save Skills",
  title = "Skills Configuration",
  description = "Configure how agent skills and domain instructions are used.",
  className,
  disabled = false,
}: SkillsConfigTabProps) {
  const scopedAgentId = agentId ?? assistantId;

  const entitySkills = useMemo(() => {
    return skills.filter((s) => {
      const targetAgents =
        s.agentIds && s.agentIds.length > 0
          ? s.agentIds
          : (s.assistantIds ?? []);
      const matchProject = Boolean(
        projectId && s.projectIds?.includes(projectId),
      );
      const matchAgent = Boolean(
        scopedAgentId && targetAgents.includes(scopedAgentId),
      );
      return matchProject || matchAgent;
    });
  }, [skills, projectId, scopedAgentId]);

  const globalSkills = useMemo(
    () =>
      skills.filter((s) => {
        const targetAgents =
          s.agentIds && s.agentIds.length > 0
            ? s.agentIds
            : (s.assistantIds ?? []);
        return (
          (!s.projectIds || s.projectIds.length === 0) &&
          targetAgents.length === 0
        );
      }),
    [skills],
  );

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = skillMode === option.value;

          return (
            <div
              key={option.value}
              onClick={() => onSkillModeChange(option.value)}
              className={cn(
                "group bg-card hover:bg-accent/40 relative flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all",
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

              <div className="mt-3 flex items-center justify-end">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isSelected ? "bg-primary" : "bg-transparent",
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>

      {skillMode === "specific" && (
        <div className="space-y-3">
          <div className="space-y-0.5">
            <h4 className="text-sm font-medium">Select Skills to Pre-Load</h4>
            <p className="text-muted-foreground text-xs">
              Selected skills will be active in instructions. Other enabled
              skills can still be dynamically loaded if needed.
            </p>
          </div>
          <div className="bg-card flex max-h-[500px] flex-col overflow-hidden rounded-md border p-4">
            <SkillsPicker
              skills={globalSkills}
              selectedIds={selectedSkillIds}
              onToggleSkill={onToggleSkill}
              onSelectSkills={onSelectSkills}
              maxHeight="420px"
            />
          </div>
        </div>
      )}

      {(projectId || scopedAgentId) && (
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-base font-semibold">
                {projectId ? "Project Skills" : "Agent Skills"}
              </h4>
              <p className="text-muted-foreground text-xs">
                Skills created exclusively for this{" "}
                {projectId ? "project" : "agent"}.
              </p>
            </div>
            {!disabled && (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={
                    projectId
                      ? `${ROUTES.SETTINGS.SKILLS.new}?projectId=${projectId}`
                      : `${ROUTES.SETTINGS.SKILLS.new}?agentId=${scopedAgentId}`
                  }
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Skill
                </Link>
              </Button>
            )}
          </div>

          {entitySkills.length === 0 ? (
            <div className="bg-muted/20 rounded-lg border border-dashed p-6 text-center">
              <p className="text-muted-foreground text-xs">
                No {projectId ? "project" : "agent"}-specific skills yet. Create
                one to define a skill accessible only in this{" "}
                {projectId ? "project" : "agent"}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {entitySkills.map((s) => (
                <SkillCard key={s.id} skill={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {onSave && !disabled && (
        <Button onClick={onSave} disabled={isSaving}>
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
