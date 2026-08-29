"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { Save } from "lucide-react";

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
        <h3 className="text-lg font-semibold">Skill Details</h3>
        <p className="text-sm text-muted-foreground">
          Update the skill identifier, description, and primary instruction
          rules.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="space-y-2">
            <label className="text-sm font-medium">Display Name</label>
            <Input
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Skill Slug</label>
            <div className="flex items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-l-md border border-r-0 bg-muted text-muted-foreground font-mono">
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
          <label className="text-sm font-medium">Description</label>
          <Input
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Brief summary used by AI for progressive disclosure routing..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
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
            "Saving..."
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
