"use client";

import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { ModelSelector } from "@/components/shared/model-selector";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { AiStepNodeData } from "@/types/workflows/workflow";

/** Props for {@link AiStepConfig}. */
export interface AiStepConfigProps {
  data: AiStepNodeData;
  mcpServers: McpServer[];
  onChange: (updates: Partial<AiStepNodeData>) => void;
}

/**
 * Node inspector configuration section for AI Step nodes.
 */
export function AiStepConfig({
  data,
  mcpServers,
  onChange,
}: AiStepConfigProps) {
  const toggleServer = (serverId: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...data.mcpServerIds, serverId])]
      : data.mcpServerIds.filter((id) => id !== serverId);
    onChange({ mcpServerIds: next });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Prompt Template</Label>
        <MarkdownTabEditor
          value={data.prompt}
          onChange={(value) => onChange({ prompt: value })}
          placeholder="Instruct the AI using {{variableName}} templates..."
          minHeight="min-h-[160px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Model Override (optional)</Label>
        <ModelSelector
          value={data.modelId ?? ""}
          onValueChange={(value) => onChange({ modelId: value || undefined })}
          className="bg-card h-9 w-full border px-3"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tool Approval Mode</Label>
          <Select
            value={data.toolApprovalMode ?? "inherit"}
            onValueChange={(value) =>
              onChange({
                toolApprovalMode: value as AiStepNodeData["toolApprovalMode"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit workflow default</SelectItem>
              <SelectItem value="auto">Auto-run tools</SelectItem>
              <SelectItem value="ask">Ask before running</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Canvas Output Mode</Label>
          <Select
            value={data.canvasMode ?? "inherit"}
            onValueChange={(value) =>
              onChange({
                canvasMode: value as AiStepNodeData["canvasMode"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit workflow default</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="any">Any allowed format</SelectItem>
              <SelectItem value="markdown">Markdown</SelectItem>
              <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="mermaid">Mermaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ai-step-review-switch">Human Review Gate</Label>
            <p className="text-muted-foreground text-xs">
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
            <Label>Review Timing</Label>
            <Select
              value={data.reviewTiming ?? "after"}
              onValueChange={(value) =>
                onChange({ reviewTiming: value as "before" | "after" })
              }
            >
              <SelectTrigger>
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

      {mcpServers.length > 0 && (
        <div className="space-y-2">
          <Label>Enabled MCP Servers for This Step</Label>
          <div className="space-y-2 rounded-lg border p-3">
            {mcpServers
              .filter((server) => server.enabled)
              .map((server) => (
                <label
                  key={server.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={data.mcpServerIds.includes(server.id)}
                    onCheckedChange={(checked) =>
                      toggleServer(server.id, Boolean(checked))
                    }
                  />
                  <span>{server.name}</span>
                </label>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
