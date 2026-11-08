"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SKILL_DESCRIPTION_MAX_LENGTH } from "@/schemas/skill/skill";

/**
 * Props for the SkillDetailsTab component.
 *
 * @author Maruf Bepary
 */
export interface SkillDetailsTabProps {
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  onSave: () => Promise<void> | void;
  isSaving: boolean;
}

/**
 * Skill details tab for viewing and updating skill configuration,
 * including display name, skill ID, description, and enabled status.
 *
 * @author Maruf Bepary
 */
export function SkillDetailsTab({
  displayName,
  onDisplayNameChange,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  enabled,
  onEnabledChange,
  onSave,
  isSaving,
}: SkillDetailsTabProps) {
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    onNameChange(sanitized);
  };

  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    onDescriptionChange(e.target.value.slice(0, SKILL_DESCRIPTION_MAX_LENGTH));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Details</h3>
          <p className="text-muted-foreground text-sm">
            Modify the skill title, skill ID, and description.
          </p>
        </div>

        {/* Enabled Status near top */}
        <div className="flex items-center gap-2">
          <Switch
            id="skill-enabled-switch"
            checked={enabled}
            onCheckedChange={onEnabledChange}
            aria-label="Enable skill"
          />
          <Label
            htmlFor="skill-enabled-switch"
            className="cursor-pointer text-sm font-medium"
          >
            {enabled ? "Enabled" : "Disabled"}
          </Label>
        </div>
      </div>

      <div className="space-y-4">
        {/* Title / Display Name */}
        <div className="space-y-2">
          <Label htmlFor="skill-display-name">Title</Label>
          <Input
            id="skill-display-name"
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder={name || "Skill Name"}
            aria-label="Skill name"
            className="w-full"
          />
        </div>

        {/* Skill ID */}
        <div className="space-y-2">
          <Label htmlFor="skill-slug">Skill ID</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-sm">/</span>
            <Input
              id="skill-slug"
              value={name}
              onChange={handleSlugChange}
              placeholder="skill-slug"
              aria-label="Skill ID"
              className="max-w-xs font-mono text-sm"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            The trigger command. Only lowercase letters, numbers, and hyphens
            allowed.
          </p>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="skill-description">Description</Label>
            <span className="text-muted-foreground font-mono text-xs">
              {description.length}/{SKILL_DESCRIPTION_MAX_LENGTH}
            </span>
          </div>
          <Textarea
            id="skill-description"
            value={description}
            onChange={handleDescriptionChange}
            maxLength={SKILL_DESCRIPTION_MAX_LENGTH}
            rows={3}
            placeholder="Add a description for what this skill does and when to use it..."
            aria-label="Skill description"
            className="text-muted-foreground resize-none text-sm"
          />
        </div>
      </div>

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
