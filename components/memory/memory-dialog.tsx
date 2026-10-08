"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createMemory } from "@/actions/memories/create-memory";
import { updateMemory } from "@/actions/memories/update-memory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/lib/store";
import type { Memory } from "@/types/memory/memory";

/**
 * Props for the MemoryDialog component.
 */
interface MemoryDialogProps {
  /** Controlled open status of the dialog. */
  open: boolean;
  /** Callback to change open status. */
  onOpenChange: (open: boolean) => void;
  /** Memory entity when editing an existing item, or null/undefined when creating. */
  memory?: Memory | null;
  /** Optional callback fired when a memory has been created or updated successfully. */
  onSaved?: (memory: Memory) => void;
}

/**
 * Modal dialog for manually creating or editing a user memory entry.
 *
 * @param props.open - Whether the dialog is open.
 * @param props.onOpenChange - Handler for toggling open state.
 * @param props.memory - Memory being edited, or null/undefined if creating.
 * @param props.onSaved - Callback invoked after successful save.
 * @author Maruf Bepary
 */
export function MemoryDialog({
  open,
  onOpenChange,
  memory,
  onSaved,
}: MemoryDialogProps) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  const addMemoryToStore = useAppStore((state) => state.addMemory);
  const updateMemoryInStore = useAppStore((state) => state.updateMemory);

  const isEditing = Boolean(memory);

  useEffect(() => {
    if (open) {
      setContent(memory?.content ?? "");
    }
  }, [open, memory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    startTransition(async () => {
      try {
        if (memory) {
          const updated = await updateMemory({
            id: memory.id,
            content: trimmed,
          });
          updateMemoryInStore(updated);
          toast.success("Memory updated");
          onSaved?.(updated);
        } else {
          const created = await createMemory({ content: trimmed });
          addMemoryToStore(created);
          toast.success("Memory added");
          onSaved?.(created);
        }
        onOpenChange(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save memory",
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Memory" : "Add Memory"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update this remembered detail about your preferences or workflow."
                : "Add a fact or preference that the AI should remember across conversations."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="memory-content">Memory details</Label>
            <Textarea
              id="memory-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g. I prefer answers in concise bullet points with TypeScript code examples."
              rows={4}
              maxLength={2000}
              required
              disabled={isPending}
              className="resize-none"
            />
            <div className="flex justify-end text-muted-foreground text-xs">
              {content.length}/2000
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !content.trim()}>
              {isPending ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
