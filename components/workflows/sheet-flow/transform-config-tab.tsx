"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ModelSelector } from "@/components/shared/model-selector";

export interface TransformConfigTabProps {
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
 * Metadata, model selector, and file upload settings tab for a Transform Agent.
 *
 * @author Maruf Bepary
 */
export function TransformConfigTab({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  modelId,
  onModelIdChange,
  requiresFileUpload,
  onRequiresFileUploadChange,
}: TransformConfigTabProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Agent Details</h3>
        <p className="text-sm text-muted-foreground">
          Basic configuration and metadata for this transform agent.
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="space-y-2">
          <Label htmlFor="name">Agent Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Monthly Expense Report"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="What does this agent do?"
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <ModelSelector
            value={modelId}
            onValueChange={onModelIdChange}
            className="w-full border bg-card h-10 px-3"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label>Require File Upload</Label>
            <p className="text-sm text-muted-foreground">
              If enabled, users will be prompted to upload spreadsheet files
              before running the agent.
            </p>
          </div>
          <Switch
            checked={requiresFileUpload}
            onCheckedChange={onRequiresFileUploadChange}
          />
        </div>
      </div>
    </div>
  );
}
export default TransformConfigTab;
