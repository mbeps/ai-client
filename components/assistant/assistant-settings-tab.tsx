"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";

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
        <h3 className="text-lg font-semibold">Assistant Details</h3>
        <p className="text-sm text-muted-foreground">
          Manage the assistant name and description.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Assistant Name</label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Assistant name"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
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
