"use client";

import {
  addEdge,
  Background,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LayoutGrid, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WorkflowCanvasNodeData } from "@/components/workflows/canvas/base-workflow-node";
import type { WorkflowVisualNodeStatus } from "@/components/workflows/canvas/node-status-indicator";
import { WORKFLOW_NODE_TYPES } from "@/components/workflows/canvas/node-types";
import { useWorkflowEditorStore } from "@/components/workflows/canvas/workflow-editor-store";
import { WorkflowNodeConfigSheet } from "@/components/workflows/canvas/workflow-node-config-sheet";
import { WorkflowNodePalette } from "@/components/workflows/canvas/workflow-node-palette";
import { createDefaultWorkflowNode } from "@/components/workflows/editor/workflow-editor-helpers";
import type { McpServer } from "@/types/mcp/mcp-server";
import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeRunState,
  WorkflowNodeType,
} from "@/types/workflows/workflow";

function mapRunStatus(state?: WorkflowNodeRunState): WorkflowVisualNodeStatus {
  return state ? state.status : "pending";
}

/** Props for {@link WorkflowCanvas}. */
export interface WorkflowCanvasProps {
  workflowId: string;
  webhookSecret?: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange?: (nodes: WorkflowNode[]) => void;
  onEdgesChange?: (edges: WorkflowEdge[]) => void;
  onAddNode?: (
    type: WorkflowNodeType,
    position: { x: number; y: number },
    configuredNode?: WorkflowNode,
  ) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<WorkflowNode>) => void;
  onDeleteNode?: (nodeId: string) => void;
  onAutoLayout?: () => void;
  onRunWorkflow?: () => void;
  onRegenerateWebhookSecret?: () => Promise<void> | void;
  nodeStates?: Record<string, WorkflowNodeRunState>;
  mcpServers?: McpServer[];
  readOnly?: boolean;
}

