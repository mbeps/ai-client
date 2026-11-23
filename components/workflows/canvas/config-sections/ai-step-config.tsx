"use client";

import { useMemo } from "react";
import { KnowledgebasePicker } from "@/components/chat/knowledgebase-picker";
import { SkillsPicker } from "@/components/chat/skills-picker";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { ModelSelector } from "@/components/shared/model-selector";
import { SubagentPicker } from "@/components/shared/subagent-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toggleSetItem } from "@/lib/toggle-set-item";
import type { Agent } from "@/types/agent/agent";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { Skill } from "@/types/skill/skill";
import type { AiStepNodeData } from "@/types/workflows/workflow";

/** Navigation sections supported by the AI Step inspector. */
export type AiStepSection =
  | "prompt"
  | "tools"
  | "knowledge"
  | "skills"
  | "subagents";

/** Props for {@link AiStepConfig}. */
export interface AiStepConfigProps {
  data: AiStepNodeData;
  mcpServers: McpServer[];
  knowledgebases?: Knowledgebase[];
  skills?: Skill[];
  agents?: Agent[];
  activeSection?: AiStepSection;
  onChange: (updates: Partial<AiStepNodeData>) => void;
}

/**
 * Node inspector configuration section for AI Step nodes.
 */
export function AiStepConfig({
  data,
  mcpServers,
  knowledgebases = [],
  skills = [],
  agents = [],
  activeSection = "prompt",
  onChange,
}: AiStepConfigProps) {
  const selectedToolSet = useMemo(
    () => new Set(data.toolIds ?? []),
    [data.toolIds],
  );
  const selectedKbSet = useMemo(
    () => new Set(data.knowledgeBaseIds ?? []),
    [data.knowledgeBaseIds],
  );
  const selectedSkillSet = useMemo(
    () => new Set(data.skillIds ?? []),
    [data.skillIds],
  );
  const enabledServers = useMemo(
    () => mcpServers.filter((server) => server.enabled),
    [mcpServers],
  );

  const ensureServerIncluded = (serverId: string) => {
    if (
      serverId !== "internal" &&
      data.mcpServerIds.length > 0 &&
      !data.mcpServerIds.includes(serverId)
    ) {
      return [...data.mcpServerIds, serverId];
    }
    return undefined;
  };

  const handleToggleTool = (serverId: string, toolName: string) => {
    const toolId = `${serverId}:tool:${toolName}`;
    const isAdding = !selectedToolSet.has(toolId);
    const nextTools = Array.from(toggleSetItem(selectedToolSet, toolId));
    const nextServers = isAdding ? ensureServerIncluded(serverId) : undefined;
    onChange({
      toolIds: nextTools,
      ...(nextServers ? { mcpServerIds: nextServers } : {}),
    });
  };

  const handleBulkSelectTools = (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => {
    const next = new Set(selectedToolSet);
    for (const name of toolNames) {
      const toolId = `${serverId}:tool:${name}`;
      if (select) {
        next.add(toolId);
      } else {
        next.delete(toolId);
      }
    }
    const nextServers = select ? ensureServerIncluded(serverId) : undefined;
    onChange({
      toolIds: Array.from(next),
      ...(nextServers ? { mcpServerIds: nextServers } : {}),
    });
  };

  const handleToggleSubagent = (agentId: string) => {
    const current = data.subagentIds ?? [];
    const next = current.includes(agentId)
      ? current.filter((id) => id !== agentId)
      : [...current, agentId];
    onChange({ subagentIds: next });
  };

  if (activeSection === "tools") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Tools &amp; MCP Capabilities</h4>
          <p className="text-muted-foreground text-xs">
            Select specific MCP and internal tools for this step. Leave empty to
            inherit workflow defaults.
          </p>
        </div>

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
              <SelectItem value="auto">Auto-approve</SelectItem>
              <SelectItem value="ask">Ask before running tools</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ToolPickerList
          servers={enabledServers}
          selectedTools={selectedToolSet}
          onToggleTool={handleToggleTool}
          onBulkSelect={handleBulkSelectTools}
          maxHeight="420px"
        />
      </div>
    );
  }

  if (activeSection === "knowledge") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Knowledge Bases</h4>
          <p className="text-muted-foreground text-xs">
            Override workflow knowledge bases for this step. Leave none selected
            to inherit workflow defaults.
          </p>
        </div>
        <KnowledgebasePicker
          knowledgebases={knowledgebases}
          selectedIds={selectedKbSet}
          onSelect={(ids) => onChange({ knowledgeBaseIds: Array.from(ids) })}
          mode="multiple"
          allowEmpty={true}
          maxHeight="460px"
        />
      </div>
    );
  }

  if (activeSection === "skills") {
    const effectiveSkillMode = data.skillMode ?? "inherit";
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Agent Skills</h4>
          <p className="text-muted-foreground text-xs">
            Control how agent skills are loaded during this step.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Skill Loading Mode</Label>
          <Select
            value={effectiveSkillMode}
            onValueChange={(value) =>
              onChange({
                skillMode: value as AiStepNodeData["skillMode"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit workflow default</SelectItem>
              <SelectItem value="dynamic">Dynamic Loading</SelectItem>
              <SelectItem value="none">No Skills</SelectItem>
              <SelectItem value="specific">Specific Skills</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {effectiveSkillMode === "specific" && (
          <SkillsPicker
            skills={skills}
            selectedIds={selectedSkillSet}
            onToggleSkill={(id) =>
              onChange({
                skillIds: Array.from(toggleSetItem(selectedSkillSet, id)),
              })
            }
            onSelectSkills={(ids) => onChange({ skillIds: Array.from(ids) })}
            maxHeight="400px"
          />
        )}
      </div>
    );
  }

  if (activeSection === "subagents") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Subagent Delegation</h4>
          <p className="text-muted-foreground text-xs">
            Select leaf or built-in subagents this step can delegate tasks to.
            Leave none selected to inherit workflow defaults.
          </p>
        </div>
        <SubagentPicker
          agents={agents}
          selectedIds={data.subagentIds ?? []}
          onToggle={handleToggleSubagent}
          onSelectIds={(ids) => onChange({ subagentIds: ids })}
          columns={1}
          maxHeight="460px"
        />
      </div>
    );
  }

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
        <p className="text-muted-foreground text-xs">
          Uses the workflow-defined model by default when no override is
          selected.
        </p>
        <ModelSelector
          value={data.modelId ?? ""}
          onValueChange={(value) => onChange({ modelId: value || undefined })}
          allowClear
          placeholder="Inherit workflow default"
          className="bg-card h-9 w-full border px-3"
        />
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
    </div>
  );
}
