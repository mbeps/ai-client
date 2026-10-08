"use client";

import { Brain, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMemory } from "@/actions/memories/delete-memory";
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
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import type { Memory } from "@/types/memory/memory";

/**
 * Settings page for inspecting and managing persistent user memories.
 *
 * @author Maruf Bepary
 */
export default function MemoryPage() {
  const memories = useAppStore((state) => state.memories);
  const loadMemories = useAppStore((state) => state.loadMemories);
  const removeMemoryFromStore = useAppStore((state) => state.removeMemory);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);

  const [deletingMemory, setDeletingMemory] = useState<Memory | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const handleOpenAdd = () => {
    setEditingMemory(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (memory: Memory) => {
    setEditingMemory(memory);
    setDialogOpen(true);
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
        onMount={loadMemories}
        action={
          <Button onClick={handleOpenAdd} className="w-full md:w-auto">
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
