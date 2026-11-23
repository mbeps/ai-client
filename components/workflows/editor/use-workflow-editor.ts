"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createWorkflow } from "@/actions/workflows/create-workflow";
import { deleteWorkflow } from "@/actions/workflows/delete-workflow";
import { regenerateWebhookSecret } from "@/actions/workflows/regenerate-webhook-secret";
import { updateWorkflow } from "@/actions/workflows/update-workflow";
import { useWorkflowEditorStore } from "@/components/workflows/canvas/workflow-editor-store";
import { useWorkflowEditorForm } from "@/components/workflows/editor/use-workflow-editor-form";
import { useWorkflowRunDialog } from "@/components/workflows/editor/use-workflow-run-dialog";
import { useWorkflowRuns } from "@/components/workflows/editor/use-workflow-runs";
import {
  autoLayoutWorkflowNodes,
  buildWorkflowPayload,
  createDefaultWorkflowNode,
} from "@/components/workflows/editor/workflow-editor-helpers";
import { ROUTES } from "@/config/routes";
import { useUserModels } from "@/hooks/use-user-models";
import { validateAndSortWorkflowGraph } from "@/lib/workflows/dag-planner";
import type {
  WorkflowNode,
  WorkflowNodeType,
} from "@/types/workflows/workflow";

/** Params for {@link useWorkflowEditor}. */
export interface UseWorkflowEditorParams {
  id: string;
  isNew: boolean;
  handleApiError: (err: unknown, fallbackMessage?: string) => boolean;
}

function hasManualTriggerFileUpload(nodes: WorkflowNode[]): boolean {
  return nodes.some(
    (node) =>
      node.data.kind === "manual_trigger" &&
      Boolean(node.data.requiresFileUpload),
  );
}

/**
 * Orchestrates visual DAG workflow graph manipulation, validation, saving, runs, and deletion.
 */
export function useWorkflowEditor({
  id,
  isNew,
  handleApiError,
}: UseWorkflowEditorParams) {
  const router = useRouter();
  const form = useWorkflowEditorForm({ id, isNew, handleApiError });
  const { setSelectedNodeId } = useWorkflowEditorStore();
  const { models: chatModels, isLoading: isModelsLoading } =
    useUserModels("chat");
  const hasNoModels = !isModelsLoading && chatModels.length === 0;

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const requiresFileUpload =
    form.requiresFileUpload || hasManualTriggerFileUpload(form.nodes);

  const { runs, isLoadingRuns } = useWorkflowRuns(id, isNew, handleApiError);
  const runDialog = useWorkflowRunDialog({
    workflowId: id,
    requiresFileUpload,
    handleApiError,
  });

  const handleAddNode = (
    type: WorkflowNodeType,
    position: { x: number; y: number },
    configuredNode?: WorkflowNode,
  ) => {
    const newNode =
      configuredNode ?? createDefaultWorkflowNode(type, position, form.nodes);
    const nextNodes = [...form.nodes, newNode];
    form.setNodes(nextNodes);
    if (newNode.data.kind === "manual_trigger") {
      form.setRequiresFileUpload(hasManualTriggerFileUpload(nextNodes));
    }
    if (!configuredNode) {
      setSelectedNodeId(newNode.id);
    }
  };

  const handleUpdateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    const nextNodes = form.nodes.map((node) =>
      node.id === nodeId ? { ...node, ...updates } : node,
    );
    form.setNodes(nextNodes);
    if (updates.data?.kind === "manual_trigger") {
      form.setRequiresFileUpload(hasManualTriggerFileUpload(nextNodes));
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    const deletedNode = form.nodes.find((node) => node.id === nodeId);
    const nextNodes = form.nodes.filter((node) => node.id !== nodeId);
    form.setNodes(nextNodes);
    form.setEdges(
      form.edges.filter(
        (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
      ),
    );
    if (deletedNode?.data.kind === "manual_trigger") {
      form.setRequiresFileUpload(hasManualTriggerFileUpload(nextNodes));
    }
  };

  const handleRequiresFileUploadChange = (requires: boolean) => {
    form.setRequiresFileUpload(requires);
    form.setNodes(
      form.nodes.map((node) =>
        node.data.kind === "manual_trigger"
          ? { ...node, data: { ...node.data, requiresFileUpload: requires } }
          : node,
      ),
    );
  };

  const handleAutoLayout = () => {
    form.setNodes(autoLayoutWorkflowNodes(form.nodes, form.edges));
  };

  const handleRegenerateWebhookSecret = async () => {
    if (isNew) return;
    const res = await regenerateWebhookSecret(id);
    if (!res.ok) {
      handleApiError(res.error, "Failed to regenerate webhook secret");
      return;
    }
    form.setWebhookSecret(res.value.webhookSecret);
    toast.success("Webhook secret regenerated");
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a workflow name");
      return;
    }

    try {
      validateAndSortWorkflowGraph(form.nodes, form.edges);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Workflow graph contains invalid connections or cycles",
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildWorkflowPayload({
        name: form.name,
        description: form.description,
        globalContext: form.globalContext,
        modelId: form.modelId,
        tools: form.tools,
        skillMode: form.skillMode,
        skillIds: form.skillIds,
        knowledgeBaseIds: form.knowledgeBaseIds,
        subagentIds: form.subagentIds,
        requiresFileUpload,
        canvasConfig: form.canvasConfig,
        approvalConfig: form.approvalConfig,
        nodes: form.nodes,
        edges: form.edges,
      });

      if (isNew) {
        const res = await createWorkflow(payload);
        if (!res.ok) {
          handleApiError(res.error, "Failed to create workflow");
          return;
        }
        toast.success("Workflow created successfully");
        router.push(ROUTES.WORKFLOWS.AUTOMATIONS.detail(res.value.id));
      } else {
        const res = await updateWorkflow(id, payload);
        if (!res.ok) {
          handleApiError(res.error, "Failed to update workflow");
          return;
        }
        toast.success("Workflow updated successfully");
      }
    } catch (err) {
      handleApiError(err, "Failed to save workflow");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteWorkflow(id);
      if (!res.ok) {
        handleApiError(res.error, "Failed to delete workflow");
        return;
      }
      toast.success("Workflow deleted successfully");
      router.push(ROUTES.WORKFLOWS.AUTOMATIONS.path);
    } catch (err) {
      handleApiError(err, "Failed to delete workflow");
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    ...form,
    requiresFileUpload,
    setRequiresFileUpload: handleRequiresFileUploadChange,
    hasNoModels,
    isSaving,
    isDeleting,
    runs,
    isLoadingRuns,
    ...runDialog,
    handleAddNode,
    handleUpdateNode,
    handleDeleteNode,
    handleAutoLayout,
    handleRegenerateWebhookSecret,
    handleSave,
    handleDelete,
  };
}
