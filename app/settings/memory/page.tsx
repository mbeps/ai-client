"use client";

import { Brain, Plus } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMemory } from "@/actions/memories/delete-memory";
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
  const removeMemoryFromStore = useAppStore((state) => state.removeMemory);
  const userSettings = useAppStore((state) => state.userSettings);
  const loadUserSettings = useAppStore((state) => state.loadUserSettings);
  const updateUserSettingsState = useAppStore(
    (state) => state.updateUserSettingsState,
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);

  const [deletingMemory, setDeletingMemory] = useState<Memory | null>(null);
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
    if (!deletingMemory) return;

    startDeleteTransition(async () => {
      try {
        await deleteMemory({ id: deletingMemory.id });
        removeMemoryFromStore(deletingMemory.id);
        toast.success("Memory deleted");
        setDeletingMemory(null);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete memory",
        );
      }
    });
  };

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
            onEdit={handleOpenEdit}
            onDelete={setDeletingMemory}
          />
        )}
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
        open={Boolean(deletingMemory)}
        onOpenChange={(open) => !open && setDeletingMemory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Memory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this memory? The AI will no longer
              remember this detail.
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
