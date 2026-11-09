"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteModel } from "@/actions/models/delete-model";
import { updateModels } from "@/actions/models/update-model";
import { logger } from "@/lib/logger";
import { invalidateProviderRegistryCache } from "@/lib/providers/invalidate-provider-registry-cache";
import type { AiModelRow } from "@/types/provider/ai-model-row";

/**
 * Custom hook that provides use model table filters functionality.
 *
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
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

/**
 * Custom hook that provides use model table modals functionality.
 *
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useModelTableModals() {
  const [modelToDelete, setModelToDelete] = useState<AiModelRow | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  return {
    modelToDelete,
    setModelToDelete,
    isBulkDeleteConfirmOpen,
    setIsBulkDeleteConfirmOpen,
  };
}

/**
 * Custom hook that provides use model table actions functionality.
 *
 * @param onRefresh - The on refresh parameter.
 * @param selectedIds - The selected ids parameter.
 * @param setSelectedIds - The set selected ids parameter.
 * @param setIsBulkDeleteConfirmOpen - The set is bulk delete confirm open parameter.
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useModelTableActions(
  onRefresh: () => Promise<void>,
  selectedIds: Set<string>,
  setSelectedIds: (ids: Set<string>) => void,
  setIsBulkDeleteConfirmOpen: (open: boolean) => void,
) {
  const [busyModelId, setBusyModelId] = useState<string | null>(null);

  const runModelAction = async (
    modelId: string,
    action: () => Promise<unknown>,
  ): Promise<void> => {
    setBusyModelId(modelId);
    try {
      const res = await action();
      if (res && typeof res === "object" && "ok" in res && !(res as any).ok) {
        toast.error((res as any).error.message || "Model action failed");
        return;
      }
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
          const res = await updateModels(targetIds, {
            isEnabled: action === "enable",
          });
          if (!res.ok) throw new Error(res.error.message);
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
          const res = await deleteModel(targetIds);
          if (!res.ok) throw new Error(res.error.message);
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
