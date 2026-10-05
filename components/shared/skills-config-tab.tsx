"use client";

import {
  Ban,
  BrainCircuit,
  Loader2,
  Save,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { SkillsPicker } from "@/components/chat/skills-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { Skill } from "@/types/skill/skill";

export interface SkillsConfigTabProps {
  skillMode: SkillMode;
  onSkillModeChange: (mode: SkillMode) => void;
  selectedSkillIds: Set<string>;
  onToggleSkill: (id: string) => void;
  onSelectSkills?: (ids: Set<string>) => void;
  skills: Skill[];
  onSave?: () => Promise<void> | void;
  isSaving?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

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
  skillMode,
  onSkillModeChange,
  selectedSkillIds,
  onToggleSkill,
  onSelectSkills,
  skills,
  onSave,
  isSaving = false,
  title = "Skills Configuration",
  description = "Configure how agent skills and domain instructions are used.",
  className,
}: SkillsConfigTabProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">{title}</h3>
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
                "group relative flex cursor-pointer flex-col justify-between rounded-lg border bg-card p-4 transition-all hover:bg-accent/40",
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
                  <span className="font-medium text-sm leading-tight">
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
            <h4 className="font-medium text-sm">Select Skills to Pre-Load</h4>
            <p className="text-muted-foreground text-xs">
              Selected skills will be active in instructions. Other enabled
              skills can still be dynamically loaded if needed.
            </p>
          </div>
          <div className="flex max-h-[500px] flex-col overflow-hidden rounded-md border bg-card p-4">
            <SkillsPicker
              skills={skills}
              selectedIds={selectedSkillIds}
              onToggleSkill={onToggleSkill}
              onSelectSkills={onSelectSkills}
              maxHeight="420px"
            />
          </div>
        </div>
      )}

      {onSave && (
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Skills
        </Button>
      )}
    </div>
  );
}
