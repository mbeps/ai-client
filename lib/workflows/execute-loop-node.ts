import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import { resolveWorkflowTemplateValue } from "@/lib/workflows/compile-template";
import { resolveNodeExecutionEligibility } from "@/lib/workflows/dag-planner";
import { updateActiveWorkflowRun } from "@/lib/workflows/workflow-run-db";
import { executeNodeWithGates } from "@/lib/workflows/workflow-run-gates";
import {
  failWorkflowRun,
  type WorkflowRunExecutionRow,
  type WorkflowStepTools,
} from "@/lib/workflows/workflow-run-helpers";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type {
  LoopNodeData,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

const MAX_LOOP_ITERATIONS = 50;
const DEFAULT_MAX_LOOP_ITERATIONS = 20;

function resolveLoopItems(
  loopData: LoopNodeData,
  initialData: Record<string, unknown>,
  contextData: Record<string, unknown>,
): { ok: true; items: unknown[] } | { ok: false; errorMessage: string } {
  if (loopData.mode === "for_each") {
    const resolved = resolveWorkflowTemplateValue(
      loopData.itemsTemplate ?? "",
      { ...initialData, ...contextData },
    );
    if (!Array.isArray(resolved)) {
      return {
        ok: false,
        errorMessage: `expected an array from "${loopData.itemsTemplate ?? ""}"`,
      };
    }
    return { ok: true, items: resolved };
  }

  const count = Math.max(0, Math.min(MAX_LOOP_ITERATIONS, loopData.count ?? 0));
  return {
    ok: true,
    items: Array.from({ length: count }, (_, i) => i),
  };
}

function collectIterationResult(
  terminalBodyNodes: WorkflowNode[],
  iterContextData: Record<string, unknown>,
  fallbackItem: unknown,
): unknown {
  if (terminalBodyNodes.length === 0) {
    return fallbackItem;
  }
  if (terminalBodyNodes.length === 1) {
    return iterContextData[terminalBodyNodes[0].data.variableName];
  }
  const combined: Record<string, unknown> = {};
  for (const tn of terminalBodyNodes) {
    combined[tn.data.variableName] = iterContextData[tn.data.variableName];
  }
  return combined;
}

/**
 * Executes a `loop` flow-control node by iterating over its body subgraph
 * with durable per-iteration Inngest step prefixes and terminal-node aggregation.
 */
export async function executeLoopNode(params: {
  step: WorkflowStepTools;
  runId: string;
  userId: string;
  node: WorkflowNode & { data: LoopNodeData };
  sortedNodes: WorkflowNode[];
  edges: WorkflowEdge[];
  loopBodyMap: Map<string, Set<string>>;
  workflowRow: WorkflowRunExecutionRow;
  initialData: Record<string, unknown>;
  contextData: Record<string, unknown>;
  inputAttachmentIds: string[];
  outputAttachmentIds: string[];
  activeWorkbookFilePath: string | null;
  activeArtifact: ArtifactData | null;
  dryRun: boolean;
  nodeStates: Record<string, WorkflowNodeRunState>;
  emit: (data: WorkflowStreamEvent) => Promise<void>;
}): Promise<
  | {
      status: "completed";
      outputAttachmentIds: string[];
      activeWorkbookFilePath: string | null;
      activeArtifact: ArtifactData | null;
    }
  | { status: "cancelled" }
  | { status: "failed" }
> {
  const {
    step,
    runId,
    userId,
    node,
    sortedNodes,
    edges,
    loopBodyMap,
    workflowRow,
    initialData,
    contextData,
    inputAttachmentIds,
    dryRun,
    nodeStates,
    emit,
  } = params;

  let { outputAttachmentIds, activeWorkbookFilePath, activeArtifact } = params;
  const loopData = node.data;

  const itemsResult = resolveLoopItems(loopData, initialData, contextData);
  if (!itemsResult.ok) {
    await step.run(`fail-loop-${node.id}`, async () => {
      await failWorkflowRun(
        runId,
        node.id,
        `Loop node "${node.name}" ${itemsResult.errorMessage}`,
        emit,
      );
    });
    return { status: "failed" };
  }

  const items = itemsResult.items;
  const maxIter = Math.min(
    MAX_LOOP_ITERATIONS,
    Math.max(1, loopData.maxIterations ?? DEFAULT_MAX_LOOP_ITERATIONS),
  );
  const truncated = items.length > maxIter;
  const slicedItems = items.slice(0, maxIter);

  const bodyNodeIds = loopBodyMap.get(node.id) ?? new Set<string>();
  const bodyNodes = sortedNodes.filter((n) => bodyNodeIds.has(n.id));
  const terminalBodyNodes = bodyNodes.filter(
    (bn) =>
      !edges.some(
        (e) => e.sourceNodeId === bn.id && bodyNodeIds.has(e.targetNodeId),
      ),
  );

  const results: unknown[] = [];
  for (let i = 0; i < slicedItems.length; i++) {
    const item = slicedItems[i];
    const iterContextData: Record<string, unknown> = {
      ...contextData,
      [loopData.variableName]: {
        item,
        index: i,
        total: slicedItems.length,
        isFirst: i === 0,
        isLast: i === slicedItems.length - 1,
      },
      item,
      index: i,
    };
    const iterActiveHandles = new Map<string, Set<string>>([
      [node.id, new Set(["body"])],
    ]);
    const iterSkipped = new Set<string>();

    for (let bIdx = 0; bIdx < bodyNodes.length; bIdx++) {
      const bodyNode = bodyNodes[bIdx];
      const bodyEligibility = resolveNodeExecutionEligibility(
        bodyNode.id,
        edges,
        iterActiveHandles,
        iterSkipped,
      );
      if (bodyEligibility === "skip") {
        iterSkipped.add(bodyNode.id);
        continue;
      }

      const bodyOutcome = await executeNodeWithGates({
        step,
        runId,
        userId,
        node: bodyNode,
        stepIndex: bIdx,
        allNodes: sortedNodes,
        workflowRow,
        initialData,
        contextData: iterContextData,
        inputAttachmentIds,
        outputAttachmentIds,
        activeWorkbookFilePath,
        activeArtifact,
        dryRun,
        nodeStates,
        emit,
        stepIdPrefix: `loop-${node.id}-iter-${i}-`,
      });

      if (bodyOutcome.status === "cancelled") {
        return { status: "cancelled" };
      }
      if (bodyOutcome.status !== "completed") {
        return { status: "failed" };
      }

      iterActiveHandles.set(bodyNode.id, new Set(bodyOutcome.activeHandles));
      iterContextData[bodyNode.data.variableName] = bodyOutcome.contextEntry;
      outputAttachmentIds = bodyOutcome.outputAttachmentIds;
      activeWorkbookFilePath = bodyOutcome.activeWorkbookFilePath;
      activeArtifact = bodyOutcome.activeArtifact ?? activeArtifact;
    }

    results.push(
      collectIterationResult(terminalBodyNodes, iterContextData, item),
    );
  }

  if (slicedItems.length === 0) {
    for (const bodyNode of bodyNodes) {
      nodeStates[bodyNode.id] = { status: "skipped" };
    }
  }

  contextData[loopData.variableName] = {
    results,
    items: slicedItems,
    count: slicedItems.length,
  };
  nodeStates[node.id] = {
    status: "completed",
    loopSummary: {
      totalItems: items.length,
      iterations: slicedItems.length,
      truncated,
    },
    completedAt: new Date().toISOString(),
  };

  await step.run(`checkpoint-node-${node.id}`, async () => {
    await updateActiveWorkflowRun(runId, {
      currentNodeId: node.id,
      nodeStates,
      contextData,
      outputAttachmentIds,
    });
    if (slicedItems.length === 0) {
      for (const bodyNode of bodyNodes) {
        await emit({
          type: "workflow-node-skipped",
          runId,
          nodeId: bodyNode.id,
        });
      }
    }
    await emit({
      type: "workflow-node-complete",
      runId,
      nodeId: node.id,
      state: nodeStates[node.id],
      outputAttachmentIds,
    });
  });

  return {
    status: "completed",
    outputAttachmentIds,
    activeWorkbookFilePath,
    activeArtifact,
  };
}
