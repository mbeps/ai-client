"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
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
import type {
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

/** Props for {@link RuleListEditor}. */
export interface RuleListEditorProps {
  label: string;
  rules: IfConditionRule[];
  defaultLeftTemplate?: string;
  leftPlaceholder: string;
  emptyHint: ReactNode;
  onChange: (rules: IfConditionRule[]) => void;
}

/**
 * Shared deterministic rule list editor used by Filter and If Condition nodes.
 */
export function RuleListEditor({
  label,
  rules,
  defaultLeftTemplate = "",
  leftPlaceholder,
  emptyHint,
  onChange,
}: RuleListEditorProps) {
  const handleAddRule = () => {
    const rule: IfConditionRule = {
      id: crypto.randomUUID(),
      leftTemplate: defaultLeftTemplate,
      operator: "equals",
      rightValue: "",
    };
    onChange([...rules, rule]);
  };

  const handleUpdateRule = (
    ruleId: string,
    updates: Partial<IfConditionRule>,
  ) => {
    onChange(rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)));
  };

  const handleRemoveRule = (ruleId: string) => {
    onChange(rules.filter((r) => r.id !== ruleId));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
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
      {rules.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs">
          {emptyHint}
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const needsRight =
              rule.operator !== "is_empty" && rule.operator !== "is_not_empty";
            return (
              <div
                key={rule.id}
                className="bg-muted/30 space-y-2 rounded-md border p-2.5"
              >
                <div className="flex items-center gap-1.5">
                  <Input
                    placeholder={leftPlaceholder}
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
                  {needsRight && (
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
            );
          })}
        </div>
      )}
    </div>
  );
}
