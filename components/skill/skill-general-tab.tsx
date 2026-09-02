"use client";

import { Loader2, Save } from "lucide-react";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SkillGeneralTabProps {
  displayName: string;
  onDisplayNameChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  content: string;
  onContentChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
}

/**
 * General metadata and instructions editor tab for an Agent Skill.
 *
 * @author Maruf Bepary
 */
export function SkillGeneralTab({
  displayName,
  onDisplayNameChange,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  content,
  onContentChange,
  onSave,
  isSaving = false,
}: SkillGeneralTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">Skill Details</h3>
        <p className="text-muted-foreground text-sm">
          Update the skill identifier, description, and primary instruction
          rules.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="font-medium text-sm">Display Name</label>
            <Input
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="font-medium text-sm">Skill Slug</label>
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-l-md border border-r-0 bg-muted font-mono text-muted-foreground">
                /
              </div>
              <Input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                className="rounded-l-none font-mono"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="font-medium text-sm">Description</label>
          <Input
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Brief summary used by AI for progressive disclosure routing..."
          />
        </div>

        <div className="space-y-2">
          <label className="font-medium text-sm">
            Instructions & Guidelines (Markdown)
          </label>
          <MarkdownTabEditor
            value={content}
            onChange={onContentChange}
            minHeight="min-h-[300px]"
          />
        </div>
      </div>

      <div>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
export default SkillGeneralTab;
