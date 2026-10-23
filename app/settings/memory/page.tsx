"use client";

import { Brain, CheckSquare, Plus, Square, Trash2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMemories } from "@/actions/memories/delete-memories";
import { toggleMemoryEnabled } from "@/actions/user-settings/toggle-memory-enabled";
import { MemoryCard } from "@/components/memory/memory-card";
import { MemoryDialog } from "@/components/memory/memory-dialog";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppStore } from "@/lib/store";
import type { Memory } from "@/types/memory/memory";

type MemorySelectionToolbarProps = {
  isAllSelected: boolean;
  selectedCount: number;
  onToggleSelectAll: () => void;
  onBulkDelete: () => void;
};

function MemorySelectionToolbar(props: MemorySelectionToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={props.onToggleSelectAll}
        className="h-9 gap-2"
      >
        {props.isAllSelected ? (
          <CheckSquare className="h-4 w-4" />
        ) : (
          <Square className="h-4 w-4" />
        )}
        <span>{props.isAllSelected ? "Deselect All" : "Select All"}</span>
        {props.selectedCount > 0 && (
          <Badge
            variant="secondary"
            className="ml-0.5 rounded-full px-1.5 py-0 text-[11px] leading-tight"
          >
            {props.selectedCount}
          </Badge>
        )}
      </Button>

      {props.selectedCount > 0 && (
        <Button
          variant="destructive"
          size="sm"
          onClick={props.onBulkDelete}
          className="h-9 gap-1.5"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete Selected</span>
        </Button>
      )}
    </div>
  );
}

type MemoryHeaderActionsProps = {
  isMemoryEnabled: boolean;
  isToggling: boolean;
  onToggleMemory: (checked: boolean) => void;
  onOpenAdd: () => void;
};

function MemoryHeaderActions(props: MemoryHeaderActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center">
            <Switch
              id="memory-toggle"
              checked={props.isMemoryEnabled}
              onCheckedChange={props.onToggleMemory}
              disabled={props.isToggling}
              aria-label="Toggle memory"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {props.isMemoryEnabled ? "Disable memory" : "Enable memory"}
        </TooltipContent>
      </Tooltip>

      <Button
        onClick={props.onOpenAdd}
        disabled={!props.isMemoryEnabled}
        className="w-full sm:w-auto"
        title={
          !props.isMemoryEnabled
            ? "Enable memory to add new memories"
            : undefined
        }
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Memory
      </Button>
    </div>
  );
}

type DeleteMemoriesAlertDialogProps = {
  targetDeleteIds: string[] | null;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
};

function DeleteMemoriesAlertDialog(props: DeleteMemoriesAlertDialogProps) {
  const isMultiple = Boolean(
    props.targetDeleteIds && props.targetDeleteIds.length > 1,
  );
  const count = props.targetDeleteIds?.length ?? 0;

  return (
    <AlertDialog
      open={Boolean(props.targetDeleteIds && props.targetDeleteIds.length > 0)}
      onOpenChange={props.onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isMultiple ? `Delete ${count} Memories` : "Delete Memory"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isMultiple
              ? `Are you sure you want to delete ${count} memories? The AI will no longer remember these details.`
              : "Are you sure you want to delete this memory? The AI will no longer remember this detail."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={props.isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={props.onConfirmDelete}
            disabled={props.isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {props.isDeleting ? (
              "Deleting..."
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function useMemorySelection(
  memories: Memory[],
  removeMemoriesFromStore: (ids: string[]) => void,
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetDeleteIds, setTargetDeleteIds] = useState<string[] | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const handleToggleSelect = (memory: Memory) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memory.id)) {
        next.delete(memory.id);
      } else {
        next.add(memory.id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === memories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(memories.map((m) => m.id)));
    }
  };

  const handleSingleDelete = (memory: Memory) => {
    setTargetDeleteIds([memory.id]);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setTargetDeleteIds(Array.from(selectedIds));
  };

  const handleConfirmDelete = () => {
    if (!targetDeleteIds || targetDeleteIds.length === 0) return;

    const idsToDelete = [...targetDeleteIds];
    startDeleteTransition(async () => {
      try {
        await deleteMemories({ ids: idsToDelete });
        removeMemoriesFromStore(idsToDelete);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of idsToDelete) {
            next.delete(id);
          }
          return next;
        });
        toast.success(
          idsToDelete.length === 1
            ? "Memory deleted"
            : `${idsToDelete.length} memories deleted`,
        );
        setTargetDeleteIds(null);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete memories",
        );
      }
    });
  };

  const isAllSelected =
    memories.length > 0 && selectedIds.size === memories.length;

  return {
    selectedIds,
    isAllSelected,
    targetDeleteIds,
    setTargetDeleteIds,
    isDeleting,
    handleToggleSelect,
    handleToggleSelectAll,
    handleSingleDelete,
    handleBulkDelete,
    handleConfirmDelete,
  };
}

