"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { PROMPTS } from "@/constants/prompts";

export interface ProjectPromptTabProps {
  globalPrompt: string;
  onGlobalPromptChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
}

/**
 * Global system prompt editor tab for a Project.
 *
 * @author Maruf Bepary
 */
export function ProjectPromptTab({
  globalPrompt,
  onGlobalPromptChange,
  onSave,
  isSaving = false,
}: ProjectPromptTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Global Prompt</h3>
        <p className="text-sm text-muted-foreground">
          Instructions injected as system prompts for all new chats in this
          project.
        </p>
      </div>
      <div className="space-y-4">
        <Textarea
          value={globalPrompt}
          onChange={(e) => onGlobalPromptChange(e.target.value)}
          rows={12}
          placeholder={
            PROMPTS.UI.EXAMPLES.PROJECT_GLOBAL_PROMPT_PLACEHOLDER_EDIT
          }
        />
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Prompt
        </Button>
      </div>
    </div>
  );
}
export default ProjectPromptTab;
