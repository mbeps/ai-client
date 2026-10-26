"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createTransformRun } from "@/actions/transform-runs/create-transform-run";
import { uploadRunInputFiles } from "@/components/workflows/sheet-flow/agent-editor-helpers";
import { ROUTES } from "@/config/routes";

/**
 * Represents use agent run dialog params.
 *
 * @author Maruf Bepary
 */
export interface UseAgentRunDialogParams {
  id: string;
  requiresFileUpload: boolean;
  handleApiError: (err: unknown, fallbackMessage?: string) => boolean;
}

/**
 * Manages run execution dialog, input files, and run creation action.
 *
 * @param params - Target params
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useAgentRunDialog(params: UseAgentRunDialogParams) {
  const { id, requiresFileUpload, handleApiError } = params;
  const router = useRouter();
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runFiles, setRunFiles] = useState<File[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [isStartingRun, setIsStartingRun] = useState(false);

  const handleStartRun = async () => {
    if (requiresFileUpload && runFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setIsStartingRun(true);
    try {
      const inputAttachmentIds = await uploadRunInputFiles(runFiles);
      const run = await createTransformRun({
        agentId: id,
        dryRun,
        inputAttachmentIds,
      });

      toast.success("Run started successfully");
      setRunDialogOpen(false);
      setRunFiles([]);
      router.push(ROUTES.WORKFLOWS.TRANSFORM.runs(id, run.id));
    } catch (err) {
      handleApiError(err, "Failed to start run");
    } finally {
      setIsStartingRun(false);
    }
  };

  return {
    runDialogOpen,
    setRunDialogOpen,
    runFiles,
    setRunFiles,
    dryRun,
    setDryRun,
    isStartingRun,
    handleStartRun,
  };
}
