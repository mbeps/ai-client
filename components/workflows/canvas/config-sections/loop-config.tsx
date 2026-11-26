"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LoopNodeData } from "@/types/workflows/workflow";

/** Props for {@link LoopConfig}. */
export interface LoopConfigProps {
  data: LoopNodeData;
  onChange: (updates: Partial<LoopNodeData>) => void;
}

/**
 * Node inspector configuration section for Loop flow-control nodes.
 */
export function LoopConfig({ data, onChange }: LoopConfigProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="loop-mode">Loop Mode</Label>
        <Select
          value={data.mode}
          onValueChange={(value) =>
            onChange({ mode: value as LoopNodeData["mode"] })
          }
        >
          <SelectTrigger id="loop-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="for_each">For Each Item</SelectItem>
            <SelectItem value="count">Fixed Count</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.mode === "for_each" ? (
        <div className="space-y-1.5">
          <Label htmlFor="loop-items-template">Items Array Template</Label>
          <Input
            id="loop-items-template"
            placeholder="{{step1.items}}"
            value={data.itemsTemplate ?? ""}
            onChange={(e) => onChange({ itemsTemplate: e.target.value })}
            className="font-mono text-xs"
          />
          <p className="text-muted-foreground text-[11px]">
            Body nodes can reference{" "}
            <code className="font-mono">{`{{${data.variableName}.item}}`}</code>{" "}
            and{" "}
            <code className="font-mono">{`{{${data.variableName}.index}}`}</code>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="loop-count">Iteration Count</Label>
          <Input
            id="loop-count"
            type="number"
            min={1}
            max={50}
            value={data.count ?? 1}
            onChange={(e) =>
              onChange({
                count: Math.min(
                  50,
                  Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                ),
              })
            }
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="loop-max-iterations">Max Iterations</Label>
        <Input
          id="loop-max-iterations"
          type="number"
          min={1}
          max={50}
          value={data.maxIterations}
          onChange={(e) =>
            onChange({
              maxIterations: Math.min(
                50,
                Math.max(1, Number.parseInt(e.target.value, 10) || 1),
              ),
            })
          }
        />
      </div>
    </div>
  );
}
