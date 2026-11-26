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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type {
  FilterNodeData,
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

/** Props for {@link FilterConfig}. */
export interface FilterConfigProps {
  data: FilterNodeData;
  onChange: (updates: Partial<FilterNodeData>) => void;
}

/**
 * Node inspector configuration section for Filter flow-control nodes.
 */
export function FilterConfig({ data, onChange }: FilterConfigProps) {
  const handleAddRule = () => {
    const rule: IfConditionRule = {
      id: crypto.randomUUID(),
      leftTemplate: "{{item}}",
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
      <div className="space-y-1.5">
        <Label htmlFor="filter-items-template">Items Array Template</Label>
        <Input
          id="filter-items-template"
          placeholder="{{step1.items}}"
          value={data.itemsTemplate}
          onChange={(e) => onChange({ itemsTemplate: e.target.value })}
          className="font-mono text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="filter-eval-mode">Evaluation Mode</Label>
          <Select
            value={data.evaluationMode}
            onValueChange={(value) =>
              onChange({
                evaluationMode: value as FilterNodeData["evaluationMode"],
              })
            }
          >
            <SelectTrigger id="filter-eval-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deterministic">Deterministic Rules</SelectItem>
              <SelectItem value="llm">LLM Filter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.evaluationMode === "deterministic" && (
          <div className="space-y-1.5">
            <Label htmlFor="filter-logic">Rule Logic</Label>
            <Select
              value={data.logic}
              onValueChange={(value) =>
                onChange({ logic: value as FilterNodeData["logic"] })
              }
            >
              <SelectTrigger id="filter-logic">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">All rules match (AND)</SelectItem>
                <SelectItem value="or">Any rule matches (OR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {data.evaluationMode === "deterministic" ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label>Item Rules</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={handleAddRule}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Rule
            </Button>
          </div>
          {data.rules.length === 0 ? (
            <p className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">
              No rules added. Use{" "}
              <code className="font-mono">{"{{item}}"}</code> to reference each
              array element.
            </p>
          ) : (
            <div className="space-y-2">
              {data.rules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-muted/30 space-y-2 rounded-md border p-2.5"
                >
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder="{{item.priority}}"
                      value={rule.leftTemplate}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, {
                          leftTemplate: e.target.value,
                        })
                      }
                      className="h-8 flex-1 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                      onClick={() => handleRemoveRule(rule.id)}
                      aria-label="Remove rule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Select
                      value={rule.operator}
                      onValueChange={(value) =>
                        handleUpdateRule(rule.id, {
                          operator: value as IfConditionOperator,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
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
                    {rule.operator !== "is_empty" &&
                      rule.operator !== "is_not_empty" && (
                        <Input
                          placeholder="Expected value"
                          value={rule.rightValue ?? ""}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, {
                              rightValue: e.target.value,
                            })
                          }
                          className="h-8 text-xs"
                        />
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="filter-llm-prompt">Filter Criteria Prompt</Label>
            <Textarea
              id="filter-llm-prompt"
              rows={3}
              placeholder="Keep items that are urgent customer bugs..."
              value={data.llmFilterPrompt ?? ""}
              onChange={(e) => onChange({ llmFilterPrompt: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Judge Model</Label>
            <ModelSelector
              value={data.modelId ?? ""}
              onValueChange={(modelId) => onChange({ modelId })}
              placeholder="Use workspace default"
            />
          </div>
          <ModelReasoningEffortCard
            modelId={data.modelId}
            value={data.reasoningEffort}
            onChange={(reasoningEffort) => onChange({ reasoningEffort })}
          />
        </div>
      )}

      <div className="flex items-center justify-between rounded-md border p-2.5">
        <div className="space-y-0.5">
          <Label htmlFor="filter-continue-empty" className="text-xs">
            Continue when empty
          </Label>
          <p className="text-muted-foreground text-[11px]">
            Proceed to downstream nodes even if 0 items match.
          </p>
        </div>
        <Switch
          id="filter-continue-empty"
          checked={data.continueWhenEmpty ?? true}
          onCheckedChange={(checked) =>
            onChange({ continueWhenEmpty: checked })
          }
        />
      </div>
    </div>
  );
}
