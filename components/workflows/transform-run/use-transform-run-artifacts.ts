import { useEffect, useMemo, useState } from "react";
import { getAttachmentArtifact } from "@/actions/attachments/get-attachment-artifact";
import {
  checkHasAnyArtifact,
  resolveStepPreviewArtifact,
  resolveTargetAttachmentId,
} from "@/components/workflows/transform-run/state-helpers";
import { logger } from "@/lib/logger";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { TransformStep } from "@/types/transform/transform-step";
import type { StepState } from "@/types/workflows/transform-run";

function formatStepArtifact(
  res: ArtifactData,
  selectedStepIndex: number | null,
  stepName?: string,
): ArtifactData {
  const name = stepName || "Preview";
  return {
    ...res,
    id: `att-${res.id}`,
    title: `${name} - ${res.title}`,
    messageId: `step-${selectedStepIndex ?? 0}`,
  };
}

async function fetchPreviewArtifact(
  attachmentId: string,
  selectedStepIndex: number | null,
  stepName?: string,
): Promise<ArtifactData | null> {
  try {
    const res = await getAttachmentArtifact(attachmentId);
    return formatStepArtifact(res, selectedStepIndex, stepName);
  } catch (err) {
    logger.warn?.("Failed to load preview artifact via server action", err);
    return null;
  }
}

export interface UseTransformRunArtifactsParams {
  selectedStepIndex: number | null;
  stepStates: Record<number, StepState>;
  steps?: TransformStep[];
  inputAttachmentIds?: string[];
}

/**
 * Manages preview artifact loading, cache, and artifact resolution for transform steps.
 */
export function useTransformRunArtifacts({
  selectedStepIndex,
  stepStates,
  steps,
  inputAttachmentIds,
}: UseTransformRunArtifactsParams) {
  const [artifactCache, setArtifactCache] = useState<
    Record<string, ArtifactData>
  >({});
  const [isLoadingArtifact, setIsLoadingArtifact] = useState(false);

  const targetAttachmentId = useMemo(
    () =>
      resolveTargetAttachmentId(
        selectedStepIndex,
        stepStates,
        inputAttachmentIds,
      ),
    [selectedStepIndex, stepStates, inputAttachmentIds],
  );

  const currentStepName =
    selectedStepIndex !== null ? steps?.[selectedStepIndex]?.name : undefined;

  useEffect(() => {
    if (!targetAttachmentId) return;
    if (selectedStepIndex !== null && stepStates[selectedStepIndex]?.artifact) {
      return;
    }
    if (artifactCache[targetAttachmentId]) return;

    let cancelled = false;
    setIsLoadingArtifact(true);

    fetchPreviewArtifact(targetAttachmentId, selectedStepIndex, currentStepName)
      .then((artifact) => {
        if (!cancelled && artifact) {
          setArtifactCache((prev) => ({
            ...prev,
            [targetAttachmentId]: artifact,
          }));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingArtifact(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    targetAttachmentId,
    artifactCache,
    selectedStepIndex,
    stepStates,
    currentStepName,
  ]);

  const currentArtifact = useMemo(
    () =>
      resolveStepPreviewArtifact(
        selectedStepIndex,
        stepStates,
        currentStepName,
        targetAttachmentId,
        artifactCache,
      ),
    [
      selectedStepIndex,
      stepStates,
      currentStepName,
      targetAttachmentId,
      artifactCache,
    ],
  );

  const hasAnyArtifact = useMemo(
    () => checkHasAnyArtifact(artifactCache, targetAttachmentId, stepStates),
    [artifactCache, targetAttachmentId, stepStates],
  );

  return {
    targetAttachmentId,
    currentArtifact,
    hasAnyArtifact,
    isLoadingArtifact,
  };
}
