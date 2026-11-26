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
import { LayoutGrid, PanelRightOpen, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { WorkflowCanvasNodeData } from "@/components/workflows/canvas/base-workflow-node";
import type { WorkflowVisualNodeStatus } from "@/components/workflows/canvas/node-status-indicator";
import { WORKFLOW_NODE_TYPES } from "@/components/workflows/canvas/node-types";
import { useWorkflowEditorStore } from "@/components/workflows/canvas/workflow-editor-store";
import { WorkflowRightPanel } from "@/components/workflows/canvas/workflow-right-panel";
import {
  createAgentWorkflowNode,
  createDefaultWorkflowNode,
} from "@/components/workflows/editor/workflow-editor-helpers";
import type { Agent } from "@/types/agent/agent";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { Skill } from "@/types/skill/skill";
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
  knowledgebases?: Knowledgebase[];
  skills?: Skill[];
  agents?: Agent[];
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
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
  knowledgebases = [],
  skills = [],
  agents = [],
  selectedNodeId: controlledSelectedNodeId,
  onSelectNode,
  readOnly = false,
}: WorkflowCanvasProps) {
  const instance = useReactFlow();
  const {
    selectedNodeId: storeSelectedNodeId,
    setSelectedNodeId: setStoreSelectedNodeId,
    setEditorInstance,
  } = useWorkflowEditorStore();
  const selectedNodeId =
    controlledSelectedNodeId !== undefined
      ? controlledSelectedNodeId
      : storeSelectedNodeId;
  const setSelectedNodeId = onSelectNode ?? setStoreSelectedNodeId;
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
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

  const agentById = useMemo(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents],
  );

  const rfNodes = useMemo<Node<WorkflowCanvasNodeData>[]>(
    () =>
      nodes.map((node) => {
        const measured = measuredRef.current.get(node.id);
        const agentId =
          node.data.kind === "ai_step" ? node.data.agentId : undefined;
        const matchedAgent = agentId ? agentById.get(agentId) : undefined;
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
            ...(agentId
              ? {
                  linkedAgent: matchedAgent
                    ? { id: matchedAgent.id, name: matchedAgent.name }
                    : null,
                  missingAgent: !matchedAgent,
                }
              : {}),
            readOnly,
            onConfigure: readOnly
              ? undefined
              : (id) => {
                  setSelectedNodeId(id);
                  setMobilePanelOpen(true);
                },
            onDelete: readOnly
              ? undefined
              : (id) => onDeleteNodeRef.current?.(id),
          },
        };
      }),
    [nodes, selectedNodeId, nodeStates, readOnly, setSelectedNodeId, agentById],
  );

  const rfEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        selected: selectedEdgeIds.has(edge.id),
        label:
          edge.sourceHandle === "true" || edge.sourceHandle === "false"
            ? edge.sourceHandle
            : undefined,
        animated: nodeStates?.[edge.sourceNodeId]?.status === "running",
      })),
    [edges, nodeStates, selectedEdgeIds],
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
    const updated = changeset.applyTo(rfEdges);
    setSelectedEdgeIds(
      new Set(updated.filter((e) => e.selected).map((e) => e.id)),
    );
    if (readOnly || !onEdgesChange) return;
    const keepIds = new Set(updated.map((e) => e.id));
    if (keepIds.size !== edges.length) {
      onEdgesChange(edges.filter((e) => keepIds.has(e.id)));
    }
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

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );
  const hasManualTrigger = nodes.some((n) => n.type === "manual_trigger");

  const getDropPosition = () => {
    const offset = (nodes.length % 5) * 28;
    const center = instance.screenToFlowPosition({
      x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
      y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
    });
    return {
      x: Math.round(center.x + offset),
      y: Math.round(center.y + offset),
    };
  };

  const handleAddNode = (type: WorkflowNodeType) => {
    const position = getDropPosition();
    const created = createDefaultWorkflowNode(type, position, nodes);
    onAddNode?.(type, position, created);
    setSelectedNodeId(created.id);
  };

  const handleAddAgentNode = (agent: Agent) => {
    const position = getDropPosition();
    const created = createAgentWorkflowNode(agent, position, nodes);
    onAddNode?.("ai_step", position, created);
    setSelectedNodeId(created.id);
  };

  return (
    <div className="flex h-full min-h-[600px] w-full flex-1 overflow-hidden">
      <div className="relative h-full min-w-0 flex-1">
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
              setMobilePanelOpen(true);
            }
          }}
          onPaneClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeIds(new Set());
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobilePanelOpen(true)}
                aria-label="Open studio panel"
              >
                <PanelRightOpen className="h-3.5 w-3.5" />
              </Button>
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
      </div>

      {!readOnly && onUpdateNode && onDeleteNode && (
        <WorkflowRightPanel
          workflowId={workflowId}
          selectedNode={selectedNode}
          allNodes={nodes}
          edges={edges}
          webhookSecret={webhookSecret}
          mcpServers={mcpServers}
          knowledgebases={knowledgebases}
          skills={skills}
          agents={agents}
          mobileOpen={mobilePanelOpen}
          onMobileOpenChange={setMobilePanelOpen}
          onAddNode={handleAddNode}
          onAddAgentNode={handleAddAgentNode}
          onDeselectNode={() => setSelectedNodeId(null)}
          onUpdateNode={onUpdateNode}
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
