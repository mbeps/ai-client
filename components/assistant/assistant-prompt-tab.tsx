"use client";

import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PROMPTS } from "@/constants/prompts";

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
        <Textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          rows={12}
          placeholder={
            PROMPTS.UI.EXAMPLES.ASSISTANT_SYSTEM_PROMPT_PLACEHOLDER_EDIT
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
export default AssistantPromptTab;
