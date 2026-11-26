"use client";

import { ModelReasoningEffortCard } from "@/components/chat/input/reasoning-effort-selector";
import { ModelSelector } from "@/components/shared/model-selector";
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
import type { FilterNodeData } from "@/types/workflows/workflow";
import { RuleListEditor } from "./rule-list-editor";

/** Props for {@link FilterConfig}. */
export interface FilterConfigProps {
  data: FilterNodeData;
  onChange: (updates: Partial<FilterNodeData>) => void;
}

/**
 * Node inspector configuration section for Filter flow-control nodes.
 */
export function FilterConfig({ data, onChange }: FilterConfigProps) {
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
        <RuleListEditor
          label="Item Rules"
          rules={data.rules}
          defaultLeftTemplate="{{item}}"
          leftPlaceholder="{{item.priority}}"
          emptyHint={
            <>
              No rules added. Use{" "}
              <code className="font-mono">{"{{item}}"}</code> to reference each
              array element.
            </>
          }
          onChange={(rules) => onChange({ rules })}
        />
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
              onValueChange={(value) =>
                onChange({
                  modelId: value || undefined,
                  ...(value ? {} : { reasoningEffort: undefined }),
                })
              }
              allowClear
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
