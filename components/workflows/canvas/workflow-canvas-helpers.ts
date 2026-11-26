import { addEdge, type Connection, type Edge, type Node } from "@xyflow/react";
import type { WorkflowCanvasNodeData } from "@/components/workflows/canvas/base-workflow-node";
import type { WorkflowVisualNodeStatus } from "@/components/workflows/canvas/node-status-indicator";
import type { Agent } from "@/types/agent/agent";
import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

const HANDLE_LABELS = new Set(["true", "false", "body", "done"]);

export function mapRunStatus(
  state?: WorkflowNodeRunState,
): WorkflowVisualNodeStatus {
  return state ? state.status : "pending";
}

/** Map domain workflow nodes into React Flow node objects. */
export function toReactFlowNodes(params: {
  nodes: WorkflowNode[];
  measuredMap: Map<string, { width?: number; height?: number }>;
  agentById: Map<string, Agent>;
  selectedNodeId: string | null;
  nodeStates?: Record<string, WorkflowNodeRunState>;
  readOnly: boolean;
  onConfigure?: (id: string) => void;
  onDelete?: (id: string) => void;
}): Node<WorkflowCanvasNodeData>[] {
  const {
    nodes,
    measuredMap,
    agentById,
    selectedNodeId,
    nodeStates,
    readOnly,
    onConfigure,
    onDelete,
  } = params;

  return nodes.map((node) => {
    const measured = measuredMap.get(node.id);
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
        onConfigure: readOnly ? undefined : onConfigure,
        onDelete: readOnly ? undefined : onDelete,
      },
    };
  });
}

/** Map domain workflow edges into React Flow edge objects. */
export function toReactFlowEdges(params: {
  edges: WorkflowEdge[];
  nodeStates?: Record<string, WorkflowNodeRunState>;
  selectedEdgeIds: Set<string>;
}): Edge[] {
  const { edges, nodeStates, selectedEdgeIds } = params;
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    selected: selectedEdgeIds.has(edge.id),
    label: HANDLE_LABELS.has(edge.sourceHandle ?? "")
      ? edge.sourceHandle
      : undefined,
    animated: nodeStates?.[edge.sourceNodeId]?.status === "running",
  }));
}

/**
 * Reconcile updated React Flow nodes back into domain nodes.
 * Returns `null` when neither node membership nor positions changed.
 */
export function applyReactFlowNodesChanges(
  nodes: WorkflowNode[],
  updated: Node<WorkflowCanvasNodeData>[],
): WorkflowNode[] | null {
  const updatedMap = new Map(updated.map((n) => [n.id, n]));
  const hasRemoved = updated.length !== nodes.length;
  const hasPositionChange = nodes.some((n) => {
    const next = updatedMap.get(n.id);
    return (
      next &&
      (next.position.x !== n.position.x || next.position.y !== n.position.y)
    );
  });
  if (!hasRemoved && !hasPositionChange) return null;

  return nodes
    .filter((n) => updatedMap.has(n.id))
    .map((n) => ({
      ...n,
      position: updatedMap.get(n.id)?.position ?? n.position,
    }));
}

/** Connect a new React Flow edge and map the full edge list back to domain edges. */
export function mapConnectedEdges(
  connection: Connection,
  rfEdges: Edge[],
): WorkflowEdge[] {
  return addEdge(connection, rfEdges).map((edge) => ({
    id: edge.id || crypto.randomUUID(),
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    sourceHandle: edge.sourceHandle ?? "main",
    targetHandle: edge.targetHandle ?? "main",
  }));
}
