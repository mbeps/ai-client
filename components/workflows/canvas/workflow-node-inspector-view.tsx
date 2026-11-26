"use client";

import {
  ArrowLeft,
  GitBranch,
  Globe,
  Play,
  Sparkles,
  Trash2,
  Webhook,
} from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AiStepConfig } from "@/components/workflows/canvas/config-sections/ai-step-config";
import { HttpRequestConfig } from "@/components/workflows/canvas/config-sections/http-request-config";
import { IfConditionConfig } from "@/components/workflows/canvas/config-sections/if-condition-config";
import { TriggerConfig } from "@/components/workflows/canvas/config-sections/trigger-config";
import type { Agent } from "@/types/agent/agent";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { Skill } from "@/types/skill/skill";
import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeType,
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

function getNodeIcon(kind: WorkflowNodeType) {
  switch (kind) {
    case "manual_trigger":
      return Play;
    case "webhook_trigger":
      return Webhook;
    case "ai_step":
      return Sparkles;
    case "if_condition":
      return GitBranch;
    case "http_request":
      return Globe;
  }
}

/** Props for {@link WorkflowNodeInspectorView}. */
export interface WorkflowNodeInspectorViewProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  edges: WorkflowEdge[];
  workflowId: string;
  webhookSecret?: string | null;
  mcpServers: McpServer[];
  knowledgebases?: Knowledgebase[];
  skills?: Skill[];
  agents?: Agent[];
  onBack: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onRegenerateWebhookSecret?: () => Promise<void> | void;
}

/**
 * Docked inspector view for configuring a selected workflow node.
 */
export function WorkflowNodeInspectorView({
  node,
  allNodes,
  edges,
  workflowId,
  webhookSecret,
  mcpServers,
  knowledgebases = [],
  skills = [],
  agents = [],
  onBack,
  onUpdateNode,
  onDeleteNode,
  onRegenerateWebhookSecret,
}: WorkflowNodeInspectorViewProps) {
  const upstreamVars = useMemo(
    () => collectUpstreamVariables(node.id, allNodes, edges),
    [node.id, allNodes, edges],
  );

  const Icon = getNodeIcon(node.data.kind);

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
    } else if (
      node.data.kind === "if_condition" &&
      node.data.evaluationMode === "llm"
    ) {
      updateData({
        llmConditionPrompt:
          `${node.data.llmConditionPrompt ?? ""} ${token}`.trim(),
      });
    } else if (node.data.kind === "http_request") {
      updateData({
        body: `${node.data.body ?? ""} ${token}`.trim(),
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label="Back to palette"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
        <Input
          aria-label="Node Name"
          value={node.name}
          onChange={(e) => onUpdateNode(node.id, { name: e.target.value })}
          className="focus-visible:border-input h-7 min-w-0 flex-1 border-transparent bg-transparent px-1.5 text-sm font-medium"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0"
          aria-label="Delete node"
          onClick={() => onDeleteNode(node.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          <div className="space-y-1">
            <Label
              htmlFor="workflow-node-var"
              className="text-muted-foreground text-[11px]"
            >
              Variable Name
            </Label>
            <Input
              id="workflow-node-var"
              value={node.data.variableName}
              onChange={(e) => updateData({ variableName: e.target.value })}
              className="h-8 font-mono text-xs"
            />
          </div>

          {upstreamVars.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">
                Upstream Variables
              </Label>
              <div className="flex flex-wrap gap-1">
                {upstreamVars.map((varName) => (
                  <Button
                    key={varName}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 font-mono text-[11px]"
                    onClick={() => insertVariable(varName)}
                  >
                    {`{{${varName}}}`}
                  </Button>
                ))}
              </div>
            </div>
          )}

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
  );
}
