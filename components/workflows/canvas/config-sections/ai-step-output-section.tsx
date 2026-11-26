"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AiStepNodeData } from "@/types/workflows/workflow";
import { StructuredOutputSchemaEditor } from "./structured-output-editor";

interface AiStepOutputSectionProps {
  data: AiStepNodeData;
  onChange: (updates: Partial<AiStepNodeData>) => void;
}

/**
 * Output mode (Plain text, Structured JSON, Canvas) and Human Review Gate
 * controls for an AI Step node's "More" accordion section.
 */
export function AiStepOutputSection({
  data,
  onChange,
}: AiStepOutputSectionProps) {
  const resolvedOutputMode =
    data.outputMode ??
    (data.canvasMode &&
    data.canvasMode !== "inherit" &&
    data.canvasMode !== "disabled"
      ? "canvas"
      : "text");

  return (
    <>
      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Output</Label>
          <Select
            value={resolvedOutputMode}
            onValueChange={(value) => {
              const outputMode = value as NonNullable<
                AiStepNodeData["outputMode"]
              >;
              onChange({
                outputMode,
                ...(outputMode === "text" ? { canvasMode: "disabled" } : {}),
                ...(outputMode === "canvas" && data.canvasMode === "disabled"
                  ? { canvasMode: "inherit" }
                  : {}),
                ...(outputMode === "structured" && !data.structuredOutputSchema
                  ? { structuredOutputSchema: { fields: [] } }
                  : {}),
              });
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Plain text</SelectItem>
              <SelectItem value="structured">Structured JSON</SelectItem>
              <SelectItem value="canvas">Canvas (Artifact)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {resolvedOutputMode === "structured" && (
          <StructuredOutputSchemaEditor
            value={data.structuredOutputSchema}
            onChange={(structuredOutputSchema) =>
              onChange({ structuredOutputSchema })
            }
          />
        )}

        {resolvedOutputMode === "canvas" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Canvas Format</Label>
            <Select
              value={data.canvasMode ?? "inherit"}
              onValueChange={(value) =>
                onChange({
                  canvasMode: value as AiStepNodeData["canvasMode"],
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">
                  Inherit workflow default
                </SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="any">Any allowed format</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="mermaid">Mermaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <Label htmlFor="ai-step-review-switch" className="text-xs">
              Human Review Gate
            </Label>
            <p className="text-muted-foreground text-[11px]">
              Pause workflow for human approval on this step.
            </p>
          </div>
          <Switch
            id="ai-step-review-switch"
            checked={data.requiresReview}
            onCheckedChange={(checked) => onChange({ requiresReview: checked })}
          />
        </div>
        {data.requiresReview && (
          <div className="space-y-1.5">
            <Label className="text-xs">Review Timing</Label>
            <Select
              value={data.reviewTiming ?? "after"}
              onValueChange={(value) =>
                onChange({ reviewTiming: value as "before" | "after" })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before running step</SelectItem>
                <SelectItem value="after">After step completes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </>
  );
}
