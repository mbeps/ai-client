"use client";

import {
  Check,
  Database,
  FileText,
  Network,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AiStepConfig,
  type AiStepSection,
} from "@/components/workflows/canvas/config-sections/ai-step-config";
import { HttpRequestConfig } from "@/components/workflows/canvas/config-sections/http-request-config";
import { IfConditionConfig } from "@/components/workflows/canvas/config-sections/if-condition-config";
import { TriggerConfig } from "@/components/workflows/canvas/config-sections/trigger-config";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/agent/agent";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { Skill } from "@/types/skill/skill";
import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
} from "@/types/workflows/workflow";

function collectUpstreamVariables(
  targetId: string,
  allNodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string[] {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
  const visited = new Set<string>([targetId]);
  const queue = [targetId];
  const vars: string[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const edge of edges) {
      if (edge.targetNodeId === currentId && !visited.has(edge.sourceNodeId)) {
        visited.add(edge.sourceNodeId);
        queue.push(edge.sourceNodeId);
        const upstream = nodeMap.get(edge.sourceNodeId);
        if (upstream?.data.variableName) {
          vars.push(upstream.data.variableName);
        }
      }
    }
  }
  return vars;
}

const AI_STEP_SECTIONS: Array<{
  id: AiStepSection;
  label: string;
  icon: typeof FileText;
}> = [
  { id: "prompt", label: "General", icon: FileText },
  { id: "tools", label: "Tools & MCP", icon: Wrench },
  { id: "knowledge", label: "Knowledge", icon: Database },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "subagents", label: "Subagents", icon: Network },
];

/** Props for {@link WorkflowNodeConfigSheet}. */
export interface WorkflowNodeConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: WorkflowNode | null;
  allNodes: WorkflowNode[];
  edges: WorkflowEdge[];
  workflowId: string;
  webhookSecret?: string | null;
  mcpServers: McpServer[];
  knowledgebases?: Knowledgebase[];
  skills?: Skill[];
  agents?: Agent[];
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onRegenerateWebhookSecret?: () => Promise<void> | void;
  isNew?: boolean;
  onConfirmAdd?: () => void;
}

/**
 * Right-hand inspector drawer for configuring a selected DAG workflow node.
 */
export function WorkflowNodeConfigSheet({
  open,
  onOpenChange,
  node,
  allNodes,
  edges,
  workflowId,
  webhookSecret,
  mcpServers,
  knowledgebases = [],
  skills = [],
  agents = [],
  onUpdateNode,
  onDeleteNode,
  onRegenerateWebhookSecret,
  isNew = false,
  onConfirmAdd,
}: WorkflowNodeConfigSheetProps) {
  const [aiSection, setAiSection] = useState<AiStepSection>("prompt");
  const [prevNodeId, setPrevNodeId] = useState<string | null>(node?.id ?? null);

  if ((node?.id ?? null) !== prevNodeId) {
    setPrevNodeId(node?.id ?? null);
    setAiSection("prompt");
  }

  const upstreamVars = useMemo(() => {
    if (!node) return [];
    return collectUpstreamVariables(node.id, allNodes, edges);
  }, [node, allNodes, edges]);

  if (!node) return null;

  const isAiStep = node.data.kind === "ai_step";

  const updateData = (partialData: Partial<WorkflowNodeData>) => {
    onUpdateNode(node.id, {
      data: { ...node.data, ...partialData } as WorkflowNodeData,
    });
  };

  const insertVariable = (varName: string) => {
    const token = `{{${varName}}}`;
    if (node.data.kind === "ai_step") {
      const separator = node.data.prompt ? " " : "";
      updateData({ prompt: `${node.data.prompt}${separator}${token}` });
    } else if (node.data.kind === "if_condition") {
      updateData({
        llmConditionPrompt:
          `${node.data.llmConditionPrompt ?? ""} ${token}`.trim(),
      });
    } else {
      updateData({
        body: `${(node.data as { body?: string }).body ?? ""} ${token}`.trim(),
      });
    }
  };

  const getSectionBadge = (
    sectionId: AiStepSection,
  ): string | number | null => {
    if (sectionId === "tools" && node.data.kind === "ai_step" && node.data.toolIds.length > 0) {
      return node.data.toolIds.length;
    }
    if (
      sectionId === "knowledge" &&
      (node.data.knowledgeBaseIds?.length ?? 0) > 0
    ) {
      return node.data.knowledgeBaseIds!.length;
    }
    if (
      sectionId === "skills" &&
      node.data.skillMode &&
      node.data.skillMode !== "inherit"
    ) {
      return node.data.skillMode === "specific"
        ? (node.data.skillIds?.length ?? 0)
        : node.data.skillMode;
    }
    if (sectionId === "subagents" && (node.data.subagentIds?.length ?? 0) > 0) {
      return node.data.subagentIds!.length;
    }
    return null;
  };

  const renderIdentityFields = () => (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="workflow-node-name">Node Name</Label>
          <Input
            id="workflow-node-name"
            value={node.name}
            onChange={(e) => onUpdateNode(node.id, { name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workflow-node-var">Variable Name</Label>
          <Input
            id="workflow-node-var"
            value={node.data.variableName}
            onChange={(e) => updateData({ variableName: e.target.value })}
            className="font-mono text-xs"
          />
        </div>
      </div>

      {upstreamVars.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Available Upstream Variables</Label>
          <div className="flex flex-wrap gap-1.5">
            {upstreamVars.map((varName) => (
              <Button
                key={varName}
                type="button"
                variant="secondary"
                size="sm"
                className="h-6 px-2 font-mono text-xs"
                onClick={() => insertVariable(varName)}
              >
                {`{{${varName}}}`}
              </Button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "flex h-full w-full flex-col gap-0 overflow-hidden p-0",
          isAiStep ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{node.name}</SheetTitle>
          <SheetDescription>
            Configure node behavior and template inputs.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {isAiStep && (
            <nav
              aria-label="AI node configuration sections"
              className="bg-muted/20 flex w-44 shrink-0 flex-col gap-1 border-r p-2"
            >
              {AI_STEP_SECTIONS.map((section) => {
                const Icon = section.icon;
                const badge = getSectionBadge(section.id);
                const isActive = aiSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setAiSection(section.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{section.label}</span>
                    {badge !== null && (
                      <Badge
                        variant="secondary"
                        className="ml-auto px-1.5 py-0 font-mono text-[10px]"
                      >
                        {badge}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-5 px-6 py-4">
              {(!isAiStep || aiSection === "prompt") && renderIdentityFields()}

              {(node.data.kind === "manual_trigger" ||
                node.data.kind === "webhook_trigger") && (
                <TriggerConfig
                  workflowId={workflowId}
                  webhookSecret={webhookSecret}
                  data={node.data}
                  onChange={updateData}
                  onRegenerateWebhookSecret={onRegenerateWebhookSecret}
                />
              )}

              {node.data.kind === "ai_step" && (
                <AiStepConfig
                  data={node.data}
                  mcpServers={mcpServers}
                  knowledgebases={knowledgebases}
                  skills={skills}
                  agents={agents}
                  activeSection={aiSection}
                  onChange={updateData}
                />
              )}

              {node.data.kind === "if_condition" && (
                <IfConditionConfig data={node.data} onChange={updateData} />
              )}

              {node.data.kind === "http_request" && (
                <HttpRequestConfig data={node.data} onChange={updateData} />
              )}
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-3">
          {isNew ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onConfirmAdd?.();
                  onOpenChange(false);
                }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Node
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDeleteNode(node.id);
                  onOpenChange(false);
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete Node
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Done
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
