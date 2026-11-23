"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createWorkflowRun } from "@/actions/workflow-runs/create-workflow-run";
import { uploadWorkflowRunFiles } from "@/components/workflows/editor/workflow-editor-helpers";
import { ROUTES } from "@/config/routes";

/** Params for {@link useWorkflowRunDialog}. */
export interface UseWorkflowRunDialogParams {
  workflowId: string;
  requiresFileUpload: boolean;
  handleApiError: (err: unknown, fallbackMessage?: string) => boolean;
}

/**
 * Manages the manual workflow run dialog, file uploads, and run creation action.
 */
export function useWorkflowRunDialog({
  workflowId,
  requiresFileUpload,
  handleApiError,
}: UseWorkflowRunDialogParams) {
  const router = useRouter();
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runFiles, setRunFiles] = useState<File[]>([]);
  const [initialInputJson, setInitialInputJson] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [isStartingRun, setIsStartingRun] = useState(false);

  const handleStartRun = async () => {
    if (requiresFileUpload && runFiles.length === 0) {
      toast.error("Please select at least one input file");
      return;
    }

    let initialData: Record<string, unknown> = {};
    if (initialInputJson.trim()) {
      try {
        const parsed: unknown = JSON.parse(initialInputJson);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          toast.error("Trigger payload must be a JSON object");
          return;
        }
        initialData = parsed as Record<string, unknown>;
      } catch {
        toast.error("Invalid JSON trigger payload");
        return;
      }
    }

    setIsStartingRun(true);
    try {
      const uploadRes = await uploadWorkflowRunFiles(runFiles);
      if (!uploadRes.ok) {
        handleApiError(uploadRes.error, "Failed to upload files");
        return;
      }

      const res = await createWorkflowRun({
        workflowId,
        dryRun,
        initialData,
        inputAttachmentIds: uploadRes.value,
      });
      if (!res.ok) {
        handleApiError(res.error, "Failed to start workflow run");
        return;
      }

      toast.success("Workflow run started");
      setRunDialogOpen(false);
      setRunFiles([]);
      setInitialInputJson("");
      router.push(ROUTES.WORKFLOWS.AUTOMATIONS.runs(workflowId, res.value.id));
    } catch (err) {
      handleApiError(err, "Failed to start workflow run");
    } finally {
      setIsStartingRun(false);
    }
  };

  return {
    runDialogOpen,
    setRunDialogOpen,
    runFiles,
    setRunFiles,
    initialInputJson,
    setInitialInputJson,
    dryRun,
    setDryRun,
    isStartingRun,
    handleStartRun,
  };
}
