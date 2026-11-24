"use client";

import { Plus, Trash2 } from "lucide-react";
import { ModelReasoningEffortCard } from "@/components/chat/input/reasoning-effort-selector";
import { ModelSelector } from "@/components/shared/model-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  IfConditionNodeData,
  IfConditionOperator,
  IfConditionRule,
} from "@/types/workflows/workflow";

const OPERATORS: Array<{ value: IfConditionOperator; label: string }> = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Not Contains" },
  { value: "starts_with", label: "Starts With" },
  { value: "ends_with", label: "Ends With" },
  { value: "regex", label: "Matches Regex" },
  { value: "gt", label: "Greater Than" },
  { value: "lt", label: "Less Than" },
  { value: "is_empty", label: "Is Empty" },
  { value: "is_not_empty", label: "Is Not Empty" },
];

/** Props for {@link IfConditionConfig}. */
export interface IfConditionConfigProps {
  data: IfConditionNodeData;
  onChange: (updates: Partial<IfConditionNodeData>) => void;
}

/**
 * Node inspector configuration section for If Condition branching nodes.
 */
export function IfConditionConfig({ data, onChange }: IfConditionConfigProps) {
  const handleAddRule = () => {
    const rule: IfConditionRule = {
      id: crypto.randomUUID(),
      leftTemplate: "",
      operator: "equals",
      rightValue: "",
    };
    onChange({ rules: [...data.rules, rule] });
  };

  const handleUpdateRule = (
    ruleId: string,
    updates: Partial<IfConditionRule>,
  ) => {
    onChange({
      rules: data.rules.map((r) =>
        r.id === ruleId ? { ...r, ...updates } : r,
      ),
    });
  };

  const handleRemoveRule = (ruleId: string) => {
    onChange({ rules: data.rules.filter((r) => r.id !== ruleId) });
  };

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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Rules</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRule}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Rule
            </Button>
          </div>
          {data.rules.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
              No rules added yet. Click &quot;Add Rule&quot; to evaluate a
              value.
            </p>
          ) : (
            <div className="space-y-2">
              {data.rules.map((rule) => {
                const needsRight =
                  rule.operator !== "is_empty" &&
                  rule.operator !== "is_not_empty";
                return (
                  <div
                    key={rule.id}
                    className="space-y-2 rounded-md border p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={rule.leftTemplate}
                        onChange={(e) =>
                          handleUpdateRule(rule.id, {
                            leftTemplate: e.target.value,
                          })
                        }
                        placeholder="{{step1.summary}}"
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRule(rule.id)}
                      >
                        <Trash2 className="text-destructive h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={rule.operator}
                        onValueChange={(value) =>
                          handleUpdateRule(rule.id, {
                            operator: value as IfConditionOperator,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {needsRight && (
                        <Input
                          value={rule.rightValue ?? ""}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, {
                              rightValue: e.target.value,
                            })
                          }
                          placeholder="Expected value"
                          className="text-xs"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
