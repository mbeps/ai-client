"use client";

import { useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Play, CircleSlash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteModel } from "@/lib/actions/models/delete-model";
import { updateModels, updateModel } from "@/lib/actions/models/update-model";
import { ModelFormDialog } from "@/components/settings/providers/model-form-dialog";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { invalidateProviderRegistryCache } from "@/hooks/provider-registry-cache";
import type { AiModelRow } from "@/types/ai-model-row";
import type { AiProviderRow } from "@/types/ai-provider-row";

type ModelTableProps = {
  models: AiModelRow[];
  providers: AiProviderRow[];
  onRefresh: () => Promise<void>;
};

export function ModelTable({ models, providers, onRefresh }: ModelTableProps) {
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "chat" | "embedding" | "both"
  >("all");
  const [editingModel, setEditingModel] = useState<AiModelRow | null>(null);
  const [modelToDelete, setModelToDelete] = useState<AiModelRow | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
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
    const q = search.trim().toLowerCase();

    return models.filter((model) => {
      if (providerFilter !== "all" && model.providerId !== providerFilter)
        return false;

      // Type filtering: handle both/chat/embedding overlaps
      if (typeFilter === "chat") {
        if (model.modelType !== "chat" && model.modelType !== "both")
          return false;
      } else if (typeFilter === "embedding") {
        if (model.modelType !== "embedding" && model.modelType !== "both")
          return false;
      } else if (typeFilter === "both") {
        if (model.modelType !== "both") return false;
      }

      if (statusFilter === "enabled" && !model.isEnabled) return false;
      if (statusFilter === "disabled" && model.isEnabled) return false;

      if (!q) return true;

      const providerName = providerNameById[model.providerId] ?? "";
      return (
        model.label.toLowerCase().includes(q) ||
        model.modelId.toLowerCase().includes(q) ||
        providerName.toLowerCase().includes(q)
      );
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
      console.error("Bulk action failed:", error);
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
      console.error("Bulk delete failed:", error);
    } finally {
      setBusyModelId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search models..."
          className="h-9 w-full sm:w-[200px] lg:w-[280px]"
        />

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everything</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(value) =>
            setTypeFilter(value as "all" | "chat" | "embedding" | "both")
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

      {/* Actions Row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {filteredModels.length}{" "}
            {filteredModels.length === 1 ? "model" : "models"} found
            {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 p-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={busyModelId === "bulk"}
                onClick={() => void handleBulkAction("enable")}
              >
                {busyModelId === "bulk" ? (
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
                disabled={busyModelId === "bulk"}
                onClick={() => void handleBulkAction("disable")}
              >
                {busyModelId === "bulk" ? (
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
                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                disabled={busyModelId === "bulk"}
                onClick={() => void handleBulkAction("delete")}
              >
                {busyModelId === "bulk" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Delete
              </Button>
            </div>
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

      <TooltipProvider>
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
              {filteredModels.map((model) => {
                const isBusy = busyModelId === model.id;
                const isSelected = selectedIds.has(model.id);
                return (
                  <TableRow
                    key={model.id}
                    data-state={isSelected && "selected"}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectOne(model.id)}
                        aria-label={`Select ${model.label}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium">{model.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {model.modelId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {providerNameById[model.providerId] ?? "Unknown"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{model.modelType}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {model.capTools && (
                          <Badge variant="secondary">tools</Badge>
                        )}
                        {model.capVision && (
                          <Badge variant="secondary">vision</Badge>
                        )}
                        {model.capReasoning && (
                          <Badge variant="secondary">reasoning</Badge>
                        )}
                        {model.capStructuredOutput && (
                          <Badge variant="secondary">structured</Badge>
                        )}
                        {!model.capTools &&
                          !model.capVision &&
                          !model.capReasoning &&
                          !model.capStructuredOutput && (
                            <span className="text-xs text-muted-foreground">
                              none
                            </span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>{model.contextWindow.toLocaleString()} tokens</div>
                        {(model.modelType === "embedding" ||
                          model.modelType === "both") && (
                          <div className="text-muted-foreground">
                            {model.embeddingDimensions ?? "-"} dims
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={model.isEnabled}
                        disabled={isBusy}
                        onCheckedChange={(checked) =>
                          void runModelAction(model.id, async () => {
                            await updateModel(model.id, { isEnabled: checked });
                          })
                        }
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
                              onClick={() => {
                                setEditingModel(model);
                                setDialogOpen(true);
                              }}
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
                              onClick={() => setModelToDelete(model)}
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
              })}

              {filteredModels.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No models found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>

      <ModelFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        providers={providers}
        model={editingModel}
        onSaved={() => {
          void onRefresh();
        }}
      />

      <DeleteConfirmDialog
        isOpen={!!modelToDelete}
        onClose={() => setModelToDelete(null)}
        title="Delete Model"
        description={`Are you sure you want to delete "${modelToDelete?.label ?? modelToDelete?.modelId ?? modelToDelete?.id}"? This action cannot be undone.`}
        loading={busyModelId === modelToDelete?.id}
        onConfirm={async () => {
          if (!modelToDelete) return;
          await runModelAction(modelToDelete.id, async () => {
            await deleteModel(modelToDelete.id);
            toast.success("Model deleted");
            setModelToDelete(null);
          });
        }}
      />

      <DeleteConfirmDialog
        isOpen={isBulkDeleteConfirmOpen}
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        title="Delete Models"
        description={`Are you sure you want to delete ${selectedIds.size} selected models? This action cannot be undone.`}
        loading={busyModelId === "bulk"}
        onConfirm={executeBulkDelete}
      />
    </div>
  );
}
