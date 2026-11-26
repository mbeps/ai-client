"use client";

import { AlertTriangle, Bot, ExternalLink, Unlink } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ModelReasoningEffortCard } from "@/components/chat/input/reasoning-effort-selector";
import { KnowledgebasePicker } from "@/components/chat/knowledgebase-picker";
import { SkillsPicker } from "@/components/chat/skills-picker";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { ModelSelector } from "@/components/shared/model-selector";
import { SubagentPicker } from "@/components/shared/subagent-picker";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROUTES } from "@/config/routes";
import { toggleSetItem } from "@/lib/toggle-set-item";
import type { Agent } from "@/types/agent/agent";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { Skill } from "@/types/skill/skill";
import type { AiStepNodeData } from "@/types/workflows/workflow";
import { AiStepOutputSection } from "./ai-step-output-section";

/** Props for {@link AiStepConfig}. */
export interface AiStepConfigProps {
  data: AiStepNodeData;
  mcpServers: McpServer[];
  knowledgebases?: Knowledgebase[];
  skills?: Skill[];
  agents?: Agent[];
  onChange: (updates: Partial<AiStepNodeData>) => void;
}

/**
 * Collapsible accordion inspector for AI Step nodes.
 */
export function AiStepConfig({
  data,
  mcpServers,
  knowledgebases = [],
  skills = [],
  agents = [],
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

  const linkedAgent = useMemo(
    () =>
      data.agentId
        ? agents.find((agent) => agent.id === data.agentId)
        : undefined,
    [agents, data.agentId],
  );

  const needsInfo = !data.agentId && !data.prompt.trim();
  const effectiveSkillMode = data.skillMode ?? "inherit";

  const ensureServerIncluded = (
    serverId: string,
    currentServerIds: string[],
  ) => {
    if (
      serverId !== "internal" &&
      currentServerIds.length > 0 &&
      !currentServerIds.includes(serverId)
    ) {
      return [...currentServerIds, serverId];
    }
    return undefined;
  };

  const handleToggleTool = (serverId: string, toolName: string) => {
    const toolId = `${serverId}:tool:${toolName}`;
    const isAdding = !selectedToolSet.has(toolId);
    const nextTools = Array.from(toggleSetItem(selectedToolSet, toolId));
    const nextServers = isAdding
      ? ensureServerIncluded(serverId, data.mcpServerIds)
      : undefined;
    onChange({
      toolIds: nextTools,
      ...(nextServers ? { mcpServerIds: nextServers } : {}),
    });
  };

  const handleBulkSelectToolGroups = (
    groups: Array<{ serverId: string; toolNames: string[] }>,
    select: boolean,
  ) => {
    const next = new Set(selectedToolSet);
    let nextServers = data.mcpServerIds;
    for (const { serverId, toolNames } of groups) {
      for (const name of toolNames) {
        const toolId = `${serverId}:tool:${name}`;
        if (select) {
          next.add(toolId);
        } else {
          next.delete(toolId);
        }
      }
      if (select) {
        const updated = ensureServerIncluded(serverId, nextServers);
        if (updated) nextServers = updated;
      }
    }
    onChange({
      toolIds: Array.from(next),
      ...(nextServers !== data.mcpServerIds
        ? { mcpServerIds: nextServers }
        : {}),
    });
  };

  const handleBulkSelectTools = (
    serverId: string,
    toolNames: string[],
    select: boolean,
  ) => {
    handleBulkSelectToolGroups([{ serverId, toolNames }], select);
  };

  const handleToggleSubagent = (agentId: string) => {
    const current = data.subagentIds ?? [];
    const next = current.includes(agentId)
      ? current.filter((id) => id !== agentId)
      : [...current, agentId];
    onChange({ subagentIds: next });
  };

  return (
    <div className="space-y-3">
      {data.agentId && (
        <LinkedAgentBanner
          linkedAgent={linkedAgent}
          onDetach={() => onChange({ agentId: undefined })}
        />
      )}

      <Accordion
        type="multiple"
        defaultValue={["instructions"]}
        className="space-y-2"
      >
        <AccordionItem value="instructions" className="rounded-lg border px-3">
          <AccordionTrigger className="py-2.5 text-xs font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              Instructions
              {needsInfo && (
                <Badge
                  variant="destructive"
                  className="px-1.5 py-0 text-[10px]"
                >
                  Needs info
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pt-1 pb-3">
            <MarkdownTabEditor
              value={data.prompt}
              onChange={(value) => onChange({ prompt: value })}
              placeholder={
                data.agentId
                  ? "Optional step-specific instructions (appended to agent persona)..."
                  : "Instruct the AI using {{variableName}} templates..."
              }
              minHeight="min-h-[140px]"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="connected-apps"
          className="rounded-lg border px-3"
        >
          <AccordionTrigger className="py-2.5 text-xs font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              Connected apps
              {data.toolIds.length > 0 && (
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 font-mono text-[10px]"
                >
                  {data.toolIds.length}
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-1 pb-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tool Approval Mode</Label>
              <Select
                value={data.toolApprovalMode ?? "inherit"}
                onValueChange={(value) =>
                  onChange({
                    toolApprovalMode:
                      value as AiStepNodeData["toolApprovalMode"],
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
              onBulkSelectBatch={handleBulkSelectToolGroups}
              maxHeight="280px"
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="knowledgebase" className="rounded-lg border px-3">
          <AccordionTrigger className="py-2.5 text-xs font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              Knowledgebase
              {(data.knowledgeBaseIds?.length ?? 0) > 0 && (
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 font-mono text-[10px]"
                >
                  {data.knowledgeBaseIds!.length}
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-1 pb-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Knowledge Bases</Label>
              <KnowledgebasePicker
                knowledgebases={knowledgebases}
                selectedIds={selectedKbSet}
                onSelect={(ids) =>
                  onChange({ knowledgeBaseIds: Array.from(ids) })
                }
                mode="multiple"
                allowEmpty={true}
                maxHeight="220px"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="skills" className="rounded-lg border px-3">
          <AccordionTrigger className="py-2.5 text-xs font-semibold hover:no-underline">
            <span className="flex items-center gap-2">
              Skills
              {effectiveSkillMode === "specific" &&
                (data.skillIds?.length ?? 0) > 0 && (
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 font-mono text-[10px]"
                  >
                    {data.skillIds!.length}
                  </Badge>
                )}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-1 pb-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Skill Loading Mode</Label>
              <Select
                value={effectiveSkillMode}
                onValueChange={(value) =>
                  onChange({
                    skillMode: value as AiStepNodeData["skillMode"],
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
                onSelectSkills={(ids) =>
                  onChange({ skillIds: Array.from(ids) })
                }
                maxHeight="220px"
              />
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Subagent Delegation</Label>
              <SubagentPicker
                agents={agents}
                selectedIds={data.subagentIds ?? []}
                onToggle={handleToggleSubagent}
                onSelectIds={(ids) => onChange({ subagentIds: ids })}
                columns={1}
                maxHeight="220px"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="more" className="rounded-lg border px-3">
          <AccordionTrigger className="py-2.5 text-xs font-semibold hover:no-underline">
            More
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-1 pb-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Model Override (optional)</Label>
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
                className="bg-card h-8 w-full border px-2.5 text-xs"
              />
              <ModelReasoningEffortCard
                modelId={data.modelId}
                value={data.reasoningEffort}
                onChange={(reasoningEffort) => onChange({ reasoningEffort })}
              />
            </div>

            <AiStepOutputSection data={data} onChange={onChange} />

            <div className="bg-muted/40 flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground">Output</span>
              <code className="font-mono text-[11px]">
                {`-> {{${data.variableName}}}`}
              </code>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

interface LinkedAgentBannerProps {
  linkedAgent: Agent | undefined;
  onDetach: () => void;
}

function LinkedAgentBanner({ linkedAgent, onDetach }: LinkedAgentBannerProps) {
  if (!linkedAgent) {
    return (
      <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="truncate text-xs font-medium">Linked agent not found</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive h-7 shrink-0 px-2 text-xs"
          onClick={onDetach}
        >
          <Unlink className="mr-1 h-3 w-3" />
          Detach
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-muted/40 flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Bot className="text-primary h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{linkedAgent.name}</p>
          <p className="text-muted-foreground truncate text-[11px]">
            Linked agent persona
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
          <Link
            href={
              linkedAgent.isBuiltIn
                ? ROUTES.AGENTS.path
                : ROUTES.AGENTS.detail(linkedAgent.id)
            }
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            Edit agent
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onDetach}
        >
          <Unlink className="mr-1 h-3 w-3" />
          Detach
        </Button>
      </div>
    </div>
  );
}
