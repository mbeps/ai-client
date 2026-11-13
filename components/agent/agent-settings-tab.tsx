"use client";

import { Loader2, Save, X } from "lucide-react";
import { ModelSelector } from "@/components/shared/model-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Props for the AgentSettingsTab component.
 */
export interface AgentSettingsTabProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  modelId: string | null;
  onModelIdChange: (value: string | null) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
  saveLabel?: string;
  disabled?: boolean;
}

/**
 * Metadata and default model settings editor tab for an Agent.
 */
export function AgentSettingsTab({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  modelId,
  onModelIdChange,
  onSave,
  isSaving = false,
  saveLabel = "Save Details",
  disabled = false,
}: AgentSettingsTabProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Agent Details & Model</h3>
        <p className="text-muted-foreground text-sm">
          Manage the agent name, routing description, and default model.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Agent Name</label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Agent name"
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe this agent and when an orchestrator should delegate tasks to it..."
            rows={3}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Default Model (Optional)
          </label>
          <div className="flex items-center gap-2">
            <ModelSelector
              value={modelId ?? ""}
              onValueChange={(val) => onModelIdChange(val || null)}
              disabled={disabled}
              className="w-full max-w-sm"
            />
            {modelId && !disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear default model"
                onClick={() => onModelIdChange(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            When unset, falls back to the active chat or worker model.
          </p>
        </div>
        {!disabled && (
          <Button onClick={onSave} disabled={isSaving || !name.trim()}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saveLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
