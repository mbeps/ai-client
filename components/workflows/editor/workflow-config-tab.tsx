"use client";

import { ModelSelector } from "@/components/shared/model-selector";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/** Props for {@link WorkflowConfigTab}. */
export interface WorkflowConfigTabProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  modelId: string;
  onModelIdChange: (modelId: string) => void;
  requiresFileUpload: boolean;
  onRequiresFileUploadChange: (requires: boolean) => void;
}

/**
 * Metadata, default model selector, and manual run file requirement settings tab.
 */
export function WorkflowConfigTab({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  modelId,
  onModelIdChange,
  requiresFileUpload,
  onRequiresFileUploadChange,
}: WorkflowConfigTabProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Workflow Settings</h3>
        <p className="text-muted-foreground text-sm">
          Basic metadata and default runtime configuration for this workflow.
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Label htmlFor="workflow-name">Workflow Name</Label>
          <Input
            id="workflow-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Monthly Invoice Reconciliation"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="workflow-description">Description</Label>
          <Textarea
            id="workflow-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="What does this workflow automate?"
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label>Default Model</Label>
          <ModelSelector
            value={modelId}
            onValueChange={onModelIdChange}
            className="bg-card h-10 w-full border px-3"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="workflow-requires-file-upload">
              Require File Upload
            </Label>
            <p className="text-muted-foreground text-sm">
              Prompt for input files when starting a manual run.
            </p>
          </div>
          <Switch
            id="workflow-requires-file-upload"
            checked={requiresFileUpload}
            onCheckedChange={onRequiresFileUploadChange}
          />
        </div>
      </div>
    </div>
  );
}
