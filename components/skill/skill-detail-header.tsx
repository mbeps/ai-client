"use client";

import { Download, Loader2, MoreHorizontal, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SKILL_DESCRIPTION_MAX_LENGTH } from "@/schemas/skill/skill";

export { SKILL_DESCRIPTION_MAX_LENGTH };

export interface SkillDetailHeaderProps {
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
  onDelete: () => void;
  isDeleting: boolean;
  onExport: () => Promise<void> | void;
  isExporting: boolean;
}

/**
 * Top header section for the Skill Details page.
 * Provides inline editing for the skill title, slash command slug, and description,
 * along with action buttons (Enable toggle, Save, Dropdown for Export & Delete).
 *
 * @author Maruf Bepary
 */
export function SkillDetailHeader({
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
  onDelete,
  isDeleting,
  onExport,
  isExporting,
}: SkillDetailHeaderProps) {
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
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      {/* Left: Editable Title, Slash Command, Description matching editor width */}
      <div className="flex flex-col space-y-2 lg:col-span-2">
        {/* Editable Title */}
        <Input
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder={name || "Skill Name"}
          aria-label="Skill name"
          className="h-auto border-transparent bg-transparent p-0 font-bold text-2xl tracking-tight shadow-none hover:border-border/40 focus-visible:border-border focus-visible:bg-background/80 focus-visible:ring-1 focus-visible:ring-ring md:text-3xl"
        />

        {/* Editable Slash Command Slug */}
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <span className="font-mono">Slash command: /</span>
          <Input
            value={name}
            onChange={handleSlugChange}
            placeholder="skill-slug"
            aria-label="Skill slash command slug"
            className="h-6 w-48 border-muted-foreground/30 bg-transparent px-1.5 py-0 font-mono text-xs shadow-none focus-visible:ring-1"
          />
        </div>

        {/* Editable Description with 500 Character Limit matching editor width */}
        <div className="relative mt-1 w-full">
          <Textarea
            value={description}
            onChange={handleDescriptionChange}
            maxLength={SKILL_DESCRIPTION_MAX_LENGTH}
            rows={2}
            placeholder="Add a description for what this skill does and when to use it..."
            aria-label="Skill description"
            className="w-full resize-none pr-16 text-muted-foreground text-sm shadow-none focus-visible:ring-1"
          />
          <span className="pointer-events-none absolute right-2.5 bottom-2 font-mono text-[11px] text-muted-foreground/70">
            {description.length}/{SKILL_DESCRIPTION_MAX_LENGTH}
          </span>
        </div>
      </div>

      {/* Right: Actions (Enable Toggle, Save Changes, Dropdown [...] on the right) */}
      <div className="flex items-center justify-end gap-3 pt-1 lg:col-span-1">
        {/* Enable / Disable Toggle without outer container box */}
        <div className="flex items-center gap-2">
          <Switch
            id="skill-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
            aria-label="Enable skill"
          />
          <Label
            htmlFor="skill-enabled"
            className="cursor-pointer font-medium text-muted-foreground text-sm"
          >
            {enabled ? "Enabled" : "Disabled"}
          </Label>
        </div>

        {/* Save Changes Button */}
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="h-8 gap-1.5 font-medium text-xs"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Save Changes
            </>
          )}
        </Button>

        {/* More Actions Dropdown: on the right of save button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="More options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={onExport}
              disabled={isExporting}
              className="cursor-pointer gap-2 text-xs"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export Bundle
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              disabled={isDeleting}
              className="cursor-pointer gap-2 text-destructive text-xs focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete Skill
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
