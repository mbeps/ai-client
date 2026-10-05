"use client";

import { Loader2, Save } from "lucide-react";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { Button } from "@/components/ui/button";
import { PROMPTS } from "@/config/prompts";

export interface AssistantPromptTabProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
}

/**
 * System persona and prompt editor tab for an Assistant.
 *
 * @author Maruf Bepary
 */
export function AssistantPromptTab({
  prompt,
  onPromptChange,
  onSave,
  isSaving = false,
}: AssistantPromptTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">System Prompt</h3>
        <p className="text-muted-foreground text-sm">
          Customize the persona and capabilities of this assistant.
        </p>
      </div>
      <div className="space-y-4">
        <MarkdownTabEditor
          value={prompt}
          onChange={onPromptChange}
          placeholder={
            PROMPTS.UI.EXAMPLES.ASSISTANT_SYSTEM_PROMPT_PLACEHOLDER_EDIT
          }
          minHeight="min-h-[300px]"
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
