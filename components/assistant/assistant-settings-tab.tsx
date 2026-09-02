"use client";

import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface AssistantSettingsTabProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
}

/**
 * Metadata settings editor tab for an Assistant.
 *
 * @author Maruf Bepary
 */
export function AssistantSettingsTab({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  onSave,
  isSaving = false,
}: AssistantSettingsTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">Assistant Details</h3>
        <p className="text-muted-foreground text-sm">
          Manage the assistant name and description.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="font-medium text-sm">Assistant Name</label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Assistant name"
          />
        </div>
        <div className="space-y-2">
          <label className="font-medium text-sm">Description</label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe this assistant..."
            rows={3}
          />
        </div>
        <Button onClick={onSave} disabled={isSaving || !name.trim()}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Details
        </Button>
      </div>
    </div>
  );
}
export default AssistantSettingsTab;
