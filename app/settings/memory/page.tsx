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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/store";
import type { Memory } from "@/types/memory/memory";

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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetDeleteIds, setTargetDeleteIds] = useState<string[] | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isToggling, startToggleTransition] = useTransition();

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

  return (
    <>
      <ResourceListPage
        banner={
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="memory-toggle"
                  className="cursor-pointer font-semibold text-sm"
                >
                  Memory Storage & Retrieval
                </Label>
                <Badge
                  variant={isMemoryEnabled ? "default" : "secondary"}
                  className="text-xs"
                >
                  {isMemoryEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs leading-normal">
                {isMemoryEnabled
                  ? "The AI automatically saves important details during conversations and retrieves them when relevant."
                  : "Memory is turned off. The AI will not save new details or retrieve existing memories."}
              </p>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Switch
                id="memory-toggle"
                checked={isMemoryEnabled}
                onCheckedChange={handleToggleMemory}
                disabled={isToggling}
                aria-label="Toggle memory"
              />
            </div>
          </div>
        }
        icon={<Brain className="h-8 w-8 text-primary" />}
        title="Memory"
        description="Facts, preferences, and details remembered across your chats."
        items={memories}
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSelectAll}
                className="h-9 gap-1.5"
              >
                {isAllSelected ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
              </Button>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="px-2 py-1 text-xs">
                    {selectedIds.size} selected
                  </Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    className="h-9 gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Selected</span>
                  </Button>
                </div>
              )}
            </div>
          ) : null
        }
        emptyStateMessage="No memories yet. The AI can remember facts as you chat, or you can add them manually."
        searchPlaceholder="Search memories..."
        onMount={handleMount}
        action={
          <Button
            onClick={handleOpenAdd}
            disabled={!isMemoryEnabled}
            className="w-full md:w-auto"
            title={
              !isMemoryEnabled ? "Enable memory to add new memories" : undefined
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Memory
          </Button>
        }
        filterFn={(m, q) => m.content.toLowerCase().includes(q.toLowerCase())}
      />

      <MemoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        memory={editingMemory}
      />

      <AlertDialog
        open={Boolean(targetDeleteIds && targetDeleteIds.length > 0)}
        onOpenChange={(open) => !open && setTargetDeleteIds(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {targetDeleteIds && targetDeleteIds.length > 1
                ? `Delete ${targetDeleteIds.length} Memories`
                : "Delete Memory"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {targetDeleteIds && targetDeleteIds.length > 1
                ? `Are you sure you want to delete ${targetDeleteIds.length} memories? The AI will no longer remember these details.`
                : "Are you sure you want to delete this memory? The AI will no longer remember this detail."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
