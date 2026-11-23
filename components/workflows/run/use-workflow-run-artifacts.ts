"use client";

import { useEffect, useMemo, useState } from "react";
import { getAttachmentArtifact } from "@/actions/attachments/get-attachment-artifact";
import {
  checkHasAnyArtifact,
  resolveNodePreviewArtifact,
  resolveTargetAttachmentId,
} from "@/components/workflows/run/state-helpers";
import { logger } from "@/lib/logger";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type {
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

/** Params for {@link useWorkflowRunArtifacts}. */
export interface UseWorkflowRunArtifactsParams {
  selectedNodeId: string | null;
  nodeStates: Record<string, WorkflowNodeRunState>;
  nodes?: WorkflowNode[];
  inputAttachmentIds?: string[];
  sharedCanvas?: boolean;
}

/**
 * Resolves and caches Canvas artifacts produced by workflow nodes or uploaded attachments.
 */
export function useWorkflowRunArtifacts({
  selectedNodeId,
  nodeStates,
  nodes = [],
  inputAttachmentIds = [],
  sharedCanvas = true,
}: UseWorkflowRunArtifactsParams) {
  const [artifactCache, setArtifactCache] = useState<
    Record<string, ArtifactData>
  >({});
  const [isLoadingArtifact, setIsLoadingArtifact] = useState(false);

  const selectedHasOwnOutput = Boolean(
    selectedNodeId &&
      (nodeStates[selectedNodeId]?.artifact ||
        nodeStates[selectedNodeId]?.outputAttachmentId),
  );

  const inlineArtifact = useMemo(() => {
    if (selectedNodeId && nodeStates[selectedNodeId]?.artifact) {
      return resolveNodePreviewArtifact(
        selectedNodeId,
        nodes,
        nodeStates,
        false,
      );
    }
    if (selectedHasOwnOutput) {
      return null;
    }
    return resolveNodePreviewArtifact(
      selectedNodeId,
      nodes,
      nodeStates,
      sharedCanvas,
    );
  }, [selectedNodeId, nodeStates, nodes, sharedCanvas, selectedHasOwnOutput]);

  const targetAttachmentId = useMemo(
    () =>
      inlineArtifact
        ? null
        : resolveTargetAttachmentId(
            selectedNodeId,
            nodeStates,
            inputAttachmentIds,
          ),
    [inlineArtifact, selectedNodeId, nodeStates, inputAttachmentIds],
  );

  const nodeName = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId)?.name || "Output",
    [nodes, selectedNodeId],
  );

  useEffect(() => {
    if (!targetAttachmentId || artifactCache[targetAttachmentId]) {
      setIsLoadingArtifact(false);
      return;
    }
    let active = true;
    setIsLoadingArtifact(true);

    async function load() {
      try {
        const res = await getAttachmentArtifact(targetAttachmentId!);
        if (!active || !res.ok) return;
        const formatted: ArtifactData = {
          ...res.value,
          id: `att-${res.value.id}`,
          title: `${nodeName} - ${res.value.title}`,
          messageId: `node-${selectedNodeId ?? "input"}`,
        };
        setArtifactCache((prev) => ({
          ...prev,
          [targetAttachmentId!]: formatted,
        }));
      } catch (err) {
        logger.warn("Failed to load workflow artifact", err);
      } finally {
        if (active) setIsLoadingArtifact(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [targetAttachmentId, artifactCache, nodeName, selectedNodeId]);

  const currentArtifact = useMemo(() => {
    if (inlineArtifact) return inlineArtifact;
    if (targetAttachmentId) return artifactCache[targetAttachmentId] ?? null;
    return null;
  }, [inlineArtifact, targetAttachmentId, artifactCache]);

  const hasAnyArtifact = useMemo(
    () => checkHasAnyArtifact(nodeStates, inputAttachmentIds),
    [nodeStates, inputAttachmentIds],
  );

  return {
    isLoadingArtifact,
    currentArtifact,
    hasAnyArtifact,
  };
}
