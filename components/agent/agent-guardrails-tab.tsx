"use client";

import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  AgentGuardrails,
  ScratchpadAccessMode,
} from "@/drizzle/schemas/agent-schema";

/**
 * Props for the AgentGuardrailsTab component.
 */
export interface AgentGuardrailsTabProps {
  guardrails: AgentGuardrails;
  onGuardrailsChange: (next: AgentGuardrails) => void;
  onSave: () => Promise<void> | void;
  isSaving?: boolean;
  saveLabel?: string;
  disabled?: boolean;
}

/**
 * Execution guardrails configuration tab applied when an Agent runs in Layer-2 subagent mode.
 */
export function AgentGuardrailsTab({
  guardrails,
  onGuardrailsChange,
  onSave,
  isSaving = false,
  saveLabel = "Save Guardrails",
  disabled = false,
}: AgentGuardrailsTabProps) {
  const handleMaxStepsChange = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(Math.max(parsed, 1), 30);
    onGuardrailsChange({ ...guardrails, maxSteps: clamped });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Subagent Guardrails</h3>
        <p className="text-muted-foreground text-sm">
          Execution boundaries enforced whenever this agent is invoked as a
          Layer-2 subagent via delegate_task.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="max-steps-input" className="text-sm font-medium">
            Max Steps (1–30)
          </label>
          <Input
            id="max-steps-input"
            type="number"
            min={1}
            max={30}
            value={guardrails.maxSteps}
            onChange={(e) => handleMaxStepsChange(e.target.value)}
            disabled={disabled}
            className="max-w-xs"
          />
          <p className="text-muted-foreground text-xs">
            Maximum tool-loop iterations allowed per delegated invocation.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Scratchpad Access</label>
          <Select
            value={guardrails.scratchpadAccess}
            onValueChange={(value) =>
              onGuardrailsChange({
                ...guardrails,
                scratchpadAccess: value as ScratchpadAccessMode,
              })
            }
            disabled={disabled}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="read_write">Read & Write (Default)</SelectItem>
              <SelectItem value="read_only">Read Only</SelectItem>
              <SelectItem value="none">None (Isolated)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Controls access to the shared ./.subagents/ virtual scratchpad.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5 pr-4">
            <label
              htmlFor="isolate-tools-switch"
              className="text-sm font-medium"
            >
              Isolate Tools & Resources
            </label>
            <p className="text-muted-foreground text-xs">
              When enabled, this subagent uses only its own configured tools,
              knowledge bases, and skills instead of inheriting parent chat
              tools.
            </p>
          </div>
          <Switch
            id="isolate-tools-switch"
            checked={guardrails.isolateTools}
            onCheckedChange={(checked) =>
              onGuardrailsChange({ ...guardrails, isolateTools: checked })
            }
            disabled={disabled}
          />
        </div>
      </div>

      {!disabled && (
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saveLabel}
        </Button>
      )}
    </div>
  );
}