function WorkflowCanvasInner({
  workflowId,
  webhookSecret,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onAutoLayout,
  onRunWorkflow,
  onRegenerateWebhookSecret,
  nodeStates,
  mcpServers = [],
  readOnly = false,
}: WorkflowCanvasProps) {
  const instance = useReactFlow();
  const { selectedNodeId, setSelectedNodeId, setEditorInstance } =
    useWorkflowEditorStore();
  const [pendingNode, setPendingNode] = useState<WorkflowNode | null>(null);
  const [inspectorNodeId, setInspectorNodeId] = useState<string | null>(null);
  const measuredRef = useRef<Map<string, { width?: number; height?: number }>>(
    new Map(),
  );
  const onDeleteNodeRef = useRef(onDeleteNode);
  useEffect(() => {
    onDeleteNodeRef.current = onDeleteNode;
  }, [onDeleteNode]);

  useEffect(() => {
    setEditorInstance(instance);
    return () => setEditorInstance(null);
  }, [instance, setEditorInstance]);

  const rfNodes = useMemo<Node<WorkflowCanvasNodeData>[]>(
    () =>
      nodes.map((node) => {
        const measured = measuredRef.current.get(node.id);
        return {
          id: node.id,
          type: node.type,
          position: node.position,
          ...(measured ? { measured } : {}),
          selected: node.id === selectedNodeId,
          data: {
            label: node.name,
            nodeData: node.data,
            status: mapRunStatus(nodeStates?.[node.id]),
            readOnly,
            onConfigure: readOnly
              ? undefined
              : (id) => {
                  setSelectedNodeId(id);
                  setInspectorNodeId(id);
                },
            onDelete: readOnly
              ? undefined
              : (id) => onDeleteNodeRef.current?.(id),
          },
        };
      }),
    [nodes, selectedNodeId, nodeStates, readOnly, setSelectedNodeId],
  );

  const rfEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label:
          edge.sourceHandle === "true" || edge.sourceHandle === "false"
            ? edge.sourceHandle
            : undefined,
        animated: nodeStates?.[edge.sourceNodeId]?.status === "running",
      })),
    [edges, nodeStates],
  );

  const handleRfNodesChange: OnNodesChange<Node<WorkflowCanvasNodeData>> = (
    changeset,
  ) => {
    if (readOnly || !onNodesChange) return;
    const updated = changeset.applyTo(rfNodes);
    for (const rfNode of updated) {
      if (rfNode.measured) {
        measuredRef.current.set(rfNode.id, rfNode.measured);
      }
    }
    const updatedMap = new Map(updated.map((n) => [n.id, n]));
    const hasRemoved = updated.length !== nodes.length;
    const hasPositionChange = nodes.some((n) => {
      const next = updatedMap.get(n.id);
      return (
        next &&
        (next.position.x !== n.position.x || next.position.y !== n.position.y)
      );
    });
    if (!hasRemoved && !hasPositionChange) return;
    onNodesChange(
      nodes
        .filter((n) => updatedMap.has(n.id))
        .map((n) => ({
          ...n,
          position: updatedMap.get(n.id)?.position ?? n.position,
        })),
    );
  };

  const handleRfEdgesChange: OnEdgesChange<Edge> = (changeset) => {
    if (readOnly || !onEdgesChange) return;
    const updated = changeset.applyTo(rfEdges);
    const keepIds = new Set(updated.map((e) => e.id));
    onEdgesChange(edges.filter((e) => keepIds.has(e.id)));
  };

  const handleConnect = (connection: Connection) => {
    if (
      readOnly ||
      !onEdgesChange ||
      !connection.source ||
      !connection.target
    ) {
      return;
    }
    if (connection.source === connection.target) return;
    const nextRfEdges = addEdge(connection, rfEdges);
    const mapped: WorkflowEdge[] = nextRfEdges.map((edge) => ({
      id: edge.id || crypto.randomUUID(),
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      sourceHandle: edge.sourceHandle ?? "main",
      targetHandle: edge.targetHandle ?? "main",
    }));
    onEdgesChange(mapped);
  };

  const inspectedNode = useMemo(
    () => nodes.find((n) => n.id === inspectorNodeId) ?? null,
    [nodes, inspectorNodeId],
  );
  const activeInspectorNode = pendingNode ?? inspectedNode;
  const hasManualTrigger = nodes.some((n) => n.type === "manual_trigger");

  const handleOpenPendingNode = (
    type: WorkflowNodeType,
    position: { x: number; y: number },
  ) => {
    setSelectedNodeId(null);
    setInspectorNodeId(null);
    setPendingNode(createDefaultWorkflowNode(type, position, nodes));
  };

  return (
    <div className="relative h-full min-h-[600px] w-full flex-1">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={WORKFLOW_NODE_TYPES}
        onNodesChange={handleRfNodesChange}
        onEdgesChange={handleRfEdgesChange}
        onConnect={handleConnect}
        onNodeClick={(_, rfNode) => {
          setSelectedNodeId(rfNode.id);
        }}
        onNodeDoubleClick={(_, rfNode) => {
          if (!readOnly) {
            setSelectedNodeId(rfNode.id);
            setInspectorNodeId(rfNode.id);
          }
        }}
        onPaneClick={() => {
          setSelectedNodeId(null);
        }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={true}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap zoomable pannable />

        {!readOnly && (
          <Panel position="top-right" className="flex items-center gap-2">
            {onAddNode && (
              <WorkflowNodePalette onAddNode={handleOpenPendingNode} />
            )}
            {onAutoLayout && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAutoLayout}
              >
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                Auto-Layout
              </Button>
            )}
          </Panel>
        )}

        {!readOnly && hasManualTrigger && onRunWorkflow && (
          <Panel position="bottom-center">
            <Button type="button" size="sm" onClick={onRunWorkflow}>
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Run Workflow
            </Button>
          </Panel>
        )}
      </ReactFlow>

      {!readOnly && onUpdateNode && onDeleteNode && (
        <WorkflowNodeConfigSheet
          open={Boolean(activeInspectorNode)}
          onOpenChange={(open) => {
            if (!open) {
              setPendingNode(null);
              setInspectorNodeId(null);
            }
          }}
          node={activeInspectorNode}
          allNodes={nodes}
          edges={edges}
          workflowId={workflowId}
          webhookSecret={webhookSecret}
          mcpServers={mcpServers}
          isNew={Boolean(pendingNode)}
          onConfirmAdd={() => {
            if (pendingNode && onAddNode) {
              onAddNode(pendingNode.type, pendingNode.position, pendingNode);
              setPendingNode(null);
            }
          }}
          onUpdateNode={(nodeId, updates) => {
            if (pendingNode && pendingNode.id === nodeId) {
              setPendingNode((prev) => (prev ? { ...prev, ...updates } : null));
              return;
            }
            onUpdateNode(nodeId, updates);
          }}
          onDeleteNode={onDeleteNode}
          onRegenerateWebhookSecret={onRegenerateWebhookSecret}
        />
      )}
    </div>
  );
}

/**
 * Interactive React Flow DAG canvas wrapped in a dedicated provider.
 */
export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
