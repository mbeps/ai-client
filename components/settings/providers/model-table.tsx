"use client";

import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteModel } from "@/actions/models/delete-model";
import { updateModels } from "@/actions/models/update-model";
import { ModelTableBulkActions } from "@/components/settings/providers/model-table/model-table-bulk-actions";
import { ModelTableFilterToolbar } from "@/components/settings/providers/model-table/model-table-filter-toolbar";
import { ModelTableModals } from "@/components/settings/providers/model-table/model-table-modals";
import { ModelTableRow } from "@/components/settings/providers/model-table/model-table-row";
import {
  type ModelFilters,
  matchesModelFilters,
} from "@/components/settings/providers/model-table/model-table-utils";
import {
  useModelTableActions,
  useModelTableFilters,
  useModelTableModals,
} from "@/components/settings/providers/model-table/use-model-table-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

/**
 * Represents model table props.
 *
 * @author Maruf Bepary
 */
type ModelTableProps = {
  models: AiModelRow[];
  providers: AiProviderRow[];
  onRefresh: () => Promise<void>;
};

/**
 * Table-based UI for managing AI models across all providers.
 * Displays model metadata (name, provider, type) and provides inline actions
 * (enable/disable, edit, delete, and test).
 * Includes bulk actions like enabling/disabling all models or providers.
 *
 * @param props.models - Array of models to display and manage.
 * @param props.providers - Available providers for assigning models.
 * @param props.onRefresh - Callback to refresh model list after mutations.
 * @author Maruf Bepary
 */
export function ModelTable({ models, providers, onRefresh }: ModelTableProps) {
  const {
    search,
    setSearch,
    providerFilter,
    setProviderFilter,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
  } = useModelTableFilters();
  const {
    editingModel,
    setEditingModel,
    modelToDelete,
    setModelToDelete,
    isBulkDeleteConfirmOpen,
    setIsBulkDeleteConfirmOpen,
    dialogOpen,
    setDialogOpen,
  } = useModelTableModals();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { busyModelId, runModelAction, handleBulkAction, executeBulkDelete } =
    useModelTableActions(
      onRefresh,
      selectedIds,
      setSelectedIds,
      setIsBulkDeleteConfirmOpen,
    );

  const providerNameById = useMemo(
    () =>
      Object.fromEntries(
        providers.map((provider) => [provider.id, provider.name]),
      ),
    [providers],
  );

  const filteredModels = useMemo(() => {
    const filters: ModelFilters = {
      search,
      providerFilter,
      statusFilter,
      typeFilter,
    };

    const filtered = models.filter((model) => {
      const providerName = providerNameById[model.providerId] ?? "";
      return matchesModelFilters(model, filters, providerName);
    });

    return [...filtered].sort((a, b) => {
      const aProvider = providerNameById[a.providerId] ?? "";
      const bProvider = providerNameById[b.providerId] ?? "";
      if (aProvider !== bProvider) return aProvider.localeCompare(bProvider);
      return a.label.localeCompare(b.label);
    });
  }, [
    models,
    providerFilter,
    providerNameById,
    search,
    typeFilter,
    statusFilter,
  ]);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredModels.length) {
        return new Set();
      }
      return new Set(filteredModels.map((m) => m.id));
    });
  }, [filteredModels]);

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Filter Row */}
      <ModelTableFilterToolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        providerFilter={providerFilter}
        onProviderFilterChange={setProviderFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        providers={providers}
      />

      {/* Actions Row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="text-muted-foreground text-sm">
            {filteredModels.length}{" "}
            {filteredModels.length === 1 ? "model" : "models"} found
            {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
          </div>

          {selectedIds.size > 0 && (
            <ModelTableBulkActions
              isBusy={busyModelId === "bulk"}
              onBulkAction={(action) => void handleBulkAction(action)}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setEditingModel(null);
              setDialogOpen(true);
            }}
            disabled={providers.length === 0}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Model
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={
                    filteredModels.length > 0 &&
                    selectedIds.size === filteredModels.length
                  }
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead>Context</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModels.map((model) => (
              <ModelTableRow
                key={model.id}
                model={model}
                providerName={providerNameById[model.providerId] ?? "Unknown"}
                isSelected={selectedIds.has(model.id)}
                isBusy={busyModelId === model.id}
                onToggleSelect={toggleSelectOne}
                onToggleEnabled={(m, checked) =>
                  void runModelAction(m.id, async () => {
                    await updateModels(m.id, { isEnabled: checked });
                  })
                }
                onEdit={(m) => {
                  setEditingModel(m);
                  setDialogOpen(true);
                }}
                onDelete={(m) => setModelToDelete(m)}
              />
            ))}

            {filteredModels.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  No models found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ModelTableModals
        dialogOpen={dialogOpen}
        onDialogOpenChange={setDialogOpen}
        providers={providers}
        editingModel={editingModel}
        onRefresh={onRefresh}
        modelToDelete={modelToDelete}
        onCloseDeleteModel={() => setModelToDelete(null)}
        isModelDeleteLoading={busyModelId === modelToDelete?.id}
        onConfirmDeleteModel={async () => {
          if (!modelToDelete) return;
          await runModelAction(modelToDelete.id, async () => {
            await deleteModel(modelToDelete.id);
            toast.success("Model deleted");
            setModelToDelete(null);
          });
        }}
        isBulkDeleteConfirmOpen={isBulkDeleteConfirmOpen}
        onCloseBulkDelete={() => setIsBulkDeleteConfirmOpen(false)}
        selectedCount={selectedIds.size}
        isBulkDeleteLoading={busyModelId === "bulk"}
        onConfirmBulkDelete={executeBulkDelete}
      />
    </div>
  );
}
