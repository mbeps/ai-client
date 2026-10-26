"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteModel } from "@/actions/models/delete-model";
import { updateModels } from "@/actions/models/update-model";
import { logger } from "@/lib/logger";
import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";
import type { AiModelRow } from "@/types/provider/ai-model-row";

export function useModelTableFilters() {
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "chat" | "embedding" | "both"
  >("all");

  return {
    search,
    setSearch,
    providerFilter,
    setProviderFilter,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
  };
}

export function useModelTableModals() {
  const [editingModel, setEditingModel] = useState<AiModelRow | null>(null);
  const [modelToDelete, setModelToDelete] = useState<AiModelRow | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return {
    editingModel,
    setEditingModel,
    modelToDelete,
    setModelToDelete,
    isBulkDeleteConfirmOpen,
    setIsBulkDeleteConfirmOpen,
    dialogOpen,
    setDialogOpen,
  };
}

export function useModelTableActions(
  onRefresh: () => Promise<void>,
  selectedIds: Set<string>,
  setSelectedIds: (ids: Set<string>) => void,
  setIsBulkDeleteConfirmOpen: (open: boolean) => void,
) {
  const [busyModelId, setBusyModelId] = useState<string | null>(null);

  const runModelAction = async (
    modelId: string,
    action: () => Promise<void>,
  ): Promise<void> => {
    setBusyModelId(modelId);
    try {
      await action();
      invalidateProviderRegistryCache();
      await onRefresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Model action failed",
      );
    } finally {
      setBusyModelId(null);
    }
  };

  const handleBulkAction = async (action: "enable" | "disable" | "delete") => {
    const targetIds = Array.from(selectedIds);
    if (targetIds.length === 0) return;

    if (action === "delete") {
      setIsBulkDeleteConfirmOpen(true);
      return;
    }

    setBusyModelId("bulk");
    try {
      await toast.promise(
        (async () => {
          await updateModels(targetIds, { isEnabled: action === "enable" });
          invalidateProviderRegistryCache();
          await onRefresh();
          setSelectedIds(new Set());
        })(),
        {
          loading: `${action === "enable" ? "Enabling" : "Disabling"} ${targetIds.length} models...`,
          success: `Successfully ${action === "enable" ? "enabled" : "disabled"} ${targetIds.length} models`,
          error: `Failed to ${action} some models`,
        },
      );
    } catch (error) {
      logger.error("Bulk action failed", error);
    } finally {
      setBusyModelId(null);
    }
  };

  const executeBulkDelete = async () => {
    const targetIds = Array.from(selectedIds);
    if (targetIds.length === 0) return;

    setBusyModelId("bulk");
    try {
      await toast.promise(
        (async () => {
          await deleteModel(targetIds);
          invalidateProviderRegistryCache();
          await onRefresh();
          setSelectedIds(new Set());
          setIsBulkDeleteConfirmOpen(false);
        })(),
        {
          loading: `Deleting ${targetIds.length} models...`,
          success: `Successfully deleted ${targetIds.length} models`,
          error: `Failed to delete some models`,
        },
      );
    } catch (error) {
      logger.error("Bulk delete failed", error);
    } finally {
      setBusyModelId(null);
    }
  };

  return {
    busyModelId,
    setBusyModelId,
    runModelAction,
    handleBulkAction,
    executeBulkDelete,
  };
}
