"use client";

import { Check, Plus, Trash2, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AiStepConfig } from "@/components/workflows/canvas/config-sections/ai-step-config";
import { HttpRequestConfig } from "@/components/workflows/canvas/config-sections/http-request-config";
import { IfConditionConfig } from "@/components/workflows/canvas/config-sections/if-condition-config";
import { TriggerConfig } from "@/components/workflows/canvas/config-sections/trigger-config";
import type { McpServer } from "@/types/mcp/mcp-server";
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
  onUpdateNode,
  onDeleteNode,
  onRegenerateWebhookSecret,
  isNew = false,
  onConfirmAdd,
}: WorkflowNodeConfigSheetProps) {
  const upstreamVars = useMemo(() => {
    if (!node) return [];
    return collectUpstreamVariables(node.id, allNodes, edges);
  }, [node, allNodes, edges]);

  if (!node) return null;

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
      if (node.data.evaluationMode === "llm") {
        updateData({
          llmConditionPrompt:
            `${node.data.llmConditionPrompt ?? ""} ${token}`.trim(),
        });
      }
    } else if (node.data.kind === "http_request") {
      updateData({
        body: `${node.data.body ?? ""} ${token}`.trim(),
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{node.name}</SheetTitle>
          <SheetDescription>
            Configure node behavior and template inputs.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="workflow-node-name">Node Name</Label>
              <Input
                id="workflow-node-name"
                value={node.name}
                onChange={(e) =>
                  onUpdateNode(node.id, { name: e.target.value })
                }
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

        <SheetFooter className="flex-row justify-end gap-2">
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
