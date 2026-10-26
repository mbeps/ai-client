"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createTransformAgent } from "@/actions/transform-agents/create-transform-agent";
import { deleteTransformAgent } from "@/actions/transform-agents/delete-transform-agent";
import { updateTransformAgent } from "@/actions/transform-agents/update-transform-agent";
import { buildAgentPayload } from "@/components/workflows/sheet-flow/agent-editor-helpers";
import { useAgentEditorForm } from "@/components/workflows/sheet-flow/use-agent-editor-form";
import { useAgentRunDialog } from "@/components/workflows/sheet-flow/use-agent-run-dialog";
import { useAgentRuns } from "@/components/workflows/sheet-flow/use-agent-runs";
import { ROUTES } from "@/config/routes";
import { useUserModels } from "@/hooks/use-user-models";

/**
 * Represents use agent editor workflow params.
 *
 * @author Maruf Bepary
 */
export interface UseAgentEditorWorkflowParams {
  id: string;
  isNew: boolean;
  handleApiError: (err: unknown, fallbackMessage?: string) => boolean;
}

/**
 * Orchestrates transform agent editor form state, runs history, run execution, and saving.
 *
 * @param params - Target params
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useAgentEditorWorkflow(params: UseAgentEditorWorkflowParams) {
  const { id, isNew, handleApiError } = params;
  const router = useRouter();
  const form = useAgentEditorForm({ id, isNew, handleApiError });
  const { models: chatModels, isLoading: isModelsLoading } =
    useUserModels("chat");
  const hasNoModels = !isModelsLoading && chatModels.length === 0;

  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { runs, isLoadingRuns } = useAgentRuns(id, isNew, handleApiError);
  const runDialog = useAgentRunDialog({
    id,
    requiresFileUpload: form.requiresFileUpload,
    handleApiError,
  });

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter an agent name");
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildAgentPayload({
        name: form.name,
        description: form.description,
        globalContext: form.globalContext,
        modelId: form.modelId,
        tools: form.tools,
        skillMode: form.skillMode,
        skillIds: form.skillIds,
        knowledgeBaseIds: form.knowledgeBaseIds,
        requiresFileUpload: form.requiresFileUpload,
        steps: form.steps,
      });

      if (isNew) {
        const created = await createTransformAgent(payload);
        toast.success("Agent created successfully");
        router.push(ROUTES.WORKFLOWS.TRANSFORM.detail(created.id));
      } else {
        await updateTransformAgent(id, payload);
        toast.success("Agent updated successfully");
      }
    } catch (err) {
      handleApiError(err, "Failed to save agent");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTransformAgent(id);
      toast.success("Agent deleted successfully");
      router.push(ROUTES.WORKFLOWS.TRANSFORM.path);
    } catch (err) {
      handleApiError(err, "Failed to delete agent");
      setIsDeleting(false);
    }
  };

  const isModelBlocked = isModelsLoading || hasNoModels;
  const isSaveDisabled = isSaving || isModelBlocked;

  return {
    form,
    runs,
    isLoadingRuns,
    runDialog,
    isSaving,
    isModelBlocked,
    isSaveDisabled,
    hasNoModels,
    showDeleteDialog,
    setShowDeleteDialog,
    isDeleting,
    handleSave,
    handleDelete,
  };
}
