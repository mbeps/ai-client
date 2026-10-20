"use client";

import { CircleSlash, Edit2, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteModel } from "@/actions/models/delete-model";
import { updateModels } from "@/actions/models/update-model";
import { ModelFormDialog } from "@/components/settings/providers/model-form-dialog";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { logger } from "@/lib/logger";
import { invalidateProviderRegistryCache } from "@/lib/providers/provider-registry-cache";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

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

type ModelFilters = {
  search: string;
  providerFilter: string;
  statusFilter: string;
  typeFilter: "all" | "chat" | "embedding" | "both";
};

function matchesModelType(
  modelType: string,
  typeFilter: "all" | "chat" | "embedding" | "both",
): boolean {
  if (typeFilter === "all") return true;
  if (typeFilter === "both") return modelType === "both";
  return modelType === typeFilter || modelType === "both";
}

function matchesStatusFilter(
  isEnabled: boolean,
  statusFilter: string,
): boolean {
  if (statusFilter === "all") return true;
  return statusFilter === "enabled" ? isEnabled : !isEnabled;
}

function matchesSearchQuery(
  model: AiModelRow,
  query: string,
  providerName: string,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    model.label.toLowerCase().includes(q) ||
    model.modelId.toLowerCase().includes(q) ||
    providerName.toLowerCase().includes(q)
  );
}

function matchesModelFilters(
  model: AiModelRow,
  filters: ModelFilters,
  providerName: string,
): boolean {
  if (
    filters.providerFilter !== "all" &&
    model.providerId !== filters.providerFilter
  ) {
    return false;
  }
  if (!matchesModelType(model.modelType, filters.typeFilter)) {
    return false;
  }
  if (!matchesStatusFilter(model.isEnabled, filters.statusFilter)) {
    return false;
  }
  return matchesSearchQuery(model, filters.search.trim(), providerName);
}

const CAPABILITY_CONFIGS = [
  { key: "capTools", label: "tools" },
  { key: "capVision", label: "vision" },
  { key: "capReasoning", label: "reasoning" },
  { key: "capStructuredOutput", label: "structured" },
] as const;

function ModelCapabilityBadges({ model }: { model: AiModelRow }) {
  const activeCaps = CAPABILITY_CONFIGS.filter((c) => Boolean(model[c.key]));

  if (activeCaps.length === 0) {
    return <span className="text-muted-foreground text-xs">none</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {activeCaps.map((c) => (
        <Badge key={c.key} variant="secondary">
          {c.label}
        </Badge>
      ))}
    </div>
  );
}

function ModelContextCell({ model }: { model: AiModelRow }) {
  const showDims =
    model.modelType === "embedding" || model.modelType === "both";
  return (
    <div className="text-xs">
      <div>{model.contextWindow.toLocaleString()} tokens</div>
      {showDims && (
        <div className="text-muted-foreground">
          {model.embeddingDimensions ?? "-"} dims
        </div>
      )}
    </div>
  );
}

type ModelTableRowProps = {
  model: AiModelRow;
  providerName: string;
  isSelected: boolean;
  isBusy: boolean;
  onToggleSelect: (id: string) => void;
  onToggleEnabled: (model: AiModelRow, checked: boolean) => void;
  onEdit: (model: AiModelRow) => void;
  onDelete: (model: AiModelRow) => void;
};

