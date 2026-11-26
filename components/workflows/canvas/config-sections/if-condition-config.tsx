"use client";

import { ModelReasoningEffortCard } from "@/components/chat/input/reasoning-effort-selector";
import { ModelSelector } from "@/components/shared/model-selector";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { IfConditionNodeData } from "@/types/workflows/workflow";
import { RuleListEditor } from "./rule-list-editor";

/** Props for {@link IfConditionConfig}. */
export interface IfConditionConfigProps {
  data: IfConditionNodeData;
  onChange: (updates: Partial<IfConditionNodeData>) => void;
}

/**
 * Node inspector configuration section for If Condition branching nodes.
 */
export function IfConditionConfig({ data, onChange }: IfConditionConfigProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Evaluation Mode</Label>
          <Select
            value={data.evaluationMode}
            onValueChange={(value) =>
              onChange({
                evaluationMode: value as IfConditionNodeData["evaluationMode"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deterministic">Deterministic Rules</SelectItem>
              <SelectItem value="llm">LLM Condition</SelectItem>
              <SelectItem value="hybrid">Hybrid (Rules + LLM)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Rule Logic</Label>
          <Select
            value={data.logic}
            onValueChange={(value) =>
              onChange({ logic: value as "and" | "or" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">ALL rules match (AND)</SelectItem>
              <SelectItem value="or">ANY rule matches (OR)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {data.evaluationMode !== "llm" && (
        <RuleListEditor
          label="Rules"
          rules={data.rules}
          leftPlaceholder="{{step1.summary}}"
          emptyHint='No rules added yet. Click "Add Rule" to evaluate a value.'
          onChange={(rules) => onChange({ rules })}
        />
      )}

      {data.evaluationMode !== "deterministic" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="if-llm-prompt">LLM Condition Prompt</Label>
            <Textarea
              id="if-llm-prompt"
              rows={3}
              value={data.llmConditionPrompt ?? ""}
              onChange={(e) => onChange({ llmConditionPrompt: e.target.value })}
              placeholder="Return true when the invoice total exceeds budget..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Judge Model (optional)</Label>
            <ModelSelector
              value={data.modelId ?? ""}
              onValueChange={(value) =>
                onChange({
                  modelId: value || undefined,
                  ...(value ? {} : { reasoningEffort: undefined }),
                })
              }
              allowClear
              placeholder="Inherit workflow default"
              className="bg-card h-9 w-full border px-3"
            />
            <ModelReasoningEffortCard
              modelId={data.modelId}
              value={data.reasoningEffort}
              onChange={(reasoningEffort) => onChange({ reasoningEffort })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