/**
 * Settings page for inspecting, managing, and toggling persistent user memories.
 *
 * @author Maruf Bepary
 */
export default function MemoryPage() {
  const memories = useAppStore((state) => state.memories);
  const loadMemories = useAppStore((state) => state.loadMemories);
  const removeMemoriesFromStore = useAppStore((state) => state.removeMemories);
  const userSettings = useAppStore((state) => state.userSettings);
  const loadUserSettings = useAppStore((state) => state.loadUserSettings);
  const updateUserSettingsState = useAppStore(
    (state) => state.updateUserSettingsState,
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [isToggling, startToggleTransition] = useTransition();

  const {
    selectedIds,
    isAllSelected,
    targetDeleteIds,
    setTargetDeleteIds,
    isDeleting,
    handleToggleSelect,
    handleToggleSelectAll,
    handleSingleDelete,
    handleBulkDelete,
    handleConfirmDelete,
  } = useMemorySelection(memories, removeMemoriesFromStore);

  const isMemoryEnabled = userSettings?.memoryEnabled ?? true;

  const handleMount = useCallback(() => {
    loadMemories();
    loadUserSettings();
  }, [loadMemories, loadUserSettings]);

  const handleOpenAdd = () => {
    setEditingMemory(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (memory: Memory) => {
    setEditingMemory(memory);
    setDialogOpen(true);
  };

  const handleToggleMemory = (checked: boolean) => {
    startToggleTransition(async () => {
      try {
        updateUserSettingsState({ memoryEnabled: checked });
        await toggleMemoryEnabled(checked);
        toast.success(checked ? "Memory enabled" : "Memory disabled");
      } catch (err) {
        updateUserSettingsState({ memoryEnabled: !checked });
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to update memory setting",
        );
      }
    });
  };

  return (
    <>
      <ResourceListPage
        icon={<Brain className="text-primary h-8 w-8" />}
        title="Memory"
        description="Facts, preferences, and details remembered across your chats."
        items={memories}
        columns={2}
        renderCard={(memory) => (
          <MemoryCard
            key={memory.id}
            memory={memory}
            isSelected={selectedIds.has(memory.id)}
            onToggleSelect={handleToggleSelect}
            onEdit={handleOpenEdit}
            onDelete={handleSingleDelete}
          />
        )}
        extraFilters={
          memories.length > 0 ? (
            <MemorySelectionToolbar
              isAllSelected={isAllSelected}
              selectedCount={selectedIds.size}
              onToggleSelectAll={handleToggleSelectAll}
              onBulkDelete={handleBulkDelete}
            />
          ) : null
        }
        emptyStateMessage="No memories yet. The AI can remember facts as you chat, or you can add them manually."
        searchPlaceholder="Search memories..."
        onMount={handleMount}
        action={
          <MemoryHeaderActions
            isMemoryEnabled={isMemoryEnabled}
            isToggling={isToggling}
            onToggleMemory={handleToggleMemory}
            onOpenAdd={handleOpenAdd}
          />
        }
        filterFn={(m, q) => m.content.toLowerCase().includes(q.toLowerCase())}
      />

      <MemoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        memory={editingMemory}
      />

      <DeleteMemoriesAlertDialog
        targetDeleteIds={targetDeleteIds}
        isDeleting={isDeleting}
        onOpenChange={(open) => !open && setTargetDeleteIds(null)}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  );
}