function ModelTableRow({
  model,
  providerName,
  isSelected,
  isBusy,
  onToggleSelect,
  onToggleEnabled,
  onEdit,
  onDelete,
}: ModelTableRowProps) {
  return (
    <TableRow data-state={isSelected && "selected"}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(model.id)}
          aria-label={`Select ${model.label}`}
        />
      </TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <div className="font-medium">{model.label}</div>
          <div className="text-muted-foreground text-xs">{model.modelId}</div>
        </div>
      </TableCell>
      <TableCell>{providerName}</TableCell>
      <TableCell>
        <Badge variant="outline">{model.modelType}</Badge>
      </TableCell>
      <TableCell>
        <ModelCapabilityBadges model={model} />
      </TableCell>
      <TableCell>
        <ModelContextCell model={model} />
      </TableCell>
      <TableCell>
        <Switch
          checked={model.isEnabled}
          disabled={isBusy}
          onCheckedChange={(checked) => onToggleEnabled(model, checked)}
        />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isBusy}
                onClick={() => onEdit(model)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit Model</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="destructive"
                disabled={isBusy}
                onClick={() => onDelete(model)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete Model</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

type ModelTableFilterToolbarProps = {
  search: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  providerFilter: string;
  onProviderFilterChange: (val: string) => void;
  typeFilter: "all" | "chat" | "embedding" | "both";
  onTypeFilterChange: (val: "all" | "chat" | "embedding" | "both") => void;
  providers: AiProviderRow[];
};

function ModelTableFilterToolbar(props: ModelTableFilterToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={props.search}
        onChange={(event) => props.onSearchChange(event.target.value)}
        placeholder="Search models..."
        className="h-9 w-full sm:w-[200px] lg:w-[280px]"
      />

      <Select
        value={props.statusFilter}
        onValueChange={props.onStatusFilterChange}
      >
        <SelectTrigger className="h-9 w-full sm:w-[130px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Everything</SelectItem>
          <SelectItem value="enabled">Enabled</SelectItem>
          <SelectItem value="disabled">Disabled</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={props.providerFilter}
        onValueChange={props.onProviderFilterChange}
      >
        <SelectTrigger className="h-9 w-full sm:w-[180px]">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All providers</SelectItem>
          {props.providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {provider.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={props.typeFilter}
        onValueChange={(value) =>
          props.onTypeFilterChange(
            value as "all" | "chat" | "embedding" | "both",
          )
        }
      >
        <SelectTrigger className="h-9 w-full sm:w-[140px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="chat">chat</SelectItem>
          <SelectItem value="embedding">embedding</SelectItem>
          <SelectItem value="both">both</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function ModelTableBulkActions({
  isBusy,
  onBulkAction,
}: {
  isBusy: boolean;
  onBulkAction: (action: "enable" | "disable" | "delete") => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 p-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={isBusy}
        onClick={() => onBulkAction("enable")}
      >
        {isBusy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="mr-1.5 h-3.5 w-3.5" />
        )}
        Enable
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={isBusy}
        onClick={() => onBulkAction("disable")}
      >
        {isBusy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <CircleSlash className="mr-1.5 h-3.5 w-3.5" />
        )}
        Disable
      </Button>
      <div className="mx-1 h-4 w-[1px] bg-border" />
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-destructive text-xs hover:bg-destructive/10"
        disabled={isBusy}
        onClick={() => onBulkAction("delete")}
      >
        {isBusy ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        )}
        Delete
      </Button>
    </div>
  );
}

function useModelTableFilters() {
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

type ModelTableModalsProps = {
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  providers: AiProviderRow[];
  editingModel: AiModelRow | null;
  onRefresh: () => Promise<void> | void;
  modelToDelete: AiModelRow | null;
  onCloseDeleteModel: () => void;
  isModelDeleteLoading: boolean;
  onConfirmDeleteModel: () => Promise<void>;
  isBulkDeleteConfirmOpen: boolean;
  onCloseBulkDelete: () => void;
  selectedCount: number;
  isBulkDeleteLoading: boolean;
  onConfirmBulkDelete: () => Promise<void>;
};

function ModelTableModals(props: ModelTableModalsProps) {
  return (
    <>
      <ModelFormDialog
        open={props.dialogOpen}
        onOpenChange={props.onDialogOpenChange}
        providers={props.providers}
        model={props.editingModel}
        onSaved={() => {
          void props.onRefresh();
        }}
      />

      <DeleteConfirmDialog
        isOpen={Boolean(props.modelToDelete)}
        onClose={props.onCloseDeleteModel}
        title="Delete Model"
        description={`Are you sure you want to delete "${props.modelToDelete?.label ?? props.modelToDelete?.modelId ?? props.modelToDelete?.id}"? This action cannot be undone.`}
        loading={props.isModelDeleteLoading}
        onConfirm={props.onConfirmDeleteModel}
      />

      <DeleteConfirmDialog
        isOpen={props.isBulkDeleteConfirmOpen}
        onClose={props.onCloseBulkDelete}
        title="Delete Models"
        description={`Are you sure you want to delete ${props.selectedCount} selected models? This action cannot be undone.`}
        loading={props.isBulkDeleteLoading}
        onConfirm={props.onConfirmBulkDelete}
      />
    </>
  );
}

function useModelTableModals() {
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
  const [busyModelId, setBusyModelId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
                  className="py-8 text-center text-muted-foreground text-sm"
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
