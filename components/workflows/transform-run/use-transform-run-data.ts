import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getAttachmentUrl } from "@/actions/attachments/get-attachment-url";
import { getTransformAgent } from "@/actions/transform-agents/get-transform-agent";
import { approveTransformRunAction } from "@/actions/transform-runs/approve-transform-run";
import { getTransformRun } from "@/actions/transform-runs/get-transform-run";
import {
  buildInitialStepStates,
  mapRunRowToRun,
  resolveInitialSelectedStep,
} from "@/components/workflows/transform-run/state-helpers";
import type { TransformAgent } from "@/types/transform/transform-agent";
import type { TransformRun } from "@/types/transform/transform-run";
import type { StepState } from "@/types/workflows/transform-run";

/**
 * Parses agent steps.
 *
 * @param rawSteps - Target raw steps
 * @returns The resolved result
 * @author Maruf Bepary
 */
function parseAgentSteps(rawSteps?: string | null) {
  if (!rawSteps) return [];
  try {
    return JSON.parse(rawSteps);
  } catch {
    return [];
  }
}

/**
 * Performs map agent row to agent.
 *
 * @param agentRow - Target agent row
 * @returns The resolved result
 * @author Maruf Bepary
 */
function mapAgentRowToAgent(
  agentRow: NonNullable<Awaited<ReturnType<typeof getTransformAgent>>>,
): TransformAgent {
  const steps = parseAgentSteps(agentRow.steps);
  return {
    id: agentRow.id,
    userId: agentRow.userId,
    name: agentRow.name,
    description: agentRow.description ?? "",
    globalContext: agentRow.globalContext ?? undefined,
    modelId: agentRow.modelId ?? undefined,
    tools: agentRow.tools,
    knowledgeBaseIds: agentRow.knowledgeBaseIds,
    requiresFileUpload: agentRow.requiresFileUpload,
    steps,
    createdAt: new Date(agentRow.createdAt),
    updatedAt: new Date(agentRow.updatedAt),
  };
}

/**
 * Manages run and agent database data, initial state hydration, and approval actions.
 *
 * @param runId - Workflow run identifier
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useTransformRunData(runId: string) {
  const [run, setRun] = useState<TransformRun | null>(null);
  const [agent, setAgent] = useState<TransformAgent | null>(null);
  const [stepStates, setStepStates] = useState<Record<number, StepState>>({});
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(
    null,
  );
  const [isArtifactOpen, setIsArtifactOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [attachmentMeta, setAttachmentMeta] = useState<
    Record<string, { url: string; name: string }>
  >({});

  const loadAttachmentUrls = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return {};
    const results = await Promise.allSettled(
      ids.map((id) => getAttachmentUrl(id)),
    );
    const meta: Record<string, { url: string; name: string }> = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        meta[ids[i]] = { url: r.value.url, name: r.value.name };
      }
    });
    setAttachmentMeta((prev) => ({ ...prev, ...meta }));
    return meta;
  }, []);

  useEffect(() => {
    async function load() {
      const runRow = await getTransformRun(runId);
      if (!runRow) {
        setIsLoading(false);
        return;
      }
      const mapped = mapRunRowToRun(runRow);
      setRun(mapped);

      let mappedAgent: TransformAgent | null = null;
      const agentRow = await getTransformAgent(runRow.agentId);
      if (agentRow) {
        mappedAgent = mapAgentRowToAgent(agentRow);
        setAgent(mappedAgent);
        setStepStates(
          buildInitialStepStates(
            mappedAgent.steps.length,
            mapped.status,
            mapped.currentStepIndex,
            mapped.outputAttachmentIds,
          ),
        );
        const initialSelected = resolveInitialSelectedStep(
          mappedAgent.steps.length,
          mapped.status,
          mapped.currentStepIndex,
        );
        if (initialSelected !== null) {
          setSelectedStepIndex(initialSelected);
          setIsArtifactOpen(true);
        }
      }
      setIsLoading(false);

      const meta = await loadAttachmentUrls([
        ...mapped.inputAttachmentIds,
        ...mapped.outputAttachmentIds,
      ]);

      if (mappedAgent && mapped.outputAttachmentIds.length > 0) {
        setStepStates(
          buildInitialStepStates(
            mappedAgent.steps.length,
            mapped.status,
            mapped.currentStepIndex,
            mapped.outputAttachmentIds,
            mapped.outputAttachmentIds.map((id) => ({
              id,
              name: meta[id]?.name,
            })),
          ),
        );
      }
    }
    load();
  }, [runId, loadAttachmentUrls]);

  const handleApprove = async () => {
    if (!run) return;
    setIsApproving(true);
    try {
      await approveTransformRunAction(run.id);
      setRun((prev) => (prev ? { ...prev, status: "running" } : prev));
      toast.success("Run approved and resumed");
    } catch {
      toast.error("Failed to approve run");
    } finally {
      setIsApproving(false);
    }
  };

  return {
    run,
    setRun,
    agent,
    stepStates,
    setStepStates,
    selectedStepIndex,
    setSelectedStepIndex,
    isArtifactOpen,
    setIsArtifactOpen,
    isLoading,
    isApproving,
    attachmentMeta,
    loadAttachmentUrls,
    handleApprove,
  };
}
