"use client";

import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ProjectSettingsTabProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
}

/**
 * Settings editor tab for a Project.
 *
 * @author Maruf Bepary
 */
export function ProjectSettingsTab({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  onSave,
  isSaving = false,
}: ProjectSettingsTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">Project Details</h3>
        <p className="text-muted-foreground text-sm">
          Manage the project name and description.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="font-medium text-sm">Project Name</label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Project name"
          />
        </div>
        <div className="space-y-2">
          <label className="font-medium text-sm">Description</label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe this project..."
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
export default ProjectSettingsTab;
